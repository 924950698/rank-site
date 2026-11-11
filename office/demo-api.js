/* markpump 静态展示替身 —— 替代 whatsmyagentdoing 的 Node 服务（src/server.js）。
 * 在 i18n.js 之后、office.js / 页面脚本之前加载：
 *  - 读取同目录 status.json（真实助手状态），定时轮询刷新，
 *  - 接管 fetch('/api/...') 与 EventSource('/events')，不访问任何服务器接口、不调用任何模型，
 *  - 只输出状态：没有提示词、回复、标题、对话记录、模型名、用量。
 * 上游 MIT © cheoyu (Charonyuu) https://github.com/Charonyuu/whatsmyagentdoing
 */
(() => {
  'use strict';

  const TEAM = [
    '大汉丞相', '选题大师', '剪辑大师', '产品经理', '全栈工程师', '运营大师',
    '插画机器人', '推文bot-小组长', '职场导师', '加密货币', '金融分析师', '微信bot',
  ];
  const STATUSES = new Set(['idle', 'thinking', 'tool', 'typing', 'waiting', 'done']);
  const ACTIVEISH = new Set(['thinking', 'tool', 'typing', 'waiting']);
  const POLL_MS = 20_000;
  const t0 = Date.now();
  const startedAtOf = Object.fromEntries(TEAM.map((name, i) => [name, t0 - (i + 1) * 600_000]));

  const listeners = new Set();
  let lastOk = null;
  let prevTurns = new Map();

  function parseTime(v, fallback) {
    if (v == null || v === '') return fallback;
    const n = typeof v === 'number' ? v : Date.parse(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function cleanActivity(v) {
    if (v == null) return null;
    if (typeof v !== 'string') return null;
    const s = v.trim();
    return s ? s : null;
  }

  function rowOf(name, rec, fileUpdatedAt, now) {
    const status = rec && STATUSES.has(rec.status) ? rec.status : 'idle';
    const activity = status === 'idle' ? null : cleanActivity(rec && rec.activity);
    const lastEventAt = parseTime(rec && (rec.lastEventAt || rec.updatedAt), fileUpdatedAt ?? now);
    const prev = prevTurns.get(name);
    let turnStartedAt = null;
    if (ACTIVEISH.has(status)) {
      if (prev && ACTIVEISH.has(prev.status) && prev.turnStartedAt) turnStartedAt = prev.turnStartedAt;
      else turnStartedAt = lastEventAt;
    }
    return { name, status, activity, lastEventAt, turnStartedAt, startedAt: startedAtOf[name] };
  }

  function fromStatusFile(data, now) {
    const recs = new Map();
    const list = data && Array.isArray(data.agents) ? data.agents
      : Array.isArray(data) ? data
      : null;
    if (!list) throw new Error('status.json: missing agents');
    const fileUpdatedAt = parseTime(data && data.updatedAt, now);
    for (const rec of list) {
      if (!rec || typeof rec.name !== 'string') continue;
      if (!TEAM.includes(rec.name)) continue;
      recs.set(rec.name, rec);
    }
    return TEAM.map((name) => rowOf(name, recs.get(name) || null, fileUpdatedAt, now));
  }

  function idleRows(now) {
    return TEAM.map((name) => rowOf(name, { status: 'idle' }, now, now));
  }

  function snapshotFrom(rows, now) {
    const sessions = rows.map((s, i) => ({
      key: `team:demo-${i}`, agent: 'team', source: 'magpie', agentName: '助理',
      id: `demo-${i}`, sessionId: null, parentId: null, subagent: false, cwd: null, project: s.name,
      title: null, model: null, status: s.status, stuck: 0, context: null, today: null,
      activity: s.activity, prompt: null, reply: null, error: null,
      turnStartedAt: s.turnStartedAt, lastEventAt: s.lastEventAt, startedAt: s.startedAt,
    })).sort((a, b) => b.lastEventAt - a.lastEventAt);
    const d = new Date(now);
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { now, lang: 'zh-CN', sessions, summary: { day, turns: 0, tokens: 0, agents: 0, byAgent: {}, projects: {} } };
  }

  function rememberTurns(rows) {
    prevTurns = new Map(rows.map((s) => [s.name, { status: s.status, turnStartedAt: s.turnStartedAt }]));
  }

  function currentSnapshot() {
    const now = Date.now();
    return lastOk || snapshotFrom(idleRows(now), now);
  }

  function statusUrl() {
    const href = location.href;
    const path = location.pathname || '';
    const base = path.endsWith('/') || /\.html?$/i.test(path) ? href : href.replace(/\?.*$/, '') + '/';
    const u = new URL('./status.json', base);
    u.searchParams.set('t', String(Date.now()));
    return u.href;
  }

  async function poll() {
    try {
      const r = await realFetch(statusUrl(), { cache: 'no-store' });
      if (!r.ok) throw new Error('http ' + r.status);
      const data = await r.json();
      const now = Date.now();
      const rows = fromStatusFile(data, now);
      rememberTurns(rows);
      lastOk = snapshotFrom(rows, now);
      for (const f of listeners) f();
    } catch {
      // 保留上次成功结果；从未成功则继续全员 idle。不要退回假演示循环。
    }
  }

  // 默认偏好：3D、关通知、侧栏显示闲置助手（访客未自行改过时）
  try {
    const def = { quality: 'high', view: 'office', notify: false, sound: false, showIdle: true };
    for (const [k, v] of Object.entries(def)) if (localStorage.getItem('wmad.' + k) == null) localStorage.setItem('wmad.' + k, JSON.stringify(v));
  } catch {}

  // 文案：公开演示页不是 --private 启动，也没有本地日志
  if (window.I18N) for (const c of ['zh-CN', 'zh-TW', 'en']) if (I18N[c]) {
    I18N[c].privateNote = c === 'en' ? 'Public demo: conversations are not shown.' : c === 'zh-TW' ? '公開展示頁：不顯示對話內容。' : '公开展示页：不显示对话内容。';
  }
  if (window.I18N && I18N['zh-CN']) I18N['zh-CN'].title = '办公室';

  // ---- fetch 替身：只接管本页的 /api/*，其余照常（含 ./status.json）
  const json = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
  const realFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const u = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (u.origin === location.origin && (u.pathname.startsWith('/api/') || u.pathname.startsWith('/scenes/'))) {
      const p = u.pathname;
      if (p === '/api/sessions') return json(currentSnapshot());
      if (p === '/api/transcript') return json({ messages: [], private: true }, 403);
      if (p === '/api/scenes') return json({ installed: [], available: [] }); // 只用内置办公室，不下载场景包
      if (p === '/api/version') return json({ version: '0.8.1', latest: '0.8.1', updateAvailable: false, canUpdate: false });
      if (p === '/api/ping') return json({ app: 'whatsmyagentdoing', demo: false });
      return json({ ok: false, error: 'static demo' }, 404); // shutdown / update / install 等在静态页不可用
    }
    return realFetch(input, init);
  };

  // ---- EventSource 替身：推送 status.json 快照
  const RealES = window.EventSource;
  class StatusEventSource extends EventTarget {
    constructor(url) {
      super();
      this.url = String(url); this.readyState = 1; this.onmessage = null; this.onerror = null; this.onopen = null;
      this._send = () => {
        const ev = new MessageEvent('message', { data: JSON.stringify(currentSnapshot()) });
        this.onmessage?.(ev); this.dispatchEvent(ev);
      };
      listeners.add(this._send);
      setTimeout(this._send, 0);
    }
    close() { this.readyState = 2; listeners.delete(this._send); }
  }
  window.EventSource = function (url, opts) {
    const u = new URL(url, location.href);
    return u.pathname.endsWith('/events') ? new StatusEventSource(url) : new RealES(url, opts);
  };

  poll();
  setInterval(poll, POLL_MS);
})();
