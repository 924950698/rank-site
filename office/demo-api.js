/* markpump 静态演示替身 —— 替代 whatsmyagentdoing 的 Node 服务（src/server.js + src/demo.js）。
 * 在 i18n.js 之后、office.js / 页面脚本之前加载：
 *  - 浏览器内跑一支演示团队（移植自 src/demo.js 的 DemoWatcher 节奏），
 *  - 接管 fetch('/api/...') 与 EventSource('/events')，不访问任何服务器接口、不调用任何模型，
 *  - 只输出状态（等同 --private）：没有提示词、回复、标题、对话记录、模型名、用量。
 * 上游 MIT © cheoyu (Charonyuu) https://github.com/Charonyuu/whatsmyagentdoing
 */
(() => {
  'use strict';
  // 12 位助理（展示名）与只用于状态气泡的通用动作（非对话内容）
  const TEAM = [
    ['大汉丞相', ['统筹任务', '分派工作', '核对进度']],
    ['选题大师', ['找选题', '看热点', '列提纲']],
    ['剪辑大师', ['剪视频', '配字幕', '导出成片']],
    ['产品经理', ['写需求', '画原型', '排优先级']],
    ['全栈工程师', ['写代码', '跑测试', '本地预览']],
    ['运营大师', ['看数据', '排期发布', '回复评论']],
    ['插画机器人', ['画草图', '上色', '出图']],
    ['推文bot-小组长', ['写推文', '排推文', '校对']],
    ['职场导师', ['整理建议', '查资料', '写总结']],
    ['加密货币', ['看行情', '整理资讯', '记笔记']],
    ['金融分析师', ['读财报', '建模型', '写分析']],
    ['微信bot', ['收消息', '整理消息', '同步群聊']],
  ];
  // 一轮工作（秒/步），与上游 demo 相同
  const SCRIPT = [['thinking', 3], ['tool', 4], ['thinking', 2], ['tool', 3], ['typing', 3], ['done', 16]];
  const TOTAL = SCRIPT.reduce((a, [, d]) => a + d, 0);
  const t0 = Date.now();
  const list = TEAM.map(([name, acts], i) => ({
    name, acts, id: `demo-${i}`, status: 'idle', activity: null, turnStartedAt: null,
    lastEventAt: t0, startedAt: t0 - (i + 1) * 600_000, offset: (i * 7.3) % 37, asks: i === 2 || i === 6, key: '',
  }));
  const listeners = new Set();
  function tick() {
    const t = Date.now() / 1000;
    let changed = false;
    for (const s of list) {
      const cycle = Math.floor((t + s.offset) / TOTAL);
      let k = (t + s.offset) % TOTAL, step = 0;
      while (k >= SCRIPT[step][1]) { k -= SCRIPT[step][1]; step++; }
      let [status] = SCRIPT[step];
      if (s.asks && cycle % 2 === 1 && status === 'typing') status = 'waiting';
      const key = `${cycle}:${step}:${status}`;
      if (key === s.key) continue;
      s.key = key; changed = true;
      const now = Date.now();
      if (step === 0) s.turnStartedAt = now - k * 1000;
      s.status = status; s.lastEventAt = now;
      s.activity = status === 'tool' ? s.acts[(cycle * 3 + step + (s.offset | 0)) % s.acts.length]
        : status === 'waiting' ? '等待确认' : null;
    }
    if (changed) for (const f of listeners) f();
  }
  function snapshot() {
    const sessions = list.map((s) => ({
      key: `team:${s.id}`, agent: 'team', source: 'magpie', agentName: '助理',
      id: s.id, sessionId: null, parentId: null, subagent: false, cwd: null, project: s.name,
      title: null, model: null, status: s.status, stuck: 0, context: null, today: null,
      activity: s.activity, prompt: null, reply: null, error: null,
      turnStartedAt: s.turnStartedAt, lastEventAt: s.lastEventAt, startedAt: s.startedAt,
    })).sort((a, b) => b.lastEventAt - a.lastEventAt);
    const now = Date.now();
    const d = new Date(now);
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { now, lang: 'zh-CN', sessions, summary: { day, turns: 0, tokens: 0, agents: 0, byAgent: {}, projects: {} } };
  }
  tick();
  setInterval(tick, 500);

  // 默认偏好：3D、关通知（访客未自行改过时）
  try {
    const def = { quality: 'high', view: 'office', notify: false, sound: false };
    for (const [k, v] of Object.entries(def)) if (localStorage.getItem('wmad.' + k) == null) localStorage.setItem('wmad.' + k, JSON.stringify(v));
  } catch {}

  // 文案：公开演示页不是 --private 启动，也没有本地日志
  if (window.I18N) for (const c of ['zh-CN', 'zh-TW', 'en']) if (I18N[c]) {
    I18N[c].privateNote = c === 'en' ? 'Public demo: conversations are not shown.' : c === 'zh-TW' ? '公開展示頁：不顯示對話內容。' : '公开展示页：不显示对话内容。';
  }
  if (window.I18N && I18N['zh-CN']) I18N['zh-CN'].title = '办公室';

  // ---- fetch 替身：只接管本页的 /api/*，其余照常
  const json = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
  const realFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const u = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (u.origin === location.origin && (u.pathname.startsWith('/api/') || u.pathname.startsWith('/scenes/'))) {
      const p = u.pathname;
      if (p === '/api/sessions') return json(snapshot());
      if (p === '/api/transcript') return json({ messages: [], private: true }, 403);
      if (p === '/api/scenes') return json({ installed: [], available: [] }); // 只用内置办公室，不下载场景包
      if (p === '/api/version') return json({ version: '0.8.1', latest: '0.8.1', updateAvailable: false, canUpdate: false });
      if (p === '/api/ping') return json({ app: 'whatsmyagentdoing', demo: true });
      return json({ ok: false, error: 'static demo' }, 404); // shutdown / update / install 等在静态页不可用
    }
    return realFetch(input, init);
  };

  // ---- EventSource 替身：推送演示快照
  const RealES = window.EventSource;
  class DemoEventSource extends EventTarget {
    constructor(url) {
      super();
      this.url = String(url); this.readyState = 1; this.onmessage = null; this.onerror = null; this.onopen = null;
      this._send = () => {
        const ev = new MessageEvent('message', { data: JSON.stringify(snapshot()) });
        this.onmessage?.(ev); this.dispatchEvent(ev);
      };
      listeners.add(this._send);
      this._iv = setInterval(this._send, 5000);
      setTimeout(this._send, 0);
    }
    close() { this.readyState = 2; listeners.delete(this._send); clearInterval(this._iv); }
  }
  window.EventSource = function (url, opts) {
    const u = new URL(url, location.href);
    return u.pathname.endsWith('/events') ? new DemoEventSource(url) : new RealES(url, opts);
  };
})();
