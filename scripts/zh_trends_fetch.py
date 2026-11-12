#!/usr/bin/env python3
"""拉近 6 小时中文帖（X v2 recent search，bearer），原始数据只存 state/（gitignored）。令牌不打印。"""
import json, os, time, urllib.request, urllib.parse, urllib.error
from datetime import datetime, timezone, timedelta
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
T = os.environ["X_BEARER_TOKEN"]
SINCE = (datetime.now(timezone.utc) - timedelta(hours=6)).strftime("%Y-%m-%dT%H:%M:%SZ")
BASE = " lang:zh -is:retweet -is:reply -is:quote"
QUERIES = ["的", "了", "是", "在", "有", "我", "(新闻 OR 突发 OR 刚刚 OR 热搜 OR 曝光)", "(比赛 OR 夺冠 OR 发布 OR 官宣 OR 回应)"]
PAGES = int(os.environ.get("ZH_PAGES", "3"))
F = "tweet.fields=created_at,public_metrics,lang,author_id,entities,referenced_tweets&expansions=author_id&user.fields=username,public_metrics"
posts = {}; users = {}; calls = 0
for q in QUERIES:
    tok = None
    for _ in range(PAGES):
        u = (f"https://api.x.com/2/tweets/search/recent?query={urllib.parse.quote(q + BASE)}&max_results=100"
             f"&sort_order=relevancy&start_time={SINCE}&{F}" + (f"&next_token={tok}" if tok else ""))
        try:
            with urllib.request.urlopen(urllib.request.Request(u, headers={"Authorization": f"Bearer {T}"}), timeout=30) as r:
                j = json.load(r)
        except urllib.error.HTTPError as e:
            print("HTTP", e.code, q); break
        calls += 1
        for us in j.get("includes", {}).get("users", []): users[us["id"]] = us
        for t in j.get("data", []): posts[t["id"]] = t
        tok = j.get("meta", {}).get("next_token")
        time.sleep(2.1)
        if not tok: break
for t in posts.values():
    us = users.get(t["author_id"], {})
    t["username"] = us.get("username"); t["followers"] = (us.get("public_metrics") or {}).get("followers_count", 0)
(ROOT / "state/zh-trends-raw.json").write_text(json.dumps({"fetched": int(time.time()*1000), "since": SINCE, "posts": list(posts.values())}, ensure_ascii=False))
print(f"calls={calls} posts={len(posts)}")
