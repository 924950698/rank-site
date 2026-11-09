#!/usr/bin/env node
// 拉取 X 趋势（/2/trends/by/woeid）写入 trends.json。令牌只从环境变量读取，不打印。
// 注：中国/香港/台湾 WOEID 在 X 上会回落为全球榜，故只取 全球/日本/美国/新加坡。
import { writeFileSync, renameSync } from "node:fs";
const T = process.env.X_BEARER_TOKEN;
if (!T) { console.error("X_BEARER_TOKEN not set"); process.exit(1); }
const REGIONS = [["global", "全球", 1], ["jp", "日本", 23424856], ["us", "美国", 23424977], ["sg", "新加坡", 23424948]];
// 免费翻译（Google 公共接口），失败则不写 zh，前端显示原文
const TR = new Map();
async function zh(name) {
  if (TR.has(name)) return TR.get(name);
  let res = null;
  for (let k = 0; k < 2 && !res; k++) try {
    await new Promise(r => setTimeout(r, k ? 2500 : 300));
    const tag = name.startsWith("#"), raw = tag ? name.slice(1).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ") : name;
    const r = await fetch("https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex&sl=auto&tl=zh-CN&dt=t&q=" + encodeURIComponent(raw), { signal: AbortSignal.timeout(8000) });
    const j = await r.json(), lang = j[2] || "";
    const t = (j[0] || []).map(x => x[0]).join("").trim();
    if (t && !/^zh/i.test(lang) && t.toLowerCase() !== raw.toLowerCase()) res = (tag ? "#" : "") + t;
  } catch {}
  if (!res && /[^\x00-\x7f]|^#?[A-Z]?[a-z]+[A-Z]|\s/.test(name) && !/[\u4e00-\u9fff]/.test(name.replace(/[\u3040-\u30ff].*/,"")) || (!res && /[\u3040-\u30ff]/.test(name))) { // 兜底：MyMemory
    try {
      const raw = name.replace(/^#/, "").replace(/_/g, " ");
      const r = await fetch("https://api.mymemory.translated.net/get?langpair=" + (/[\u3040-\u30ff\u4e00-\u9fff]/.test(name) ? "ja" : "en") + "|zh-CN&q=" + encodeURIComponent(raw), { signal: AbortSignal.timeout(8000) });
      const t = ((await r.json()).responseData || {}).translatedText || "";
      if (t && t !== raw && !/MYMEMORY|QUERY LENGTH/i.test(t)) res = (name.startsWith("#") ? "#" : "") + t.trim();
    } catch {}
  }
  TR.set(name, res); return res;
}
const out = { updated: Date.now(), regions: [] };
for (const [key, name, woeid] of REGIONS) {
  let items = [], err = null;
  try {
    const r = await fetch(`https://api.x.com/2/trends/by/woeid/${woeid}?max_trends=20&trend.fields=trend_name,tweet_count`, { headers: { Authorization: `Bearer ${T}` } });
    const j = await r.json();
    if (!r.ok) err = `HTTP ${r.status}`;
    items = (j.data || []).filter(t => t.trend_name).map(t => {
      const o = { name: t.trend_name };
      if (Number.isFinite(t.tweet_count)) o.count = t.tweet_count;
      return o;
    });
  } catch (e) { err = String(e.message || e); }
  for (const it of items) { const z = await zh(it.name); if (z) it.zh = z; }
  out.regions.push({ key, name, woeid, items, ...(err ? { error: err } : {}) });
  console.log(`${name}: ${items.length}${err ? " " + err : ""}`);
}
const f = new URL("../trends.json", import.meta.url);
writeFileSync(new URL("../trends.json.tmp", import.meta.url), JSON.stringify(out, null, 1) + "\n");
renameSync(new URL("../trends.json.tmp", import.meta.url), f);
