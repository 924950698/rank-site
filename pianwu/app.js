const key = 'markpump.pianwu.v1';
const zone = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' });
const monthLabel = new Intl.DateTimeFormat('zh-CN', { timeZone: 'UTC', year: 'numeric', month: 'long' });
const view = document.querySelector('#view');
const notice = document.querySelector('#notice');
const editor = document.querySelector('#editor');
const form = document.querySelector('#work-form');
const error = document.querySelector('#form-error');
const videoInput = document.querySelector('#work-video');
const videoInfo = document.querySelector('#video-info');
const videoLabel = document.querySelector('#video-label');
const videoPreview = document.querySelector('#video-preview');
const saveButton = form.querySelector('button[type="submit"]');
let saving = false;
let database;

function mediaDatabase() {
  if (!database) {
    database = new Promise((resolve, reject) => {
      const request = indexedDB.open('markpump.pianwu.media', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('videos');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).catch(error => { database = null; throw error; });
  }
  return database;
}

async function videoRequest(mode, operation) {
  const db = await mediaDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('videos', mode);
    const request = operation(transaction.objectStore('videos'));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onabort = () => reject(transaction.error || request.error || new Error('视频存储已中断'));
    transaction.onerror = () => reject(transaction.error || request.error);
  });
}

function videoMeta(file, id) {
  return { id, name: file.name, size: file.size };
}

function videoStatus(work, selected) {
  const media = selected ? videoMeta(selected) : work?.video;
  videoLabel.textContent = work?.video ? '更换成片' : '导入成片（可选）';
  videoInfo.textContent = media ? (selected ? '待保存 · ' : '已保存 · ') + media.name + ' · ' +
    new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(media.size / 1024 ** 2) + ' MB'
    : work?.missingVideoName ? '待重新导入成片 · ' + work.missingVideoName : '选择 MP4、MOV 或 WebM。视频保存在当前浏览器。';
  videoPreview.hidden = !work?.video;
}
const pages = new Set(['board', 'calendar', 'archive']);
const platforms = {
  douyin: { name: '抖音', domains: ['douyin.com', 'www.douyin.com', 'v.douyin.com'], views: '播放' },
  youtube: { name: 'YouTube', domains: ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'], views: '播放' },
  x: { name: 'X', domains: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com'], views: '浏览' }
};
const ids = Object.keys(platforms);
const counts = new Intl.NumberFormat('zh-CN');
const recordedAt = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});
const fields = document.querySelector('#platform-fields');
const metricLabels = { views: '播放 / 浏览', likes: '点赞', comments: '评论 / 回复' };
const metrics = Object.keys(metricLabels);
fields.innerHTML = ids.map(id => '<details data-platform="' + id + '"><summary>' + platforms[id].name +
  '</summary><label>作品链接<input type="url" name="' + id + '"></label><div class="metric-fields">' +
  metrics.map(metric => '<label>' + metricLabels[metric] + '<input type="number" name="' + id + '-' + metric +
    '" min="0" max="9007199254740991" step="1" inputmode="numeric"></label>').join('') + '</div><div data-metric-history></div></details>'
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
let selectedWork = null;
let packageInput = null;
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

function list(items) {
  if (!items.length) return '<p class="card muted">暂无作品。</p>';
  return '<div class="work-list">' + items.map(work =>
    '<article class="card work"><div><h3>' + esc(work.title) + '</h3><p class="muted">' +
    esc(work.date || '未排期') + ' · ' + status(work) + '</p></div>' + editButton(work) + '</article>'
  ).join('') + '</div>';
}

function archive() {
  const heading = '<h2>片库 <span class="muted">' + works.length + ' 部作品</span></h2>';
  const work = works.find(item => item.id === selectedWork) || works[0];
  if (!work) {
    return heading + '<p class="card muted">暂无作品。可以新建作品或导入工作室作品包。</p>';
  }
  selectedWork = work.id;
  const choices = works.map(item =>
    '<button type="button" data-select="' + esc(item.id) + '" aria-pressed="' + (item.id === work.id) +
    '"><strong>' + esc(item.title) + '</strong><span class="muted">' +
    esc(item.date || '未排期') + ' · ' + status(item) + '</span></button>'
  ).join('');
  const details = ids.map(id => {
    const {name, views} = platforms[id];
    let url = '';
    try { url = platformLink(id, work[id]); } catch {}
    const labels = [views, '点赞', id === 'x' ? '回复' : '评论'];
    const numbers = metrics.map((metric, index) => {
      const value = work.metrics?.[id]?.[metric];
      return '<div><dt>' + labels[index] + '</dt><dd>' + (Number.isSafeInteger(value) ? counts.format(value) : '—') + '</dd></div>';
    }).join('');
    return '<article class="card"><h4>' + name + '</h4>' +
      (url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">查看作品 ↗</a>' : '<span class="muted">未登记链接</span>') +
      '<dl class="platform-metrics">' + numbers + '</dl></article>';
  }).join('');
  return heading + '<div class="archive-layout"><div class="archive-list" role="group" aria-label="选择作品">' + choices +
    '</div><section class="card archive-detail" aria-labelledby="selected-title"><div class="archive-head"><div>' +
    '<h3 id="selected-title">' + esc(work.title) + '</h3><p class="muted">' + esc(work.date || '未排期') + ' · ' +
    status(work) + '</p></div>' + editButton(work, '编辑作品') + '</div>' +
    (work.video ? '<p class="muted">成片 · ' + esc(work.video.name) + '</p>' :
      work.missingVideoName ? '<p class="muted">待重新导入成片 · ' + esc(work.missingVideoName) + '</p>' : '') +
    (work.notes ? '<p class="archive-notes">' + esc(work.notes) + '</p>' : '') +
    '<div class="platform-grid archive-platforms">' + details + '</div></section></div>';
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
  ).join('') + '</div><h2>平台表现</h2><p class="muted">指标按各作品最后保存的数据汇总。通过「录数据」可查看历史。</p><div class="platform-grid">' +
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
  view.innerHTML = page === 'board' ? board() : page === 'calendar' ? calendar() : archive();
}

function sameMetrics(a, b) {
  return metrics.every(metric => a?.[metric] === b?.[metric]);
}

function metricHistory(work, id) {
  const history = work?.history?.[id];
  if (Array.isArray(history)) return history;
  const values = work?.metrics?.[id];
  return work?.[id] && values && metrics.some(key => Number.isSafeInteger(values[key]))
    ? [{ url: work[id], at: null, values }] : [];
}

function historyTable(work, id) {
  const rows = metricHistory(work, id).filter(sample => sample.url === work?.[id]);
  if (!rows.length) return '';
  const labels = [platforms[id].views, '点赞', id === 'x' ? '回复' : '评论'];
  return '<h3 class="history-title">最近录入</h3><div class="history-scroll"><table class="history-table"><thead><tr>' +
    ['北京时间', ...labels].map(label => '<th scope="col">' + label + '</th>').join('') +
    '</tr></thead><tbody>' + rows.slice(0, 6).map(sample => {
      const date = sample.at ? new Date(sample.at) : null;
      return '<tr><td>' + (date && Number.isFinite(+date) ? recordedAt.format(date) : '旧记录') + '</td>' +
        metrics.map(metric => '<td>' + (Number.isSafeInteger(sample.values?.[metric]) ? counts.format(sample.values[metric]) : '—') + '</td>').join('') +
        '</tr>';
    }).join('') + '</tbody></table></div>';
}

function open(work, imported = null) {
  editing = work?.id ?? null;
  packageInput = imported;
  form.reset();
  error.hidden = true;
  document.querySelector('#editor-title').textContent = editing ? '编辑作品' : '新建作品';
  for (const name of ['title', 'date', ...ids, 'notes']) form.elements.namedItem(name).value = work?.[name] ?? '';
  for (const id of ids) {
    const panel = fields.querySelector('[data-platform=' + id + ']');
    panel.open = Boolean(work?.[id]);
    panel.querySelector('[data-metric-history]').innerHTML = historyTable(work, id);
    for (const metric of metrics) form.elements.namedItem(id + '-' + metric).value = work?.metrics?.[id]?.[metric] ?? '';
  }
  if (imported && !work) form.elements.namedItem('title').value = imported.title;
  videoStatus(work, imported?.file);
  editor.showModal();
}

document.querySelector('#add').addEventListener('click', () => open());
document.querySelector('#cancel').addEventListener('click', () => { if (!saving) editor.close(); });
editor.addEventListener('cancel', event => { if (saving) event.preventDefault(); });
videoInput.addEventListener('change', () => {
  if (videoInput.files.length && packageInput) packageInput.file = null;
  videoStatus(works.find(work => work.id === editing), videoInput.files[0] || packageInput?.file);
});
videoPreview.addEventListener('click', async () => {
  const video = works.find(work => work.id === editing)?.video;
  if (!video) return;
  const tab = window.open('', '_blank');
  if (!tab) {
    error.textContent = '浏览器拦截了新窗口，请允许弹窗后重试。';
    error.hidden = false;
    return;
  }
  tab.opener = null;
  try {
    const file = await videoRequest('readonly', store => store.get(video.id));
    if (!file) throw new Error('当前浏览器里找不到成片，请重新导入。');
    const url = URL.createObjectURL(file);
    tab.location.replace(url);
    const release = setInterval(() => {
      if (!tab.closed) return;
      URL.revokeObjectURL(url);
      clearInterval(release);
    }, 1000);
  } catch (failure) {
    tab.close();
    error.textContent = failure.message || '打开成片失败。';
    error.hidden = false;
  }
});
view.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.hasAttribute('data-select')) {
    const scroll = button.parentElement.scrollTop;
    selectedWork = button.dataset.select;
    render();
    const selected = view.querySelector('[aria-pressed="true"]');
    if (selected) {
      selected.parentElement.scrollTop = scroll;
      selected.focus({preventScroll: true});
    }
  }
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
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (saving) return;
  saving = true;
  saveButton.disabled = true;
  saveButton.textContent = '保存中…';
  error.hidden = true;
  let stagedVideo;
  const file = videoInput.files[0] || packageInput?.file;
  const entry = Object.fromEntries(new FormData(form));
  try {
    entry.title = entry.title.trim();
    if (!entry.title) throw new Error('请填写作品标题。');
    const previous = works.find(work => work.id === editing);
    const now = new Date().toISOString();
    entry.metrics = {};
    entry.history = {};
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
      const history = metricHistory(previous, id);
      const values = entry.metrics[id];
      const changed = previous?.[id] !== entry[id] || !sameMetrics(previous?.metrics?.[id], values);
      entry.history[id] = changed && entry[id] && Object.keys(values).length
        ? [{ url: entry[id], at: now, values }, ...history].slice(0, 30)
        : history;
    }
    entry.id = editing || packageInput?.id || crypto.randomUUID();
    if (packageInput?.preset || previous?.preset) entry.preset = packageInput?.preset || previous.preset;
    if (file) {
      if (!file.size || !/\.(mp4|mov|webm)$/i.test(file.name)) throw new Error('请选择有效的 MP4、MOV 或 WebM 视频。');
      stagedVideo = crypto.randomUUID();
      await videoRequest('readwrite', store => store.put(file, stagedVideo));
      entry.video = videoMeta(file, stagedVideo);
    } else if (previous?.video) {
      entry.video = previous.video;
    } else if (previous?.missingVideoName) {
      entry.missingVideoName = previous.missingVideoName;
    }
    const next = [entry, ...works.filter(work => work.id !== entry.id)];
    localStorage.setItem(key, JSON.stringify(next));
    works = next;
    if (stagedVideo && previous?.video) {
      videoRequest('readwrite', store => store.delete(previous.video.id)).catch(() => {});
    }
    stagedVideo = undefined;
    editor.close();
    if (entry.date && location.hash === '#calendar') month = entry.date.slice(0, 7);
    notice.textContent = '已保存「' + entry.title + '」。';
    notice.hidden = false;
    render();
  } catch (failure) {
    if (stagedVideo) await videoRequest('readwrite', store => store.delete(stagedVideo)).catch(() => {});
    error.textContent = failure.name === 'QuotaExceededError'
      ? '浏览器剩余空间不足，换一份更小的成片再试。'
      : failure.message || '保存失败。';
    error.hidden = false;
  } finally {
    saving = false;
    saveButton.disabled = false;
    saveButton.textContent = '保存作品';
  }
});
function showNotice(message) {
  notice.textContent = message;
  notice.hidden = false;
}

function checkedString(value, max, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    throw new Error('文件中的作品信息格式不正确。');
  }
  return value;
}

function checkedId(id) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(id)) throw new Error('作品编号格式不正确。');
  return id;
}

async function unpackWork(file) {
  if (file.size <= 24) throw new Error('作品包内容不完整。');
  const footer = await file.slice(-12).arrayBuffer();
  const magic = new TextDecoder().decode(footer.slice(4));
  const size = new DataView(footer).getUint32(0, true);
  const end = file.size - size - 12;
  if (magic !== 'PUMP0001' || !size || size > 16384 || end < 12) throw new Error('请选择有效的 Pump 作品包。');
  const data = JSON.parse(await file.slice(end, -12).text());
  if (data.type !== 'pump-work' || data.version !== 1) throw new Error('作品包版本不支持。');
  const videoName = checkedString(data.videoName, 128, true);
  if (!/^[^\\/]+\.mp4$/i.test(videoName)) throw new Error('作品包没有有效的 MP4 成片。');
  const signature = await file.slice(4, 8).text();
  if (signature !== 'ftyp') throw new Error('作品包内的 MP4 格式不正确。');
  return {
    id: 'studio-' + checkedId(data.id), title: checkedString(data.title, 160, true),
    preset: checkedString(data.preset || '', 80),
    file: new File([file.slice(0, end)], videoName, { type: 'video/mp4' })
  };
}

function backupMetrics(values) {
  const copy = {};
  for (const metric of metrics) {
    const value = values?.[metric];
    if (Number.isSafeInteger(value) && value >= 0) copy[metric] = value;
  }
  return copy;
}

function readBackupWork(input) {
  const work = {
    id: checkedId(input.id),
    title: checkedString(input.title, 160, true),
    date: checkedString(input.date || '', 10),
    notes: checkedString(input.notes || '', 2000),
    metrics: {}, history: {}
  };
  if (work.date && !/^\d{4}-\d{2}-\d{2}$/.test(work.date)) throw new Error('备份日期格式不正确。');
  if (input.preset) work.preset = checkedString(input.preset, 80);
  const videoName = input.missingVideoName || input.video?.name;
  if (videoName) work.missingVideoName = checkedString(videoName, 255);
  for (const id of ids) {
    work[id] = platformLink(id, checkedString(input[id] || '', 2000));
    work.metrics[id] = work[id] ? backupMetrics(input.metrics?.[id]) : {};
    work.history[id] = metricHistory(input, id).slice(0, 30).map(sample => {
      const at = sample.at ?? null;
      if (at !== null && (typeof at !== 'string' || !Number.isFinite(Date.parse(at)))) throw new Error('备份中的录入时间不正确。');
      return { url: platformLink(id, checkedString(sample.url, 2000, true)), at, values: backupMetrics(sample.values) };
    });
  }
  return work;
}

function exportBackup() {
  const payload = {
    type: 'pump-planner-backup', version: 1,
    works: works.map(({video, ...work}) => ({...work, missingVideoName: video?.name || work.missingVideoName}))
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'pump-works-' + zone.format() + '.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  showNotice('已导出 ' + works.length + ' 条作品记录。');
}

const packageFile = document.querySelector('#package-file');
const backupFile = document.querySelector('#backup-file');
document.querySelector('#import-package').addEventListener('click', () => packageFile.click());
document.querySelector('#import-backup').addEventListener('click', () => backupFile.click());
document.querySelector('#export-backup').addEventListener('click', exportBackup);
packageFile.addEventListener('change', async () => {
  const file = packageFile.files[0];
  packageFile.value = '';
  if (!file || saving || editor.open) return;
  try {
    const imported = await unpackWork(file);
    const existing = works.find(work => work.id === imported.id);
    if (editor.open || saving) return;
    open(existing, imported);
    if (existing) showNotice('已打开同一作品，保存后更新成片。');
  } catch (error) { showNotice('导入失败：' + error.message); }
});
backupFile.addEventListener('change', async () => {
  const file = backupFile.files[0];
  backupFile.value = '';
  if (!file || saving || editor.open) return;
  try {
    if (file.size > 10 * 1024 ** 2) throw new Error('备份文件过大。');
    const backup = JSON.parse(await file.text());
    if (backup.type !== 'pump-planner-backup' || backup.version !== 1 || !Array.isArray(backup.works)) {
      throw new Error('请选择片务导出的作品记录备份。');
    }
    const records = backup.works.map(readBackupWork);
    if (editor.open || saving) return;
    const existing = new Set(works.map(work => work.id));
    const added = records.filter(work => {
      if (existing.has(work.id)) return false;
      existing.add(work.id);
      return true;
    });
    const next = [...works, ...added];
    localStorage.setItem(key, JSON.stringify(next));
    works = next;
    render();
    showNotice('恢复 ' + added.length + ' 条作品，跳过 ' + (records.length - added.length) + ' 条重复记录。');
  } catch (error) { showNotice('恢复失败：' + error.message); }
});
window.addEventListener('hashchange', render);
render();
