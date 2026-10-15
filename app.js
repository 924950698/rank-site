(() => {
const AV_V = window.ASSET_V || "1";
const C = window.APP_CONFIG || {};
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num = n => n >= 1e8 ? (n/1e8).toFixed(1)+"亿" : n >= 1e4 ? (n/1e4).toFixed(1)+"万" : n >= 1e3 ? (n/1e3).toFixed(1)+"k" : String(n||0);
const ago = t => { const m = Math.max(1, Math.round((Date.now() - new Date(t)) / 6e4)); return m < 60 ? m+"m" : Math.round(m/60)+"h"; };
const profile = u => `https://x.com/${encodeURIComponent(u)}`;
const AV = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E';

let PW = null, D = null, tab = "exposure", expanded = false, wallSort = "views";

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
      : `<div class="empty">数据统计中，约 24 小时后更新</div>`;
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
function packCircles(n, W, rad = i => 64 / Math.pow(i + 1, 0.42) + 9) {
  // 同心圆环：中心是本人，外面一圈一圈排，每圈头像同尺寸、均匀分布满 360°，整体轮廓是正圆
  const GAP = 13, rs = Array.from({ length: n }, (_, i) => rad(i)), placed = [];
  if (!n) return { H: 0, items: [], fillers: [] };
  placed.push({ x: 0, y: 0, r: rs[0] });
  let outer = rs[0], i = 1;
  while (i < n) {
    const r = Math.max(8, rs[i]), d = outer + GAP + r;
    const cap = Math.max(6, Math.floor(Math.PI / Math.asin(Math.min(1, (r + GAP / 2) / d))));
    const cnt = Math.min(cap, n - i), off = (i % 2) * Math.PI / cap;
    for (let j = 0; j < cnt; j++, i++) { const a = off + 2 * Math.PI * j / cnt; placed.push({ x: d * Math.cos(a), y: d * Math.sin(a), r }); }
    outer = d + r;
  }
  const R = outer, k = (W / 2 - 6) / R;
  const H = Math.ceil(2 * R * k + 44), map = p => { const u = Math.min(1, Math.max(0, (Math.hypot(p.x, p.y) / R - 0.35) / 0.65)), sm = u * u * (3 - 2 * u);
    return { x: W / 2 + p.x * k, y: (H - 36) / 2 + p.y * k, r: p.r * k, f: p.f, o: +(1 - 0.7 * sm).toFixed(3) }; };   // 透明度按离中心距离平滑过渡
  return { H, items: placed.map(map), fillers: [] };
}
const selfAvatar = h => `https://unavatar.io/x/${encodeURIComponent(h)}`;
const partnerRad = (list) => { const mx = Math.max(1, ...list.map(u => u.count || 0)); return i => i === 0 ? 70 : 12 + 44 * Math.sqrt((list[i - 1].count || 0) / mx); };
const ini = u => [...(u.name || u.handle || "?")][0].toUpperCase();
// 头像高清化 + 预加载：加载失败的气泡直接去掉（只有中心自己保留首字母）
const hiAv = s => s ? String(s).replace(/_normal\.(jpe?g|png|webp)$/i, "_200x200.$1") : s;
const imgOk = new Map();
const probe = src => { if (!src) return Promise.resolve(false); if (!imgOk.has(src)) imgOk.set(src, new Promise(res => { const im = new Image(); im.referrerPolicy = "no-referrer";
  const t = setTimeout(() => res(false), 6000); im.onload = () => { clearTimeout(t); res(im.naturalWidth > 0); }; im.onerror = () => { clearTimeout(t); res(false); }; im.src = src; })); return imgOk.get(src); };
async function keepLoaded(arr, keepFirst) { const ok = await Promise.all(arr.map(u => probe(u.avatar))); return arr.filter((u, i) => ok[i] || (keepFirst && i === 0)); }
const hsh = s => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
// 个人墙人员：自己 → 按互动排序的伙伴 → extra（外圈小头像），去重，最多 50
function wallPeople(pw) {
  const seen = new Set([pw.h]), out = [{ handle: pw.h, name: pw.h, avatar: hiAv(pw.selfAv) || selfAvatar(pw.h), self: 1 }];
  const add = (u, extra) => { const hd = normHandle(u?.handle || u?.username); if (!hd || seen.has(hd) || !u.avatar || out.length >= 50) return; seen.add(hd); out.push({ handle: hd, name: u.name || hd, avatar: hiAv(u.avatar), count: extra ? 0 : (u.count || 0), extra: extra || !(u.count > 0) }); };
  pw.list.filter(u => u.count > 0).forEach(u => add(u, false));
  pw.list.filter(u => !(u.count > 0)).forEach(u => add(u, true));
  (pw.extra || []).forEach(u => add(u, true));
  return out;
}
function peopleRad(ppl) { return i => 64 / Math.pow(i + 1, 0.42) + 9; }   // 与 24h 照片墙统一：按名次平滑递减

// 碰撞光环（B 版）+ 触控：头像原位漂动；手指甩动头像 → 沿方向冲出、连锁碰撞，光环逐层增强，传到最外圈消散
let fxRaf = 0;
function startWallFx(el) {
  cancelAnimationFrame(fxRaf); el.querySelector("canvas.fx")?.remove();
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const W = el.clientWidth, H = el.clientHeight, cx = W / 2;
  const bubs = [...el.querySelectorAll(".bub")].map((b, i) => { const r = b.offsetWidth / 2; return { b, i, x: b.offsetLeft + r, y: b.offsetTop + r, r, m: r * r, ph: i * 1.7, sp: .5 + (i % 5) * .09, amp: still ? 0 : Math.min(7, 3.5 + r * .06), ox: 0, oy: 0, vx: 0, vy: 0, gen: 0, cool: 0 }; });
  if (!bubs.length) return;
  const cy = bubs[0].y, Rmax = Math.max(...bubs.map(o => Math.hypot(o.x - cx, o.y - cy) + o.r));
  const d = Math.min(2, devicePixelRatio || 1), cv = document.createElement("canvas");
  cv.className = "fx"; cv.width = W * d; cv.height = H * d; cv.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;pointer-events:none;z-index:5`;
  el.appendChild(cv); const g = cv.getContext("2d"); g.scale(d, d);
  const pairs = []; for (let i = 0; i < bubs.length; i++) for (let j = i + 1; j < bubs.length; j++) { const a = bubs[i], b = bubs[j]; if (Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r < 60) pairs.push({ a, b, on: false }); }
  let fx = [], last = performance.now(), drag = null;
  const ring = (x, y, s, gen) => { const p = Math.min(1, Math.hypot(x - cx, y - cy) / Rmax), lv = 1 + Math.min(gen, 6) * .35, fade = p > .85 ? (1 - p) / .15 : 1;
    if (fade <= .05) return; fx.push({ x, y, s: s * lv, w: lv, a: fade, age: 0, life: 1.6 + gen * .12 }, { x, y, s: s * lv, w: lv, a: fade, age: -.4, life: 1.6 + gen * .12 }); };
  // 触控
  el.querySelectorAll(".bub").forEach(b => { b.style.touchAction = "none"; b.draggable = false; b.querySelector("img")?.setAttribute("draggable", "false"); });
  el.onpointerdown = e => { const t = e.target.closest(".bub"); if (!t) return; const o = bubs.find(q => q.b === t); if (!o) return;
    drag = { o, sx: e.clientX, sy: e.clientY, bx: o.ox, by: o.oy, hist: [[e.clientX, e.clientY, performance.now()]], moved: false }; t.setPointerCapture?.(e.pointerId); };
  el.onpointermove = e => { if (!drag) return; const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy; if (Math.hypot(dx, dy) > 6) drag.moved = true;
    const L = Math.hypot(dx, dy), k = L > 30 ? 30 / L : 1; drag.o.ox = drag.bx + dx * k; drag.o.oy = drag.by + dy * k; drag.o.vx = drag.o.vy = 0;
    drag.hist.push([e.clientX, e.clientY, performance.now()]); if (drag.hist.length > 6) drag.hist.shift(); };
  el.onpointerup = el.onpointercancel = e => { if (!drag) return; const { o, hist, moved } = drag; drag = null;
    if (!moved) return; const [x0, y0, t0] = hist[0], [x1, y1, t1] = hist[hist.length - 1], dt = Math.max(16, t1 - t0) / 1000;
    let vx = (x1 - x0) / dt, vy = (y1 - y0) / dt; const v = Math.hypot(vx, vy), cap = 900, mn = 380; if (v < 1) return;
    const f = Math.min(cap, Math.max(mn, v)) / v; o.vx = vx * f; o.vy = vy * f; o.gen = 1; o.flick = 1;
    el.dataset.nc = "1"; setTimeout(() => delete el.dataset.nc, 50); window.track?.("wall:flick"); };
  el.onclick = e => { if (el.dataset.nc) { e.preventDefault(); e.stopPropagation(); } };
  el.addEventListener("click", e => { if (el.dataset.nc) e.preventDefault(); }, true);
  const step = now => {
    if (!el.isConnected || !el.contains(cv)) return;
    const t = now / 1000, dt = Math.min(.033, (now - last) / 1000); last = now;
    for (const o of bubs) { if (drag?.o === o) continue;
      const ax = -60 * o.ox - 7 * o.vx, ay = -60 * o.oy - 7 * o.vy; o.vx += ax * dt; o.vy += ay * dt; o.ox += o.vx * dt; o.oy += o.vy * dt;
      if (o.cool > 0) o.cool -= dt; if (Math.hypot(o.vx, o.vy) < 15) o.gen = 0; }
    for (const o of bubs) { o.dx = Math.sin(t * o.sp + o.ph) * o.amp + o.ox; o.dy = Math.cos(t * o.sp * .8 + o.ph * 1.3) * o.amp + o.oy; }
    for (const p of pairs) { const A = p.a, B = p.b, ax = A.x + A.dx, ay = A.y + A.dy, bx = B.x + B.dx, by = B.y + B.dy, dx = bx - ax, dy = by - ay, dist = Math.hypot(dx, dy) || 1, ov = A.r + B.r - dist, touch = ov >= -.5;
      if (touch) { const nx = dx / dist, ny = dy / dist, rv = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny;
        if (rv < 0) { const im = 1 / A.m + 1 / B.m, j = -(1 + .9) * rv / im * 1.06, hard = -rv > 60;   // 略大于弹性碰撞：波越传越强
          A.vx -= j * nx / A.m; A.vy -= j * ny / A.m; B.vx += j * nx / B.m; B.vy += j * ny / B.m;
          if (hard) { const src = A.gen >= B.gen ? A : B, dst = src === A ? B : A; dst.gen = Math.max(dst.gen, src.gen + 1);
            const sp = Math.hypot(dst.vx, dst.vy), lim = 700 + dst.gen * 40; if (sp > lim) { dst.vx *= lim / sp; dst.vy *= lim / sp; } } }
        if (ov > 0) { const push = ov / 2; if (drag?.o !== A) { A.ox -= nx * push; A.oy -= ny * push; } if (drag?.o !== B) { B.ox += nx * push; B.oy += ny * push; } }
        if (!p.on && (A.cool <= 0 || B.cool <= 0)) { const u = A.r / (A.r + B.r), gen = Math.max(A.gen, B.gen); ring(ax + dx * u, ay + dy * u, Math.min(A.r, B.r), gen); A.cool = B.cool = .25; } }
      p.on = touch; }
    for (const o of bubs) o.b.style.transform = `translate(${o.dx.toFixed(2)}px,${o.dy.toFixed(2)}px)`;
    g.clearRect(0, 0, W, H); fx = fx.filter(f => (f.age += dt) < f.life);
    for (const f of fx) { if (f.age < 0) continue; const k = f.age / f.life, e = 1 - (1 - k) * (1 - k);
      g.globalAlpha = (1 - k) * .85 * f.a; g.strokeStyle = "#39ff14"; g.lineWidth = (2.2 * (1 - k) + .5) * f.w; g.shadowColor = "#39ff14"; g.shadowBlur = 10 * f.w;
      g.beginPath(); g.arc(f.x, f.y, 4 + e * (f.s * 1.3 + 14), 0, 7); g.stroke(); }
    g.globalAlpha = 1; fxRaf = requestAnimationFrame(step);
  };
  fxRaf = requestAnimationFrame(step);
}
let wallTok = 0;
async function renderPersonalWall() {
  const tok = ++wallTok, el = $("#wall"), h = PW.h;
  const ppl = await keepLoaded(wallPeople(PW), true); if (tok !== wallTok || !PW) return;
  const W = el.clientWidth || 378, { H, items } = packCircles(ppl.length, W, peopleRad(ppl));
  let rank = 0;
  el.style.height = H + "px";
  el.innerHTML = items.map((c, i) => { const u = ppl[i], rk = !u.self && !u.extra ? ++rank : 0;
    return `<a class="bub${u.self ? " self" : ""}" href="${outUrl(profile(u.handle), u.self ? "self_wall" : "partner_wall")}" target="_blank" rel="noopener" title="@${esc(u.handle)}${u.count ? " · " + u.count + " 次互动" : ""}"
      style="left:${(c.x - c.r).toFixed(1)}px;top:${(c.y - c.r).toFixed(1)}px;width:${(2 * c.r).toFixed(1)}px;height:${(2 * c.r).toFixed(1)}px;opacity:${c.o}">
      <img decoding="async" src="${esc(u.avatar)}" alt="" onerror="${u.self ? `this.outerHTML='<b class=ini>${esc(ini(u))}</b>'` : "this.parentNode.remove()"}">${rk && rk <= 3 ? `<i>${rk}</i>` : ""}</a>`; }).join("")
    + `<span class="wtag l">@${esc(h)} 的互动圈<br><span style="opacity:.7">圆越大互动越多</span></span><span class="wtag r">${ppl.length - 1} 人</span>`;
  startWallFx(el);
}
async function renderWall() {
  $("#wallTitle").textContent = PW ? `@${PW.h} 的互动照片墙` : "24 小时照片墙";
  $("#wallSort").style.display = PW ? "none" : "";
  if (PW) return renderPersonalWall();
  if (!D) return;
  const tok = ++wallTok, el = $("#wall");
  const ps = [...(D.photos || [])].sort((a, b) => b.metrics[wallSort] - a.metrics[wallSort]).slice(0, 50);
  let arr = ps.map(p => ({ url: p.url, avatar: p.image?.url || hiAv(p.author.avatar), handle: p.author.username, m: p.metrics }));
  if (arr.length < 30) {                                   // 帖子图不够 → 用曝光/评论榜作者头像补到 30–50
    const seen = new Set(arr.map(x => x.handle));
    for (const p of [...(D.exposure || []), ...(D.comments || []), ...(D.best || []), ...(D.growth || []).map(g => g.post)].filter(Boolean)) { if (arr.length >= 50) break; const a = p.author; if (!a?.avatar || seen.has(a.username)) continue; seen.add(a.username); arr.push({ url: p.url, avatar: hiAv(a.avatar), handle: a.username, m: p.metrics || {}, fill: 1 }); }
  }
  arr = await keepLoaded(arr, false); if (tok !== wallTok || PW) return;
  if (!arr.length) { el.style.height = ""; el.innerHTML = `<div class="empty">暂无带图帖子</div>`; return; }
  const n0 = arr.filter(x => !x.fill).length;
  const W = el.clientWidth || 378, { H, items } = packCircles(arr.length, W, i => arr[i].fill ? 11 + hsh(arr[i].handle) % 5 : 64 / Math.pow(i + 1, 0.42) + 9);
  el.style.height = H + "px";
  el.innerHTML = items.map((c, i) => { const p = arr[i];
    return `<a class="bub" href="${esc(p.url)}" target="_blank" rel="noopener" title="@${esc(p.handle)}${p.m?.views != null ? " · 👁 " + num(p.m.views) : ""}"
      style="left:${(c.x - c.r).toFixed(1)}px;top:${(c.y - c.r).toFixed(1)}px;width:${(2 * c.r).toFixed(1)}px;height:${(2 * c.r).toFixed(1)}px;opacity:${c.o}">
      <img decoding="async" src="${esc(p.avatar)}" alt="" onerror="this.parentNode.remove()">${i < 3 && !p.fill ? `<i>${i + 1}</i>` : ""}</a>`; }).join("")
    + `<span class="wtag l">24h 照片墙<br><span style="opacity:.7">按${wallSort === "views" ? "曝光" : "评论"} · 中心=第1</span></span><span class="wtag r">${n0} 帖</span>`;
  startWallFx(el);
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
let qTimer, qTries = 0;
async function showPartners(raw, push = true, poll = false) {
  const h = normHandle(raw), out = $("#pqOut");
  if (!poll) { clearTimeout(qTimer); qTries = 0; }
  if (!/^[a-z0-9_]{1,15}$/.test(h)) { out.innerHTML = `<div class="pres m">请输入有效的 X 用户名</div>`; return; }
  if (!poll) out.innerHTML = `<div class="pres m">查询中…</div>`;
  try {
    partnersP ||= fetch("partners.json", { cache: "no-cache" }).then(r => { if (!r.ok) throw 0; return r.json(); });
    const P = await partnersP, list = (P.users || {})[h];
    if (push) history.replaceState(null, "", `?u=${encodeURIComponent(h)}`);
    const t = P.updated_at ? new Date(P.updated_at).toLocaleString("zh-CN", { hour12: false, month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
    const note = `<div class="pnote">计算方法：${esc(P.method || "按最近回复和@次数")}（只统计最近的回复和 @，不含点赞）${t ? " · 更新于 " + t : ""}</div>`;
    PW = list?.length ? { h, list, extra: P.extra?.[h] || P.users_extra?.[h] || [], selfAv: P.profiles?.[h]?.avatar } : null; renderWall();
    if (!list?.length) { if (!poll) try { window.track?.("queue:" + h, "queue " + h); } catch (e) {}
      out.innerHTML = `<div class="pres"><h4>@${esc(h)}</h4><div>已加入收录队列，约 15 分钟出结果</div><div class="m">页面不用关，数据一到会自动显示${qTries ? `（已等 ${qTries} 分钟）` : ""}</div>${note}</div>`;
      if (qTries < 40) qTimer = setTimeout(() => { qTries++; partnersP = null; showPartners(h, false, true); }, 60000); return null; }
    clearTimeout(qTimer);
    out.innerHTML = `<div class="pres"><h4><span>@${esc(h)}</span> 的最佳互动账号 Top 3</h4>` +
      list.slice(0, 3).map((u, i) => `<a class="pu" href="${outUrl(profile(u.handle), "partner")}" target="_blank" rel="noopener">
        <div class="rk">${i + 1}</div><img class="av" loading="lazy" src="${esc(u.avatar || AV)}" alt="">
        <div class="n"><b>${esc(u.name || u.handle)}</b><br><span class="m">@${esc(u.handle)}</span></div>
        <div class="c">${num(u.count)}<small>次互动</small></div></a>`).join("") +
      `${note}<div class="pshare"><button type="button" class="btn ghost" id="pqCopy">复制链接</button><button type="button" class="btn" id="pqPoster">生成海报</button></div></div>`;
    const url = shareUrl(h);
    $("#pqCopy").onclick = async () => { try { await navigator.clipboard.writeText(url); } catch { const t = document.createElement("textarea"); t.value = url; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); } toast("已复制"); };
    $("#pqPoster").onclick = () => openPoster(h, list, url);
    return { h, list, url };
  } catch { partnersP = null; out.innerHTML = `<div class="pres m">数据加载失败，请稍后再试</div>`; }
}
function shareUrl(h) { const base = (C.SITE_URL && !/example\./.test(C.SITE_URL)) ? C.SITE_URL : location.origin + location.pathname; return base.replace(/[?#].*$/, "") + "?u=" + encodeURIComponent(h); }
function toast(s) { let t = $("#toast"); if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); } t.textContent = s; t.classList.add("on"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), 1600); }
const loadJS = src => new Promise((r, j) => { const s = document.createElement("script"); s.src = src; s.onload = r; s.onerror = j; document.head.appendChild(s); });
// 保存图片：在点击手势内同步调用 share（blob 已提前生成）；失败回退下载；iOS/内置浏览器提示长按保存
const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const inApp = /MicroMessenger|QQ\/|Weibo|FBAN|FBAV|Instagram|Line\//i.test(navigator.userAgent);
function saveImage(file, purl, box) {
  const hint = () => { const e = box?.querySelector(".pmh"); if (e) { e.textContent = "长按上方图片，选择「保存」或「存储图像」"; e.style.color = "#39ff14"; } toast("长按图片保存"); };
  const dl = () => { if (isIOS || inApp) return hint(); try { const a = document.createElement("a"); a.href = purl; a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); toast("已保存"); } catch { hint(); } };
  let ok = false; try { ok = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) && !!navigator.canShare?.({ files: [file] }); } catch {}
  if (!ok) return dl();
  let p; try { p = navigator.share({ files: [file] }); } catch (e) { return hint(); }   // 同步调用，保住用户手势
  p.catch(e => { if (e?.name !== "AbortError") hint(); });
}
let posterLib;
async function openPoster(h, list, url) {
  const m = document.createElement("div"); m.className = "pm"; m.innerHTML = `<div class="pmb"><div class="m" style="text-align:center;padding:40px">海报生成中…</div></div>`;
  document.body.appendChild(m); m.onclick = e => { if (e.target === m) m.remove(); };
  try {
    posterLib ||= Promise.all([loadJS("vendor/qrcode.js?v=" + AV_V), loadJS("poster.js?v=" + AV_V)]);
    await posterLib;
    const cv = await window.makePoster({ handle: h, list, url, self: selfAvatar(h) });
    const blob = await new Promise(r => cv.toBlob(r, "image/png")), file = new File([blob], `best-partners-${h}.png`, { type: "image/png" });
    const purl = URL.createObjectURL(blob);
    const xText = "我的 X 最佳互动账号 Top 3 出炉了，测测你的 👉 " + url;
    m.querySelector(".pmb").innerHTML = `<img src="${purl}" alt="海报"><div class="pmh">先保存海报，发帖时把图片加上</div>
      <div class="pmr"><button class="btn" id="pmSave">保存图片</button><a class="btn ghost" id="pmX" target="_blank" rel="noopener" href="https://x.com/intent/post?text=${encodeURIComponent(xText)}">发到 X</a><button class="btn ghost" id="pmClose">关闭</button></div>`;
    m.querySelector("#pmClose").onclick = () => m.remove();
    m.querySelector("#pmSave").onclick = () => saveImage(file, purl, m.querySelector(".pmb"));
  } catch (e) { m.querySelector(".pmb").innerHTML = `<div class="m" style="padding:30px;text-align:center">海报生成失败</div>`; }
}
// ---------- 个人照片墙动图（600×600，气泡轻浮动，24 帧 × 100ms 无缝循环） ----------
// 单张跨域污染 → 该头像用首字母
const wallImg = src => new Promise(res => { if (!src) return res(null); const im = new Image(); im.crossOrigin = "anonymous"; im.referrerPolicy = "no-referrer";
  const t = setTimeout(() => res(null), 4000); im.onload = () => { clearTimeout(t); try { const k = document.createElement("canvas"); k.width = k.height = 1; const x = k.getContext("2d"); x.drawImage(im, 0, 0, 1, 1); x.getImageData(0, 0, 1, 1); res(im); } catch { res(null); } }; im.onerror = () => { clearTimeout(t); res(null); }; im.src = src; });
async function makeWallGif(pw, prog) {
  const { GIFEncoder, quantize, applyPalette } = await import("./vendor/gifenc.esm.js?v=" + AV_V);
  const h = pw.h, all = wallPeople(pw), loaded = await Promise.all(all.map(u => wallImg(u.avatar)));
  const users = all.filter((u, i) => loaded[i] || u.self), ims = loaded.filter((im, i) => im || all[i].self);   // 失败头像去掉，只有中心保留首字母
  const S = 600, { H, items } = packCircles(users.length, S - 40, peopleRad(users));
  const cv = document.createElement("canvas"); cv.width = cv.height = S; const c = cv.getContext("2d", { willReadFrequently: true });
  const oy = (S - 30 - (H - 36)) / 2 - 0, ox = 20;
  const N = 36, RL = 14, OFF = [], RIP = [];   // 预算每帧漂移，相邻头像碰到的那一帧起两圈光环（循环无缝）
  for (let f = 0; f < N; f++) { const a = 2 * Math.PI * f / N; OFF.push(items.map((b, i) => { const A = Math.min(7, 3.5 + b.r * .06); return [A * Math.sin(a + i * 2.399), A * Math.cos(a + i * 4.08)]; })); }
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) { const p = items[i], q = items[j]; if (Math.hypot(p.x - q.x, p.y - q.y) - p.r - q.r > 15) continue;
    const on = f => { const [a1, b1] = OFF[f][i], [a2, b2] = OFF[f][j]; return Math.hypot(p.x + a1 - q.x - a2, p.y + b1 - q.y - b2) <= p.r + q.r + .5; };
    for (let f = 0; f < N; f++) if (on(f) && !on((f + N - 1) % N)) { const u = p.r / (p.r + q.r), [a1, b1] = OFF[f][i], [a2, b2] = OFF[f][j], x = p.x + a1 + (q.x + a2 - p.x - a1) * u, y = p.y + b1 + (q.y + b2 - p.y - b1) * u, s = Math.min(p.r, q.r);
      RIP.push({ f, x, y, s }, { f: (f + 4) % N, x, y, s }); } }
  const frame = (t, I) => {
    c.globalAlpha = 1; c.fillStyle = "#000"; c.fillRect(0, 0, S, S);
    const OF = OFF[Math.round(t * N) % N];
    items.forEach((b, i) => { const [dx, dy] = OF[i], x = ox + b.x + dx, y = oy + b.y + dy, u = users[i]; c.globalAlpha = b.o;
      c.save(); c.beginPath(); c.arc(x, y, b.r, 0, 7); c.clip();
      if (I[i]) c.drawImage(I[i], x - b.r, y - b.r, 2 * b.r, 2 * b.r); else { c.fillStyle = "#1d1f23"; c.fill(); c.fillStyle = "#39ff14"; c.font = `800 ${Math.max(9, b.r * .8)}px sans-serif`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(ini(u), x, y + 1); }
      c.restore(); c.lineWidth = u.self ? 3 : 2; c.strokeStyle = u.self ? "#39ff14" : "#fff"; c.beginPath(); c.arc(x, y, b.r, 0, 7); c.stroke(); });
    for (const f of RIP) { let age = (Math.round(t * N) - f.f + N) % N; if (age >= RL) continue; const k = age / RL, e = 1 - (1 - k) * (1 - k);
      c.globalAlpha = (1 - k) * .85; c.strokeStyle = "#39ff14"; c.lineWidth = 3 * (1 - k) + .8; c.beginPath(); c.arc(ox + f.x, oy + f.y, 5 + e * (f.s * 1.3 + 18), 0, 7); c.stroke(); }
    c.globalAlpha = .75; c.fillStyle = "#8b9095"; c.font = "500 15px sans-serif"; c.textAlign = "center"; c.textBaseline = "alphabetic";
    c.fillText(`@${h} 的互动圈 · 924950698.github.io/rank-site`, S / 2, S - 12); c.globalAlpha = 1;
  };
  const enc = GIFEncoder(); let pal;
  for (let f = 0; f < N; f++) {
    frame(f / N, ims); const px = c.getImageData(0, 0, S, S).data;
    if (!pal) pal = quantize(px, 256);
    enc.writeFrame(applyPalette(px, pal), S, S, { palette: f ? undefined : pal, delay: 110, repeat: 0 });
    prog?.((f + 1) / N); await new Promise(r => setTimeout(r));
  }
  enc.finish(); return new Blob([enc.bytes()], { type: "image/gif" });
}
window.__makeWallGif = makeWallGif;
async function openWallModal(pw) {
  const h = pw.h;
  const m = document.createElement("div"); m.className = "pm"; m.innerHTML = `<div class="pmb"><div class="m" style="text-align:center;padding:40px" id="wmProg">动图生成中…</div></div>`;
  document.body.appendChild(m); m.onclick = e => { if (e.target === m) m.remove(); };
  try {
    const gb = await makeWallGif(pw, p => { const e = m.querySelector("#wmProg"); if (e) e.textContent = `动图生成中… ${Math.round(p * 100)}%`; });
    const file = new File([gb], `wall-${h}.gif`, { type: "image/gif" }), purl = URL.createObjectURL(gb);
    const xText = "我的 X 互动照片墙出炉了，测测你的 👉 " + shareUrl(h);
    m.querySelector(".pmb").innerHTML = `<img src="${purl}" alt="互动照片墙"><div class="pmh">先保存图片，发帖时把图片加上</div>
      <div class="pmr"><button class="btn" id="wmSave">保存图片</button><a class="btn ghost" id="wmX" target="_blank" rel="noopener" href="https://x.com/intent/post?text=${encodeURIComponent(xText)}">发到 X</a><button class="btn ghost" id="wmClose">关闭</button></div>`;
    m.querySelector("#wmClose").onclick = () => m.remove();
    m.querySelector("#wmSave").onclick = () => saveImage(file, purl, m.querySelector(".pmb"));
  } catch { m.querySelector(".pmb").innerHTML = `<div class="m" style="padding:30px;text-align:center">动图生成失败</div>`; }
}
$("#pq").onsubmit = async e => { e.preventDefault(); const r = await showPartners($("#pqIn").value); document.querySelector("#wall,.wall,canvas")?.scrollIntoView({ behavior: "smooth", block: "start" }); if (r) openWallModal(PW); };
$("#pqPost").onclick = async () => { const r = await showPartners($("#pqIn").value); if (r) openPoster(r.h, r.list, r.url); };
{ const u = new URLSearchParams(location.search).get("u"); if (u) { $("#pqIn").value = "@" + normHandle(u); showPartners(u, false); } }

// ---------- 启动 ----------
fetch("data.json", { cache: "no-cache" }).then(r => r.json()).then(d => { D = d; render(); })
  .catch(() => { $("#list").innerHTML = `<div class="empty">数据加载失败，请稍后刷新</div>`; });
})();

// ---------- 按钮埋点（GoatCounter 事件） ----------
(() => {
  const code = (window.APP_CONFIG || {}).GC_CODE;
  if (code) { const s = document.createElement("script"); s.async = true; s.src = "https://gc.zgo.at/count.js"; s.dataset.goatcounter = `https://${code}.goatcounter.com/count`; document.head.appendChild(s); }
  const name = el => el.dataset.ev || (el.id ? el.id : "") || [el.dataset.t, el.dataset.s, el.dataset.src].filter(Boolean).join("-") || (el.textContent || "").trim().slice(0, 20) || "unknown";
  window.track = (ev, title) => { const n = "ev-" + ev; if (window.goatcounter?.count) goatcounter.count({ path: n, title: title || ev, event: true }); else (window._evq ||= []).push(n); };
  document.addEventListener("click", e => { const el = e.target.closest("button,a,.pu,canvas"); if (!el) return; const sec = el.closest("section,header,footer,form,.pm")?.id || el.closest(".pm") && "poster" || ""; track((sec ? sec + ":" : "") + name(el), (el.textContent || "").trim().slice(0, 30)); }, true);
})();
