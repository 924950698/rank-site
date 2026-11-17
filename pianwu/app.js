const key = 'markpump.pianwu.v1';
const zone = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' });
const monthLabel = new Intl.DateTimeFormat('zh-CN', { timeZone: 'UTC', year: 'numeric', month: 'long' });
const view = document.querySelector('#view');
const notice = document.querySelector('#notice');
const editor = document.querySelector('#editor');
const form = document.querySelector('#work-form');
const error = document.querySelector('#form-error');
const pages = new Set(['board', 'calendar', 'archive']);
const platforms = {
  douyin: { name: '抖音', domains: ['douyin.com', 'www.douyin.com', 'v.douyin.com'], views: '播放' },
  youtube: { name: 'YouTube', domains: ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'], views: '播放' },
  x: { name: 'X', domains: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com'], views: '浏览' }
};
const ids = Object.keys(platforms);
const counts = new Intl.NumberFormat('zh-CN');
const fields = document.querySelector('#platform-fields');
const metricLabels = { views: '播放 / 浏览', likes: '点赞', comments: '评论 / 回复' };
const metrics = Object.keys(metricLabels);
fields.innerHTML = ids.map(id => '<details data-platform="' + id + '"><summary>' + platforms[id].name +
  '</summary><label>作品链接<input type="url" name="' + id + '"></label><div class="metric-fields">' +
  metrics.map(metric => '<label>' + metricLabels[metric] + '<input type="number" name="' + id + '-' + metric +
    '" min="0" max="9007199254740991" step="1" inputmode="numeric"></label>').join('') + '</div></details>'
).join('');
let works;
try {
  works = JSON.parse(localStorage.getItem(key) || '[]');
  if (!Array.isArray(works)) throw new Error();
} catch {
  works = [];
  notice.textContent = '无法读取本机记录。';
  notice.hidden = false;
}
let editing = null;
let month = zone.format().slice(0, 7);

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function platformLink(platform, text) {
  if (!text) return '';
  let url;
  try { url = new URL(text); } catch {}
  const { name, domains } = platforms[platform];
  if (!url || url.protocol !== 'https:' || url.username || url.password || url.port || !domains.includes(url.hostname) ||
      (platform === 'x' && !/^\/[^/]+(?:\/web)?\/status\/\d+\/?$/.test(url.pathname))) {
    throw new Error('请填写 ' + name + ' 的 HTTPS 作品链接。');
  }
  return url.href;
}

function status(work) {
  const linked = ids.filter(id => work[id]).length;
  if (linked) return '已登记 ' + linked + ' / ' + ids.length + ' 个平台';
  return work.date ? '已排期' : '待排期';
}

function editButton(work, label = '编辑') {
  return '<button type="button" data-edit="' + esc(work.id) + '" title="' + esc(work.title) + '">' + esc(label) + '</button>';
}

function list(items, showLinks = false) {
  if (!items.length) return '<p class="card muted">暂无作品。</p>';
  return '<div class="work-list">' + items.map(work => {
    const links = showLinks ? Object.entries(platforms).map(([id, {name}]) => {
      try {
        const url = platformLink(id, work[id]);
        return url ? '<a target="_blank" rel="noopener" href="' + esc(url) + '">' + name + ' ↗</a>' : '';
      } catch { return ''; }
    }).join(' ') : '';
    return '<article class="card work"><div><h3>' + esc(work.title) + '</h3><p class="muted">' +
      esc(work.date || '未排期') + ' · ' + status(work) + '</p>' +
      (showLinks && work.notes ? '<p>' + esc(work.notes) + '</p>' : '') + '<div class="actions">' + links +
      '</div></div>' + editButton(work) + '</article>';
  }).join('') + '</div>';
}

function platformCard(id) {
  const {name, views} = platforms[id];
  const entries = works.filter(work => work[id]);
  const labels = [views, '点赞', id === 'x' ? '回复' : '评论'];
  const summary = metrics.map((metric, index) => {
    const numbers = entries.map(work => work.metrics?.[id]?.[metric]).filter(Number.isSafeInteger);
    const total = numbers.length ? counts.format(numbers.reduce((sum, n) => sum + BigInt(n), 0n)) : '—';
    return '<div><dt>' + labels[index] + '</dt><dd>' + total + '</dd></div>';
  }).join('');
  const recent = entries.slice(0, 3).map(work => {
    let url;
    try { url = platformLink(id, work[id]); } catch { return ''; }
    return '<li><a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(work.title) +
      ' ↗</a>' + editButton(work, '录数据') + '</li>';
  }).join('');
  return '<article class="card"><h3>' + name + '</h3><p class="muted">已登记 ' + entries.length +
    ' 条作品</p><dl class="platform-metrics">' + summary + '</dl>' +
    (recent ? '<ul class="platform-recent">' + recent + '</ul>' : '<p class="muted">在作品里登记链接后显示。</p>') + '</article>';
}

function board() {
  const stats = [['全部作品', works.length], ['待排期', works.filter(work => !work.date && !ids.some(id => work[id])).length],
    ['三平台已登记', works.filter(work => ids.every(id => work[id])).length]];
  return '<h2>作品进度</h2><div class="stats">' + stats.map(([name, count]) =>
    '<div class="card stat"><span class="muted">' + name + '</span><strong>' + count + '</strong></div>'
  ).join('') + '</div><h2>平台表现</h2><p class="muted">指标按已录入的数据汇总。</p><div class="platform-grid">' +
    ids.map(platformCard).join('') + '</div><h2>最近编辑</h2>' + list(works.slice(0, 4));
}

function calendar() {
  const [year, number] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year, number - 1, 1));
  const start = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const today = zone.format();
  const headers = [...'一二三四五六日'].map(label => '<div class="weekday muted">' + label + '</div>').join('');
  const cells = Array.from({ length: days }, (_, i) => {
    const date = month + '-' + String(i + 1).padStart(2, '0');
    return '<div class="day' + (date === today ? ' today' : '') + '"><time datetime="' + date + '">' + (i + 1) +
      '</time>' + works.filter(work => work.date === date).map(work => editButton(work, work.title)).join('') + '</div>';
  }).join('');
  const waiting = works.filter(work => !work.date && !ids.some(id => work[id]));
  return '<div class="cal-head"><h2>' + monthLabel.format(first) + '</h2><div class="actions">' +
    '<button data-month="-1">上个月</button><button data-month="1">下个月</button></div></div><div class="calendar">' +
    headers + '<div aria-hidden="true"></div>'.repeat(start) + cells + '</div>' +
    '<div class="unscheduled"><h2>待排期</h2>' + list(waiting) + '</div>';
}

function render() {
  const hash = location.hash.slice(1);
  const page = pages.has(hash) ? hash : 'board';
  for (const link of document.querySelectorAll('nav a')) {
    if (link.hash === '#' + page) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  view.innerHTML = page === 'board' ? board() : page === 'calendar' ? calendar() : '<h2>作品档案</h2>' + list(works, true);
}

function open(work) {
  editing = work?.id ?? null;
  form.reset();
  error.hidden = true;
  document.querySelector('#editor-title').textContent = editing ? '编辑作品' : '新建作品';
  for (const name of ['title', 'date', ...ids, 'notes']) form.elements.namedItem(name).value = work?.[name] ?? '';
  for (const id of ids) {
    fields.querySelector('[data-platform=' + id + ']').open = Boolean(work?.[id]);
    for (const metric of metrics) form.elements.namedItem(id + '-' + metric).value = work?.metrics?.[id]?.[metric] ?? '';
  }
  editor.showModal();
}

document.querySelector('#add').addEventListener('click', () => open());
document.querySelector('#cancel').addEventListener('click', () => editor.close());
view.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.edit) open(works.find(work => work.id === button.dataset.edit));
  if (button.dataset.month) {
    const [year, number] = month.split('-').map(Number);
    month = new Date(Date.UTC(year, number - 1 + Number(button.dataset.month), 1)).toISOString().slice(0, 7);
    render();
  }
});
form.addEventListener('invalid', event => {
  const panel = event.target.closest('details');
  if (panel) panel.open = true;
}, true);
form.addEventListener('submit', event => {
  event.preventDefault();
  const entry = Object.fromEntries(new FormData(form));
  try {
    entry.title = entry.title.trim();
    if (!entry.title) throw new Error('请填写作品标题。');
    entry.metrics = {};
    for (const id of ids) {
      entry[id] = platformLink(id, entry[id].trim());
      entry.metrics[id] = {};
      for (const metric of metrics) {
        const field = id + '-' + metric;
        const raw = entry[field].trim();
        delete entry[field];
        if (!raw) continue;
        const value = Number(raw);
        if (!entry[id]) throw new Error('请先登记 ' + platforms[id].name + ' 的作品链接。');
        if (!Number.isSafeInteger(value) || value < 0) throw new Error('指标请填写非负整数。');
        entry.metrics[id][metric] = value;
      }
    }
    entry.id = editing || crypto.randomUUID();
    const next = [entry, ...works.filter(work => work.id !== entry.id)];
    localStorage.setItem(key, JSON.stringify(next));
    works = next;
    editor.close();
    if (entry.date && location.hash === '#calendar') month = entry.date.slice(0, 7);
    notice.textContent = '已保存「' + entry.title + '」。';
    notice.hidden = false;
    render();
  } catch (failure) {
    error.textContent = failure.message || '保存失败。';
    error.hidden = false;
  }
});
window.addEventListener('hashchange', render);
render();
