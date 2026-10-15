(() => {
const C = window.APP_CONFIG || {};
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num = n => n >= 1e8 ? (n/1e8).toFixed(1)+"亿" : n >= 1e4 ? (n/1e4).toFixed(1)+"万" : n >= 1e3 ? (n/1e3).toFixed(1)+"k" : String(n||0);
const ago = t => { const m = Math.max(1, Math.round((Date.now() - new Date(t)) / 6e4)); return m < 60 ? m+"m" : Math.round(m/60)+"h"; };
const profile = u => `https://x.com/${encodeURIComponent(u)}`;
const AV = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E';

let D = null, tab = "exposure", expanded = false, wallSort = "views";

// ---------- 渲染 ----------
function card(p, i, extra = "") {
  const a = p.author, me = p.metrics;
  return `<div class="card${i < 3 ? " top" : ""}" data-url="${esc(p.url)}">
    <div class="rk ${i < 3 ? "t" : ""}">${i + 1}</div>
    <img class="av" loading="lazy" src="${esc(a.avatar || AV)}" alt="">
    <div class="body">
      <div class="nm"><span><b>${esc(a.name)}</b> <span class="m">@${esc(a.username)} · ${ago(p.created_at)}</span></span>
        <a class="fl" href="${profile(a.username)}" target="_blank" rel="noopener">关注</a></div>
      ${extra}
      <div class="emb" data-emb="${esc(p.url)}"></div>
      <div class="st"><span>👁 <b>${num(me.views)}</b></span><span>💬 <b>${num(me.replies)}</b></span><span>🔁 <b>${num(me.reposts)}</b></span><span>❤️ <b>${num(me.likes)}</b></span><button class="act" data-show="${esc(p.url)}">正文 ▾</button></div>
    </div></div>`;
}
function renderList() {
  const n = 10;
  let html;
  if (tab === "growth") {
    const g = D.growth || [];
    html = g.length ? g.slice(0, n).map((x, i) => card(x.post, i, `<div class="gain">24h +${num(x.gain)} 粉</div>`)).join("")
      : `<div class="empty">涨粉榜需累计 24 小时粉丝快照后才有数据<br>（上线约 24 小时后开放）</div>`;
    $("#more").style.display = "none";
  } else {
    const arr = D[tab] || [];
    html = arr.slice(0, n).map((p, i) => card(p, i)).join("") || `<div class="empty">暂无数据</div>`;
    $("#more").style.display = "none";
  }
  $("#list").innerHTML = html;
}
function renderBest() {
  $("#best").innerHTML = (D.best || []).slice(0, 10).map(b => `<a class="bc" href="${profile(b.author.username)}" target="_blank" rel="noopener">
    <img class="av" loading="lazy" src="${esc(b.author.avatar || AV)}" alt=""><b>${esc(b.author.name)}</b>
    <div class="m">互动 ${num(b.interactions)}</div>${b.gain != null ? `<div class="g" style="font-size:12px">+${num(b.gain)} 粉</div>` : ""}</a>`).join("");
}
// 圆形气泡墙：按当前排序名次定大小，#1 居中，螺旋搜索 + 碰撞检测的确定性排布
function packCircles(n, W) {
  const rad = i => 64 / Math.pow(i + 1, 0.42) + 9;          // 名次越靠后越小
  const placed = [], GAP = 3;
  for (let i = 0; i < n; i++) {
    const r = rad(i);
    if (!i) { placed.push({ x: 0, y: 0, r }); continue; }
    for (let t = 0; ; t += 0.07) {                          // 阿基米德螺旋向外找第一个不重叠的位置
      const d = 2.2 * t, x = d * Math.cos(t * 1.7), y = d * Math.sin(t * 1.7);
      if (placed.every(p => Math.hypot(p.x - x, p.y - y) >= p.r + r + GAP)) { placed.push({ x, y, r }); break; }
    }
  }
  let R = 0; placed.forEach(p => R = Math.max(R, Math.hypot(p.x, p.y) + p.r));
  const k = Math.min(1, (W / 2 - 6) / R), H = Math.ceil(2 * R * k + 44);
  return { H, items: placed.map(p => ({ x: W / 2 + p.x * k, y: (H - 36) / 2 + p.y * k, r: p.r * k })) };
}
function renderWall() {
  const arr = [...(D.photos || [])].sort((a, b) => b.metrics[wallSort] - a.metrics[wallSort]).slice(0, 60);
  const el = $("#wall"); if (!arr.length) { el.style.height = ""; el.innerHTML = `<div class="empty">暂无带图帖子</div>`; return; }
  const W = el.clientWidth || 378, { H, items } = packCircles(arr.length, W);
  el.style.height = H + "px";
  el.innerHTML = items.map((c, i) => { const p = arr[i], img = p.image?.url || p.author.avatar || AV;
    return `<a class="bub" href="${esc(p.url)}" target="_blank" rel="noopener" title="@${esc(p.author.username)} · ${wallSort === "views" ? "👁 " + num(p.metrics.views) : "💬 " + num(p.metrics.replies)}"
      style="left:${(c.x - c.r).toFixed(1)}px;top:${(c.y - c.r).toFixed(1)}px;width:${(2 * c.r).toFixed(1)}px;height:${(2 * c.r).toFixed(1)}px">
      <img loading="lazy" decoding="async" src="${esc(img)}" alt="">${i < 3 ? `<i>${i + 1}</i>` : ""}</a>`; }).join("")
    + `<span class="wtag l">24h 照片墙<br><span style="opacity:.7">按${wallSort === "views" ? "曝光" : "评论"} · 中心=第1</span></span><span class="wtag r">${arr.length} 帖</span>`;
}
function render() {
  const t = new Date(D.updated_at);
  $("#upd").textContent = `● ${String(t.getHours()).padStart(2,"0")}:${String(t.getMinutes()).padStart(2,"0")} 已更新`;
  $("#upd").title = t.toLocaleString();
  renderList(); renderBest(); renderWall();
}

// ---------- 交互 ----------
$("#tabs").onclick = e => {
  const t = e.target.dataset.t; if (!t) return;
  tab = t; expanded = false;
  document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.t === t));
  renderList();
};
$("#more").onclick = () => { expanded = true; renderList(); };
$("#wallSort").onclick = e => {
  const s = e.target.dataset.s; if (!s) return; wallSort = s;
  document.querySelectorAll("#wallSort button").forEach(b => b.classList.toggle("on", b.dataset.s === s)); renderWall();
};
$("#list").onclick = e => {
  const s = e.target.closest("[data-show]"); if (s) { e.stopPropagation(); showEmbed(s); return; }
  if (e.target.closest("a")) return;
  const c = e.target.closest(".card"); if (c) window.open(outUrl(c.dataset.url, "card_" + tab), "_blank", "noopener");
};
// 正文不入库：按需加载 X 官方嵌入（widgets.js 只在首次点击时加载）
let wjs;
function showEmbed(btn) {
  const box = btn.closest(".card").querySelector(".emb");
  if (box.innerHTML) { box.innerHTML = ""; btn.textContent = "正文 ▾"; return; }
  btn.textContent = "收起 ▴";
  box.innerHTML = `<blockquote class="twitter-tweet" data-theme="dark" data-dnt="true" data-conversation="none"><a href="${esc(box.dataset.emb)}">在 X 查看</a></blockquote>`;
  wjs ||= new Promise(r => { const s = document.createElement("script"); s.src = "https://platform.twitter.com/widgets.js"; s.async = true; s.onload = r; document.head.appendChild(s); });
  wjs.then(() => window.twttr?.widgets?.load(box));
}
// ---------- 统计：Cloudflare Web Analytics（token 为空则不加载）+ 出站点击经 go.html 计数 ----------
if (C.CF_BEACON_TOKEN) { const s = document.createElement("script"); s.defer = true; s.src = "https://static.cloudflareinsights.com/beacon.min.js"; s.dataset.cfBeacon = JSON.stringify({ token: C.CF_BEACON_TOKEN, spa: false }); document.head.appendChild(s); }
const isX = u => /^https:\/\/(x|twitter)\.com\//.test(u);
function outUrl(u, tag) { return C.CF_BEACON_TOKEN && isX(u) ? `go.html?t=${encodeURIComponent(tag)}&u=${encodeURIComponent(u)}` : u; }
document.addEventListener("click", e => {
  const a = e.target.closest("a[href]"); if (!a || !isX(a.href)) return;
  const tag = a.dataset.src ? "follow_" + a.dataset.src : a.classList.contains("bub") ? "wall" : a.id || (a.classList.contains("fl") ? "author" : "link");
  a.href = outUrl(a.href, tag);
}, true);
// ---------- 每日话题 & 站长推荐（topic.json，tiger 手动维护） ----------
fetch("topic.json", { cache: "no-cache" }).then(r => r.json()).then(t => {
  if (t.daily_topic) { $("#topicText").innerHTML = `${esc(t.daily_topic.title)}<span class="g">去投票/评论 →</span>`; $("#topic").href = t.daily_topic.url; }
  if (t.pinned?.url) { const p = $("#pinned"); p.href = t.pinned.url; p.querySelector("b").textContent = t.pinned.title || "查看 tiger 的最新帖"; p.querySelector(".m").textContent = t.pinned.label || "站长推荐"; p.hidden = false; }
}).catch(() => {});

// ---------- F12 我的最佳互动账号（partners.json 按需加载） ----------
let partnersP;
const normHandle = s => String(s || "").trim().replace(/^@+/, "").replace(/^https?:\/\/(x|twitter)\.com\//i, "").split(/[/?#\s]/)[0].toLowerCase();
async function showPartners(raw, push = true) {
  const h = normHandle(raw), out = $("#pqOut");
  if (!/^[a-z0-9_]{1,15}$/.test(h)) { out.innerHTML = `<div class="pres m">请输入有效的 X 用户名</div>`; return; }
  out.innerHTML = `<div class="pres m">查询中…</div>`;
  try {
    partnersP ||= fetch("partners.json", { cache: "no-cache" }).then(r => { if (!r.ok) throw 0; return r.json(); });
    const P = await partnersP, list = (P.users || {})[h];
    if (push) history.replaceState(null, "", `?u=${encodeURIComponent(h)}`);
    const t = P.updated_at ? new Date(P.updated_at).toLocaleString("zh-CN", { hour12: false, month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
    const note = `<div class="pnote">计算方法：${esc(P.method || "按最近回复和@次数")}（只统计最近的回复和 @，不含点赞）${t ? " · 更新于 " + t : ""}</div>`;
    if (!list?.length) { out.innerHTML = `<div class="pres"><h4>@${esc(h)}</h4><div>暂未收录，明天再来看看</div>${note}</div>`; return; }
    out.innerHTML = `<div class="pres"><h4><span>@${esc(h)}</span> 的最佳互动账号 Top 3</h4>` +
      list.slice(0, 3).map((u, i) => `<a class="pu" href="${outUrl(profile(u.handle), "partner")}" target="_blank" rel="noopener">
        <div class="rk">${i + 1}</div><img class="av" loading="lazy" src="${esc(u.avatar || AV)}" alt="">
        <div class="n"><b>${esc(u.name || u.handle)}</b><br><span class="m">@${esc(u.handle)}</span></div>
        <div class="c">${num(u.count)}<small>次互动</small></div></a>`).join("") +
      `${note}<div class="pshare"><button type="button" class="btn ghost" id="pqCopy">复制链接</button><button type="button" class="btn" id="pqPoster">生成海报</button></div></div>`;
    const url = shareUrl(h);
    $("#pqCopy").onclick = async () => { try { await navigator.clipboard.writeText(url); } catch { const t = document.createElement("textarea"); t.value = url; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); } toast("已复制"); };
    $("#pqPoster").onclick = () => openPoster(h, list.slice(0, 3), url);
  } catch { partnersP = null; out.innerHTML = `<div class="pres m">数据加载失败，请稍后再试</div>`; }
}
function shareUrl(h) { const base = (C.SITE_URL && !/example\./.test(C.SITE_URL)) ? C.SITE_URL : location.origin + location.pathname; return base.replace(/[?#].*$/, "") + "?u=" + encodeURIComponent(h); }
function toast(s) { let t = $("#toast"); if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); } t.textContent = s; t.classList.add("on"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), 1600); }
const loadJS = src => new Promise((r, j) => { const s = document.createElement("script"); s.src = src; s.onload = r; s.onerror = j; document.head.appendChild(s); });
let posterLib;
async function openPoster(h, list, url) {
  const m = document.createElement("div"); m.className = "pm"; m.innerHTML = `<div class="pmb"><div class="m" style="text-align:center;padding:40px">海报生成中…</div></div>`;
  document.body.appendChild(m); m.onclick = e => { if (e.target === m) m.remove(); };
  try {
    posterLib ||= Promise.all([loadJS("vendor/qrcode.js"), loadJS("poster.js")]);
    await posterLib;
    const cv = await window.makePoster({ handle: h, list, url });
    const blob = await new Promise(r => cv.toBlob(r, "image/png")), file = new File([blob], `best-partners-${h}.png`, { type: "image/png" });
    const purl = URL.createObjectURL(blob);
    const xText = "我的 X 最佳互动账号 Top 3 出炉了，测测你的 👉 " + url;
    m.querySelector(".pmb").innerHTML = `<img src="${purl}" alt="海报"><div class="pmh">先保存海报，发帖时把图片加上</div>
      <div class="pmr"><button class="btn" id="pmSave">保存图片</button><a class="btn ghost" id="pmX" target="_blank" rel="noopener" href="https://x.com/intent/post?text=${encodeURIComponent(xText)}">发到 X</a><button class="btn ghost" id="pmClose">关闭</button></div>`;
    m.querySelector("#pmClose").onclick = () => m.remove();
    m.querySelector("#pmSave").onclick = async () => {
      if (navigator.canShare?.({ files: [file] }) && /Mobi|Android|iPhone/i.test(navigator.userAgent)) { try { await navigator.share({ files: [file], text: xText }); return; } catch (e) { if (e.name === "AbortError") return; } }
      const a = document.createElement("a"); a.href = purl; a.download = file.name; a.click(); toast("已保存");
    };
  } catch (e) { m.querySelector(".pmb").innerHTML = `<div class="m" style="padding:30px;text-align:center">海报生成失败</div>`; }
}
$("#pq").onsubmit = e => { e.preventDefault(); showPartners($("#pqIn").value); };
{ const u = new URLSearchParams(location.search).get("u"); if (u) { $("#pqIn").value = "@" + normHandle(u); showPartners(u, false); } }

// ---------- 启动 ----------
fetch("data.json", { cache: "no-cache" }).then(r => r.json()).then(d => { D = d; render(); })
  .catch(() => { $("#list").innerHTML = `<div class="empty">数据加载失败，请稍后刷新</div>`; });
})();
