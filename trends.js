// 热门话题检测：读取 trends.json（X /2/trends/by/woeid），无数据显示空状态
(function () {
  const sec = document.getElementById("trendSec"); if (!sec) return;
  const sw = sec.querySelector(".sw"), ol = sec.querySelector("ol"), upd = sec.querySelector(".tu"), more = sec.querySelector(".more");
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = n => n >= 1e4 ? (n / 1e4).toFixed(1).replace(/\.0$/, "") + " 万帖" : n + " 帖";
  let data = null, cur = 0, open = false;
  function render() {
    const r = data && data.regions && data.regions[cur], items = (r && r.items) || [];
    if (!items.length) { ol.innerHTML = '<li class="em m">暂无趋势数据</li>'; more.hidden = true; return; }
    const show = open ? items : items.slice(0, 10);
    ol.innerHTML = show.map((t, i) => `<li><a href="https://x.com/search?q=${encodeURIComponent(t.name)}" target="_blank" rel="noopener" data-src="trend"><span class="n">${i + 1}</span><span class="t">${esc(t.name)}</span>${t.count ? `<span class="c">${fmt(t.count)}</span>` : ""}</a></li>`).join("");
    more.hidden = items.length <= 10; more.textContent = open ? "收起 ↑" : `查看全部 ${items.length} 个 ↓`;
  }
  more.onclick = () => { open = !open; render(); };
  fetch("trends.json?t=" + Date.now()).then(r => r.ok ? r.json() : null).catch(() => null).then(j => {
    data = j;
    const regs = (j && j.regions) || [];
    sw.innerHTML = regs.map((r, i) => `<button type="button" data-i="${i}"${i ? "" : ' class="on"'}>${esc(r.name)}</button>`).join("");
    sw.onclick = e => { const b = e.target.closest("button"); if (!b) return; cur = +b.dataset.i; open = false; sw.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); render(); };
    if (j && j.updated) upd.textContent = new Date(j.updated).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }) + " 北京时间更新";
    render();
  });
})();
