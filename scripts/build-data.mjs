#!/usr/bin/env node
// 每小时运行：调用 X API v2 recent search，滚动维护 24h 帖子池，生成 data.json
// 用法：node scripts/build-data.mjs            （需 X_BEARER_TOKEN）
//       node scripts/build-data.mjs --sample   （生成示例数据，不调接口）
//       node scripts/build-data.mjs --dry-run  （打印本小时计划调用次数，不调接口）
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const KW = JSON.parse(await fs.readFile(path.join(ROOT, "scripts/keywords.json"), "utf8"));
const ENV = process.env;
const OWNER = ENV.OWNER_USERNAME || "tigerr3aue";
const PER_CALL = Number(ENV.X_MAX_RESULTS || 25);          // PRD：每次最多 25 条
const PAGES = Number(ENV.X_PAGES_PER_QUERY || 2);          // 每个查询翻页数
const DAILY_BUDGET = Number(ENV.X_DAILY_BUDGET || 140);    // 自设日预算（接口上限 1000）
const QUERY_MAX_LEN = Number(ENV.X_QUERY_MAX_LEN || 512);
const H24 = 864e5;
const STATE = path.join(ROOT, "state");
const args = new Set(process.argv.slice(2));

const readJSON = async (f, d) => { try { return JSON.parse(await fs.readFile(f, "utf8")); } catch { return d; } };
const writeJSON = (f, o) => fs.writeFile(f, JSON.stringify(o, null, 1));
const hourCST = () => (new Date().getUTCHours() + 8) % 24;
const dayCST = () => new Date(Date.now() + 8 * 36e5).toISOString().slice(0, 10);

// 把关键词合并成若干条 OR 查询，节省额度
function buildQueries(words) {
  const suffix = " lang:zh -is:retweet -is:reply";   // 中文 + 原创（排除转帖与回复）
  const out = []; let cur = [];
  for (const w of words) {
    const next = [...cur, w];
    if (`(${next.join(" OR ")})${suffix}`.length > QUERY_MAX_LEN && cur.length) { out.push(cur); cur = [w]; } else cur = next;
  }
  if (cur.length) out.push(cur);
  // 每组最多 6 个词，避免高频词（BTC）挤掉低频词
  return out.flatMap(g => { const r = []; for (let i = 0; i < g.length; i += 6) r.push(g.slice(i, i + 6)); return r; })
    .map(g => `(${g.join(" OR ")})${suffix}`);
}

// ---------- X API ----------
let calls = 0, lastRate = null;
async function xget(url) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${ENV.X_BEARER_TOKEN}` } });
  calls++;
  lastRate = { remaining: r.headers.get("x-rate-limit-remaining"), reset: r.headers.get("x-rate-limit-reset") };
  if (r.status === 429) throw Object.assign(new Error("rate limited"), { rate: true });
  if (!r.ok) throw new Error(`X API ${r.status}: ${await r.text()}`);
  await new Promise(s => setTimeout(s, 2100)); // ≤ 30 次/分钟
  return r.json();
}
const FIELDS = "tweet.fields=created_at,public_metrics,lang,attachments,referenced_tweets,author_id&expansions=author_id,attachments.media_keys&user.fields=name,username,profile_image_url,public_metrics,verified&media.fields=type,url,preview_image_url,width,height";

async function search(q, sinceISO) {
  const out = []; let token;
  for (let p = 0; p < PAGES; p++) {
    const u = `https://api.x.com/2/tweets/search/recent?query=${encodeURIComponent(q)}&max_results=${Math.max(10, PER_CALL)}&sort_order=relevancy&start_time=${sinceISO}&${FIELDS}${token ? "&next_token=" + token : ""}`;
    const j = await xget(u);
    out.push(...normalize(j));
    token = j.meta?.next_token; if (!token) break;
  }
  return out;
}
function normalize(j) {
  const users = Object.fromEntries((j.includes?.users || []).map(u => [u.id, u]));
  const media = Object.fromEntries((j.includes?.media || []).map(m => [m.media_key, m]));
  return (j.data || []).filter(t => t.lang === "zh" && !(t.referenced_tweets || []).some(r => r.type === "retweeted")
    && !KW.blacklist_words.some(w => (t.text || "").includes(w))       // 正文只在内存里用于黑名单过滤，不落盘
    && (users[t.author_id]?.username || "").toLowerCase() !== OWNER.toLowerCase()).map(t => {
    const u = users[t.author_id] || {}; const pm = t.public_metrics || {};
    const img = (t.attachments?.media_keys || []).map(k => media[k]).find(m => m && (m.type === "photo" || m.preview_image_url));
    return {
      id: t.id, url: `https://x.com/${u.username}/status/${t.id}`,
      created_at: t.created_at,
      author: { id: u.id, name: u.name, username: u.username, avatar: u.profile_image_url, followers: u.public_metrics?.followers_count || 0 },
      metrics: { views: pm.impression_count || 0, replies: pm.reply_count || 0, reposts: pm.retweet_count || 0, likes: pm.like_count || 0, quotes: pm.quote_count || 0, bookmarks: pm.bookmark_count || 0 },
      image: img ? { url: img.url || img.preview_image_url, w: img.width, h: img.height } : null
    };
  });
}
// 删除同步：批量查询仍在池中的帖子，接口不再返回的（被删/私密/封号）从池中移除
async function lookupAlive(ids) {
  const alive = new Map();
  for (let i = 0; i < ids.length; i += 100) {
    const j = await xget(`https://api.x.com/2/tweets?ids=${ids.slice(i, i + 100).join(",")}&${FIELDS}`);
    normalize(j).forEach(p => alive.set(p.id, p));
  }
  return alive;
}
async function trends() { // 中文趋势前 N 词（WOEID 可配置；失败则忽略）
  try { const j = await xget(`https://api.x.com/2/trends/by/woeid/${ENV.X_TRENDS_WOEID || 1}`); return (j.data || []).map(t => t.trend_name).filter(n => /[\u4e00-\u9fa5]/.test(n)).slice(0, KW.include_x_trends_top); }
  catch (e) { console.warn("trends failed", e.message); return []; }
}

// ---------- 计算 ----------
const interactions = p => p.metrics.replies + p.metrics.reposts + p.metrics.likes + p.metrics.quotes;
const okPost = p => p.author?.username && p.author.followers >= KW.min_followers &&
  !KW.blacklist_users.includes(p.author.username) &&
  Date.now() - new Date(p.created_at) < H24 && p.author.username.toLowerCase() !== OWNER.toLowerCase();

function compute(pool, followerHist) {
  const posts = Object.values(pool).filter(okPost);
  const top = (arr, k, n = 50) => [...arr].sort((a, b) => b.metrics[k] - a.metrics[k]).slice(0, n);
  const byAuthor = {};
  for (const p of posts) { const a = (byAuthor[p.author.id] ||= { author: p.author, posts: [], interactions: 0 }); a.posts.push(p); a.interactions += interactions(p); }
  const gainOf = id => { const h = followerHist[id]; if (!h || h.length < 2) return null; const old = h.find(x => Date.now() - x.t <= H24 + 36e5); const span = h.at(-1).t - (old?.t ?? h.at(-1).t); return span >= 23 * 36e5 ? h.at(-1).f - old.f : null; };
  const growth = Object.values(byAuthor).map(a => ({ a, gain: gainOf(a.author.id) })).filter(x => x.gain > 0)
    .sort((x, y) => y.gain - x.gain).slice(0, 50).map(x => ({ gain: x.gain, post: top(x.a.posts, "views", 1)[0] }));
  const best = Object.values(byAuthor).sort((x, y) => y.interactions - x.interactions).slice(0, 10)
    .map(a => ({ author: a.author, interactions: a.interactions, gain: gainOf(a.author.id) }));
  return {
    updated_at: new Date().toISOString(),
    exposure: top(posts, "views"), comments: top(posts, "replies"), growth,
    photos: top(posts.filter(p => p.image), "views", 60), best,
    meta: { pool_size: posts.length, api_calls_this_run: calls, rate: lastRate }
  };
}

// ---------- 主流程 ----------
async function main() {
  await fs.mkdir(STATE, { recursive: true });
  if (args.has("--sample")) { const { sample } = await import("./sample.mjs"); await writeJSON(path.join(ROOT, "data.json"), sample()); console.log("sample data.json written"); return; }

  const usage = await readJSON(path.join(STATE, "usage.json"), {});
  const today = dayCST(); usage[today] ||= 0;
  const isScheduled = KW.scheduled_hours_cst.includes(hourCST()) || args.has("--force-scheduled");
  let words = [...KW.rolling];
  const plan = { rolling: buildQueries(KW.rolling) };
  if (isScheduled) plan.scheduled = buildQueries(KW.scheduled);
  const est = (plan.rolling.length + (plan.scheduled?.length || 0)) * PAGES + 1 + (isScheduled ? 1 : 0);
  console.log(`hour(CST)=${hourCST()} scheduled=${isScheduled} queries=${JSON.stringify(plan, null, 1)} est_calls<=${est} used_today=${usage[today]}`);
  if (args.has("--dry-run")) { const daily = buildQueries(KW.rolling).length * PAGES * 24 + 24 + KW.scheduled_hours_cst.length * (buildQueries(KW.scheduled).length * PAGES + 1); console.log(`estimated daily calls ≈ ${daily} (budget ${DAILY_BUDGET})`); return; }
  if (!ENV.X_BEARER_TOKEN) throw new Error("X_BEARER_TOKEN missing (use --sample for local preview)");

  const pool = await readJSON(path.join(STATE, "posts.json"), {});
  const followerHist = await readJSON(path.join(STATE, "followers.json"), {});
  const since = new Date(Date.now() - H24 + 6e4).toISOString();
  let degraded = usage[today] + est > DAILY_BUDGET;     // 额度不足：降频，只跑第一条滚动查询
  const queries = degraded ? plan.rolling.slice(0, 1) : [...plan.rolling, ...(plan.scheduled || [])];
  if (isScheduled && !degraded) { const tw = await trends(); if (tw.length) queries.push(...buildQueries(tw.map(t => `"${t}"`))); }

  // 删除同步（先于搜索）
  const deleted = [];
  const ids = Object.keys(pool);
  if (ids.length && !degraded) {
    try { const alive = await lookupAlive(ids); for (const id of ids) { if (!alive.has(id)) { delete pool[id]; deleted.push(id); } else pool[id] = alive.get(id); } }
    catch (e) { console.warn("lookup failed", e.message); }
  }
  for (const q of queries) {
    try { for (const p of await search(q, since)) pool[p.id] = p; } // 按 ID 去重，最新指标覆盖
    catch (e) { console.warn("search failed:", q, e.message); if (e.rate) break; }
  }
  // 清理 >24h（posts.json 只保留 24h；数据库缓存 48h 过期）
  for (const [id, p] of Object.entries(pool)) if (Date.now() - new Date(p.created_at) > H24) delete pool[id];
  // 粉丝快照（每小时一次），保留 26h
  const now = Date.now();
  for (const p of Object.values(pool)) { const h = (followerHist[p.author.id] ||= []); if (!h.length || now - h.at(-1).t > 30 * 6e4) h.push({ t: now, f: p.author.followers }); }
  for (const [id, h] of Object.entries(followerHist)) { followerHist[id] = h.filter(x => now - x.t < 26 * 36e5); if (!followerHist[id].length) delete followerHist[id]; }

  const data = compute(pool, followerHist);
  usage[today] += calls;
  for (const d of Object.keys(usage)) if (d < new Date(Date.now() - 7 * H24).toISOString().slice(0, 10)) delete usage[d];
  data.meta.used_today = usage[today]; data.meta.degraded = degraded;

  await writeJSON(path.join(STATE, "posts.json"), pool);
  await writeJSON(path.join(STATE, "followers.json"), followerHist);
  await writeJSON(path.join(STATE, "usage.json"), usage);
  await writeJSON(path.join(ROOT, "data.json"), data);
  console.log(`done: calls=${calls} today=${usage[today]} pool=${Object.keys(pool).length} deleted=${deleted.length}`);
}
main().catch(e => { console.error(e); process.exit(1); });
