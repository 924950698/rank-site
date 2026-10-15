// 「我的最佳互动账号」分享海报（1080x1350 canvas，二维码用本地 vendor/qrcode.js）
(() => {
const G = "#39FF14", W = 1080, H = 1350, FONT = '"PingFang SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif';
function loadImg(src) {
  return new Promise(res => {
    if (!src || src.startsWith("data:image/svg")) return res(null);
    const im = new Image(); im.crossOrigin = "anonymous"; im.referrerPolicy = "no-referrer";
    const t = setTimeout(() => res(null), 4000);
    im.onload = () => { clearTimeout(t); res(im); }; im.onerror = () => { clearTimeout(t); res(null); };
    im.src = src;
  });
}
function circleImg(c, im, label, x, y, r) {
  c.save(); c.beginPath(); c.arc(x, y, r, 0, 7); c.closePath(); c.clip();
  if (im) c.drawImage(im, x - r, y - r, 2 * r, 2 * r);
  else { c.fillStyle = "#1d1f23"; c.fill(); c.fillStyle = G; c.font = `800 ${r}px ${FONT}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText((label || "?").slice(0, 1).toUpperCase(), x, y + 4); }
  c.restore(); c.lineWidth = 6; c.strokeStyle = G; c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke();
}
function fit(c, s, max) { if (c.measureText(s).width <= max) return s; while (s.length && c.measureText(s + "…").width > max) s = s.slice(0, -1); return s + "…"; }
function qr(c, text, x, y, size) {
  const q = qrcode(0, "M"); q.addData(text); q.make();
  const n = q.getModuleCount(), pad = 16, cell = (size - pad * 2) / n;
  c.fillStyle = "#fff"; c.fillRect(x, y, size, size); c.fillStyle = "#000";
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) c.fillRect(x + pad + k * cell, y + pad + r * cell, Math.ceil(cell), Math.ceil(cell));
}
async function draw(o, useImgs) {
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const c = cv.getContext("2d");
  c.fillStyle = "#000"; c.fillRect(0, 0, W, H);
  const gr = c.createRadialGradient(W / 2, 0, 50, W / 2, 0, 900); gr.addColorStop(0, "#0d3a06"); gr.addColorStop(1, "#000"); c.fillStyle = gr; c.fillRect(0, 0, W, 700);
  c.strokeStyle = G; c.lineWidth = 4; c.strokeRect(30, 30, W - 60, H - 60);
  // 站名
  c.textAlign = "left"; c.textBaseline = "alphabetic";
  c.font = `800 44px ${FONT}`; c.fillStyle = "#fff"; c.fillText("币圈", 80, 120); let w = c.measureText("币圈").width;
  c.fillStyle = G; c.fillText("24h", 80 + w, 120); w += c.measureText("24h").width; c.fillStyle = "#fff"; c.fillText("爆帖榜", 80 + w, 120);
  // 标题
  c.textAlign = "center"; c.fillStyle = G; c.font = `800 64px ${FONT}`; c.fillText(fit(c, "@" + o.handle, W - 160), W / 2, 240);
  c.fillStyle = "#fff"; c.font = `800 60px ${FONT}`; c.fillText("的最佳互动账号 Top 3", W / 2, 320);
  // 三个账号
  const imgs = useImgs ? await Promise.all(o.list.map(u => loadImg(u.avatar))) : [];
  o.list.slice(0, 3).forEach((u, i) => {
    const y = 400 + i * 170;
    c.fillStyle = i === 0 ? "#0d2a07" : "#0b0b0b"; c.strokeStyle = i === 0 ? G : "#2f3336"; c.lineWidth = 3;
    c.beginPath(); c.roundRect(80, y, W - 160, 140, 28); c.fill(); c.stroke();
    c.textAlign = "left"; c.fillStyle = G; c.font = `900 60px ${FONT}`; c.fillText(String(i + 1), 120, y + 92);
    circleImg(c, imgs[i], u.name || u.handle, 255, y + 70, 50);
    c.fillStyle = "#fff"; c.font = `700 44px ${FONT}`; c.fillText(fit(c, u.name || u.handle, 470), 330, y + 64);
    c.fillStyle = "#8b9095"; c.font = `400 32px ${FONT}`; c.fillText(fit(c, "@" + u.handle, 470), 330, y + 110);
    c.textAlign = "right"; c.fillStyle = G; c.font = `900 60px ${FONT}`; c.fillText(String(u.count), W - 120, y + 80);
    c.fillStyle = "#8b9095"; c.font = `400 26px ${FONT}`; c.fillText("次互动", W - 120, y + 116);
  });
  // 二维码 + 链接
  const qy = 935; qr(c, o.url, 80, qy, 260);
  c.textAlign = "left"; c.fillStyle = "#fff"; c.font = `700 40px ${FONT}`; c.fillText("扫码测测你的 Top 3", 380, qy + 70);
  c.fillStyle = "#8b9095"; c.font = `400 26px ${FONT}`; c.fillText("只统计最近的回复和 @，不含点赞", 380, qy + 120);
  c.fillStyle = G; c.font = `400 26px ${FONT}`;
  const u = o.url.replace(/^https?:\/\//, ""); let line = "", ly = qy + 175;
  for (const ch of u) { if (c.measureText(line + ch).width > 620) { c.fillText(line, 380, ly); ly += 34; line = ""; } line += ch; } c.fillText(line, 380, ly);
  // 页脚 + 水印
  c.textAlign = "center"; c.fillStyle = "#8b9095"; c.font = `400 30px ${FONT}`; c.fillText("关注 @tigerr3aue · 每小时更新币圈爆帖", W / 2, H - 70);
  c.save(); c.translate(W - 66, 400); c.rotate(Math.PI / 2); c.globalAlpha = .35; c.fillStyle = G; c.font = `800 26px ${FONT}`; c.textAlign = "left"; c.fillText("@tigerr3aue", 0, 0); c.restore();
  c.save(); c.globalAlpha = .9; c.fillStyle = G; c.font = `800 30px ${FONT}`; c.textAlign = "right"; c.fillText("@tigerr3aue", W - 80, 120); c.restore();
  return cv;
}
window.makePoster = async o => {
  let cv = await draw(o, true);
  try { cv.toDataURL(); } catch { cv = await draw(o, false); } // 头像跨域导致画布被污染 → 改用首字母头像
  return cv;
};
})();
