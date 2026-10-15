// 碰撞动效原型：mode = spark | ripple | heart
window.setupFx = function (mode) {
  const wall = document.querySelector('#wall'); wall.style.position = 'relative';
  const bubs = [...wall.querySelectorAll('.bub')].map((el, i) => { el.style.animation = 'none';
    const r = el.offsetWidth / 2; return { el, x: el.offsetLeft + r, y: el.offsetTop + r, r, ph: i * 1.7, sp: 0.9 + (i % 5) * 0.15, amp: Math.min(5, 2 + r * 0.06) }; });
  const cv = document.createElement('canvas'), dpr = 2; cv.width = wall.clientWidth * dpr; cv.height = wall.clientHeight * dpr;
  Object.assign(cv.style, { position: 'absolute', left: 0, top: 0, width: wall.clientWidth + 'px', height: wall.clientHeight + 'px', pointerEvents: 'none', zIndex: 5 });
  wall.appendChild(cv); const g = cv.getContext('2d'); g.scale(dpr, dpr);
  const pairs = []; for (let i = 0; i < bubs.length; i++) for (let j = i + 1; j < bubs.length; j++) { const a = bubs[i], b = bubs[j]; if (Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r < 9) pairs.push({ a, b, on: false }); }
  let fx = [];
  const spawn = (x, y, s) => {
    if (mode === 'spark') for (let k = 0; k < 14; k++) { const an = Math.random() * 6.28, v = 40 + Math.random() * 90; fx.push({ t: 'p', x, y, vx: Math.cos(an) * v, vy: Math.sin(an) * v, life: 0.5 + Math.random() * 0.3, age: 0, c: Math.random() < .5 ? '#39ff14' : '#ffe14d' }); }
    if (mode === 'ripple') { fx.push({ t: 'r', x, y, life: 0.9, age: 0, s }); fx.push({ t: 'r', x, y, life: 0.9, age: -0.18, s }); }
    if (mode === 'heart') for (let k = 0; k < 3; k++) fx.push({ t: 'h', x: x + (k - 1) * 6, y, vx: (k - 1) * 14, vy: -50 - k * 12, life: 1.2, age: -k * 0.08, ch: ['❤️', '💚', '✨'][k] });
  };
  let last = 0;
  window.fxStep = t => {
    const dt = Math.max(0, t - last); last = t;
    for (const b of bubs) { b.dx = Math.sin(t * b.sp + b.ph) * b.amp; b.dy = Math.cos(t * b.sp * 0.8 + b.ph * 1.3) * b.amp; b.el.style.transform = `translate(${b.dx}px,${b.dy}px)`; }
    for (const p of pairs) { const ax = p.a.x + p.a.dx, ay = p.a.y + p.a.dy, bx = p.b.x + p.b.dx, by = p.b.y + p.b.dy, d = Math.hypot(ax - bx, ay - by), touch = d <= p.a.r + p.b.r + 0.5;
      if (touch && !p.on) { const u = p.a.r / (p.a.r + p.b.r); spawn(ax + (bx - ax) * u, ay + (by - ay) * u, Math.min(p.a.r, p.b.r)); } p.on = touch; }
    g.clearRect(0, 0, cv.width, cv.height);
    fx = fx.filter(f => (f.age += dt) < f.life);
    for (const f of fx) { if (f.age < 0) continue; const k = f.age / f.life;
      if (f.t === 'p') { f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= .93; f.vy *= .93; g.globalAlpha = 1 - k; g.fillStyle = f.c; g.shadowColor = f.c; g.shadowBlur = 8; g.beginPath(); g.arc(f.x, f.y, 2.2 * (1 - k) + .6, 0, 7); g.fill(); }
      if (f.t === 'r') { g.globalAlpha = (1 - k) * .9; g.strokeStyle = '#39ff14'; g.lineWidth = 2.5 * (1 - k) + .5; g.shadowColor = '#39ff14'; g.shadowBlur = 12; g.beginPath(); g.arc(f.x, f.y, 4 + k * (f.s * 1.4 + 14), 0, 7); g.stroke(); }
      if (f.t === 'h') { f.x += f.vx * dt; f.y += f.vy * dt; g.globalAlpha = 1 - k; g.shadowBlur = 0; g.font = `${12 + 8 * Math.sin(Math.min(1, k * 3) * 1.57)}px sans-serif`; g.textAlign = 'center'; g.fillText(f.ch, f.x, f.y); } }
    g.globalAlpha = 1; g.shadowBlur = 0;
  };
};
