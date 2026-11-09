// 热门话题检测：中文热点（近 6 小时中文帖聚合，见 scripts/zh_trends_*.py），无数据显示空状态
(function () {
  const sec = document.getElementById("trendSec"); if (!sec) return;
  const ol = sec.querySelector("ol"), upd = sec.querySelector(".tu"), more = sec.querySelector(".more");
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let items = [], open = false;
  function render() {
    if (!items.length) { ol.innerHTML = '<li class="em m">暂无热点数据</li>'; more.hidden = true; return; }
    const show = open ? items : items.slice(0, 10);
    ol.innerHTML = show.map((t, i) => `<li><a href="https://x.com/search?q=${encodeURIComponent(t.name)}&f=top" target="_blank" rel="noopener" data-src="trend"><span class="n">${i + 1}</span><span class="t">${esc(t.name)}${t.related && t.related.length ? `<small>${t.related.map(esc).join(" · ")}</small>` : ""}</span><span class="c">🔥${t.heat} · ${t.count} 帖</span></a>${t.rep ? `<a class="rp" href="${esc(t.rep)}" target="_blank" rel="noopener" data-src="trend_rep">代表帖 →</a>` : ""}</li>`).join("");
    more.hidden = items.length <= 10; more.textContent = open ? "收起 ↑" : `查看全部 ${items.length} 个 ↓`;
  }
  more.onclick = () => { open = !open; render(); };
  fetch("trends.json?t=" + Date.now()).then(r => r.ok ? r.json() : null).catch(() => null).then(j => {
    items = (j && j.topics) || [];
    if (j && j.updated) upd.textContent = new Date(j.updated).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }) + " 北京时间更新";
    render();
  });
})();
