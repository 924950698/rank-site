const key = 'markpump.pianwu.v1';
const zone = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' });
const monthLabel = new Intl.DateTimeFormat('zh-CN', { timeZone: 'UTC', year: 'numeric', month: 'long' });
const view = document.querySelector('#view');
const notice = document.querySelector('#notice');
const editor = document.querySelector('#editor');
const form = document.querySelector('#work-form');
const error = document.querySelector('#form-error');
const pages = new Set(['board', 'calendar', 'archive']);
const platforms = { douyin: '抖音', youtube: 'YouTube' };
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
  const url = new URL(text);
  const domains = platform === 'douyin' ? ['douyin.com', 'www.douyin.com', 'v.douyin.com'] : ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'];
  if (url.protocol !== 'https:' || url.username || url.password || !domains.includes(url.hostname)) {
    throw new Error('请填写 ' + platforms[platform] + ' 的 HTTPS 链接。');
  }
  return url.href;
}

function status(work) {
  if (work.douyin && work.youtube) return '两平台已登记';
  if (work.douyin || work.youtube) return '已登记一个平台';
  return work.date ? '已排期' : '待排期';
}

function editButton(work, label = '编辑') {
  return '<button type="button" data-edit="' + esc(work.id) + '" title="' + esc(work.title) + '">' + esc(label) + '</button>';
}

function list(items, showLinks = false) {
  if (!items.length) return '<p class="card muted">暂无作品。</p>';
  return '<div class="work-list">' + items.map(work => {
    const links = showLinks ? Object.entries(platforms).map(([id, name]) => {
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

function board() {
  const stats = [['全部作品', works.length], ['待排期', works.filter(work => !work.date && !work.douyin && !work.youtube).length],
    ['两平台已登记', works.filter(work => work.douyin && work.youtube).length]];
  return '<h2>作品进度</h2><div class="stats">' + stats.map(([name, count]) =>
    '<div class="card stat"><span class="muted">' + name + '</span><strong>' + count + '</strong></div>'
  ).join('') + '</div><h2>最近编辑</h2>' + list(works.slice(0, 4));
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
  const waiting = works.filter(work => !work.date && !work.douyin && !work.youtube);
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
  for (const name of ['title', 'date', 'douyin', 'youtube', 'notes']) form.elements.namedItem(name).value = work?.[name] ?? '';
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
form.addEventListener('submit', event => {
  event.preventDefault();
  const entry = Object.fromEntries(new FormData(form));
  try {
    entry.title = entry.title.trim();
    if (!entry.title) throw new Error('请填写作品标题。');
    for (const platform of Object.keys(platforms)) entry[platform] = platformLink(platform, entry[platform].trim());
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
