// 首页 / YouTube / Web3 共用：GoatCounter 统计（与 X 模块同一个站点代码 tigerrank）+ 小工具
(() => {
  const code = (window.APP_CONFIG || {}).GC_CODE;
  if (code && !document.querySelector("script[data-goatcounter]")) {
    const s = document.createElement("script"); s.async = true; s.src = "https://gc.zgo.at/count.js";
    s.dataset.goatcounter = `https://${code}.goatcounter.com/count`; document.head.appendChild(s);
  }
  const _tk = {};
  window.track = (ev, title) => { const n = "ev-" + ev, now = Date.now(); if (now - (_tk[n] || 0) < 5000) return; _tk[n] = now;
    if (window.goatcounter?.count) goatcounter.count({ path: n, title: title || ev, event: true }); };
  document.addEventListener("click", e => { const a = e.target.closest("a[data-ev],button[data-ev]"); if (a) track(a.dataset.ev, (a.textContent || "").trim().slice(0, 30)); }, true);
  window.MP = {
    esc: s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
    safeUrl: u => { try { const x = new URL(u); return x.protocol === "https:" && !x.username && !x.password ? x.href : ""; } catch { return ""; } },
    fmtDate: (iso, withTime) => { const t = new Date(iso); if (isNaN(t)) return "";
      return t.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false, year: "numeric", month: "long", day: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) }); },
    json: p => fetch(p, { cache: "no-cache" }).then(r => r.ok ? r.json() : Promise.reject(r.status)),
  };
})();
