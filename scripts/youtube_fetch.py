#!/usr/bin/env python3
"""手动刷新 YouTube 最新视频：抓频道官方 RSS，写成 youtube/videos.json 给 /youtube/ 页面读。

用法：python3 scripts/youtube_fetch.py
- 不需要任何令牌，不调用 X 接口；没有定时任务，需要时手动跑一次再部署。
- 抓取失败时不覆盖旧文件，直接报错退出。
"""
import json, os, sys, urllib.request, xml.etree.ElementTree as ET
from datetime import datetime, timezone

CHANNEL_ID = "UC6btmfpTMjlZ5r0VuQUP-hA"  # @DGBGJC 马克Pump（从频道页 externalId 查得）
HANDLE = "DGBGJC"
RSS = f"https://www.youtube.com/feeds/videos.xml?channel_id={CHANNEL_ID}"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "youtube", "videos.json")
NS = {"a": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015",
      "media": "http://search.yahoo.com/mrss/"}

def main():
    req = urllib.request.Request(RSS, headers={"User-Agent": "Mozilla/5.0 (markpump.com youtube_fetch)"})
    with urllib.request.urlopen(req, timeout=20) as r:
        if r.status != 200:
            sys.exit(f"RSS 返回 {r.status}，未更新")
        root = ET.fromstring(r.read())
    videos = []
    for e in root.findall("a:entry", NS):
        vid = (e.findtext("yt:videoId", "", NS) or "").strip()
        if not vid:
            continue
        desc = (e.findtext("media:group/media:description", "", NS) or "").strip()
        videos.append({
            "id": vid,
            "title": (e.findtext("a:title", "", NS) or "").strip(),
            "published": e.findtext("a:published", "", NS),
            "url": f"https://www.youtube.com/watch?v={vid}",
            "thumbnail": f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
            "description": desc[:160],
        })
    videos.sort(key=lambda v: v["published"] or "", reverse=True)
    data = {
        "channelId": CHANNEL_ID,
        "handle": HANDLE,
        "channelTitle": (root.findtext("a:title", "", NS) or "").strip(),
        "channelUrl": f"https://www.youtube.com/@{HANDLE}",
        "source": RSS,
        "fetchedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "videos": videos,
    }
    tmp = OUT + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write("\n")
    os.replace(tmp, OUT)
    print(f"写入 {os.path.relpath(OUT)}：{len(videos)} 条视频" + (f"，最新：{videos[0]['published']} {videos[0]['title']}" if videos else ""))

if __name__ == "__main__":
    main()
