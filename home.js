(async () => {
  const dateFormat = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric'
  });
  try {
    const data = await MP.json('youtube/videos.json');
    const latest = (data.videos || []).filter(video =>
      /^[A-Za-z0-9_-]{11}$/.test(video.id) && typeof video.title === 'string' &&
      video.title.trim() && Number.isFinite(Date.parse(video.published))
    ).sort((a, b) => Date.parse(b.published) - Date.parse(a.published))[0];
    if (!latest) return;
    const url = 'https://www.youtube.com/watch?v=' + latest.id;
    const thumb = 'https://i.ytimg.com/vi/' + latest.id + '/hqdefault.jpg';
    const title = document.getElementById('issue-title');
    const date = document.getElementById('issue-date');
    const cover = document.getElementById('issue-cover');
    const coverLink = document.getElementById('issue-cover-link');
    title.textContent = latest.title;
    date.dateTime = latest.published;
    date.textContent = dateFormat.format(new Date(latest.published));
    document.getElementById('issue-watch').href = url;
    coverLink.href = url;
    coverLink.setAttribute('aria-label', '播放：' + latest.title);
    if (cover.src !== thumb) cover.src = thumb;
  } catch {
    // 首页保留最近一次发布时已知的封面和链接。
  }
})();
