// 示例数据（全部为虚构账号），用于本地预览
export function sample() {
  const now = Date.now(), H = 36e5;
  const posts = Array.from({ length: 40 }, (_, i) => {
    const v = Math.round(130000 / (1 + i * 0.35));
    return { id: String(1900000000000000000n + BigInt(i)), url: "https://x.com/tigerr3aue", created_at: new Date(now - ((i * 37) % 23 + 1) * H).toISOString(),
      author: { id: "u" + i, name: "示例账号" + String.fromCharCode(65 + (i % 26)) + (i >= 26 ? i : ""), username: "demo_" + i, avatar: "", followers: 5000 + i * 900 },
      metrics: { views: v, replies: Math.round(v / (60 + (i * 13) % 90)), reposts: Math.round(v / 70), likes: Math.round(v / 25), quotes: 20, bookmarks: 40 },
      image: i % 4 !== 3 ? { url: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><rect width='200' height='200' fill='hsl(${(i * 47) % 360},55%,${62 + (i % 3) * 8}%)'/><circle cx='100' cy='82' r='38' fill='#fff8'/><ellipse cx='100' cy='190' rx='70' ry='60' fill='#fff8'/></svg>`)}`, w: 200, h: 200 } : null };
  });
  const top = k => [...posts].sort((a, b) => b.metrics[k] - a.metrics[k]);
  return { updated_at: new Date().toISOString(), sample: true,
    exposure: top("views"), comments: top("replies"), growth: posts.slice(0, 25).map((p, i) => ({ gain: 3000 - i * 100, post: p })),
    photos: posts.filter(p => p.image), best: posts.slice(0, 10).map((p, i) => ({ author: p.author, interactions: 32000 - i * 2500, gain: 420 - i * 30 })), meta: {} };
}
