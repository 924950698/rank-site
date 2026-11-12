(function () {
  const sec = document.getElementById("trendSec"); if (!sec) return;
  const ol = sec.querySelector("ol"), upd = sec.querySelector(".tu"), more = sec.querySelector(".more");
  const intro = sec.querySelector(".trend-intro");
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const format = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const counts = new Intl.NumberFormat("zh-CN");
  const validLink = url => /^https:\/\/x\.com\/(?:[A-Za-z0-9_]+|i\/web)\/status\/\d+$/.test(url);
  let items = [], open = false, stale = false;
  function render() {
    ol.innerHTML = "";
    more.hidden = !items.length || (!stale && items.length <= 3);
    more.textContent = open ? "收起话题 ↑" : stale ? "查看上次话题 ↓" : `查看全部 ${items.length} 个话题 ↓`;
    more.setAttribute("aria-expanded", String(open));
    if (!items.length || (stale && !open)) return;
    const seen = new Set();
    const show = open ? items : items.slice(0, 3);
    ol.innerHTML = show.map(t => {
      const examples = Array.isArray(t.examples) ? t.examples : t.rep ? [{url: t.rep}] : [];
      const refs = examples.filter(p => {
        if (!validLink(p.url) || seen.has(p.url)) return false;
        seen.add(p.url); return true;
      }).map((p, i) => {
        const date = p.created_at && new Date(p.created_at);
        const meta = [Number.isFinite(p.views) ? `${counts.format(p.views)} 浏览` : "", date && Number.isFinite(+date) ? format.format(date) : ""].filter(Boolean).join(" · ");
        return `<a href="${p.url}" target="_blank" rel="noopener" data-src="trend_rep" aria-label="${esc(t.name)} 参考帖 ${i + 1}">参考帖 ${i + 1}${meta ? `<small>${meta}</small>` : ""}</a>`;
      }).join("");
      const stats = [Number.isFinite(t.authors) ? `${counts.format(t.authors)} 个账号` : "", Number.isFinite(t.count) ? `${counts.format(t.count)} 帖` : ""].filter(Boolean).join(" · ");
      return `<li><div class="trend-row"><b>${esc(t.name)}</b><span>${stats}</span></div><div class="trend-links">${refs}<a href="https://x.com/search?q=${encodeURIComponent(t.name)}&amp;f=live" target="_blank" rel="noopener" data-src="trend" aria-label="查看 ${esc(t.name)} 的最新讨论">看最新讨论 ↗</a></div></li>`;
    }).join("");
  }
  more.onclick = () => { open = !open; render(); };
  fetch("trends.json", {cache: "no-cache"}).then(r => r.ok ? r.json() : null).catch(() => null).then(j => {
    items = Array.isArray(j?.topics) ? j.topics : [];
    const updated = j?.updated ? new Date(j.updated) : null;
    stale = !updated || !Number.isFinite(+updated) || Date.now() - +updated >= 2 * 60 * 60 * 1000;
    upd.textContent = updated && Number.isFinite(+updated) ? `${format.format(updated)} 更新（北京时间）` : "";
    if (!items.length) intro.textContent = "暂时没有可用的热点数据，可以先看下面的曝光榜。";
    else if (stale) intro.textContent = "热点更新延迟。下方曝光榜仍可查看，也可以展开上次的话题。";
    render();
  });
})();
