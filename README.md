# 币圈 24h 爆帖榜 · V1（PRD v1.3：纯静态展示页，无登录、不存用户数据）

## 结构
- `index.html` `style.css` `app.js` `config.js`：页面（曝光/涨粉/评论榜、黑底圆形气泡照片墙、今日最佳互动账号、每日话题、站长推荐、关注按钮、按需 X 嵌入）
- `data.json`：榜单数据。**线上由产品经理 agent 每小时写入**，前端只读，字段：`updated_at, exposure[], comments[], growth[{gain,post}], photos[], best[{author,interactions,gain}], meta`；post = `{id,url,created_at,author{id,name,username,avatar,followers},metrics{views,replies,reposts,likes,quotes,bookmarks},image{url,w,h}|null}`（不含正文）
- `partners.json`：F12「我的最佳互动账号」，**由另一个 agent 每天写入**，前端在用户提交用户名时才加载：
  `{"updated_at":"ISO","method":"按最近回复和@次数","users":{"<小写 handle>":[{"handle":"","name":"","avatar":"","count":0} ×≤3]}}`（`sample:true` 表示示例）。分享链接：`?u=<handle>`
- `topic.json`：tiger 手动维护 `daily_topic`（当日投票帖）与 `pinned`（站长推荐）
- `go.html`：出站中转页，配合 Cloudflare Web Analytics 统计跳到 X 的点击（`config.js` 填 `CF_BEACON_TOKEN`，留空不启用）
- `privacy.html` `terms.html`
- `scripts/`：**可选**备用抓数脚本（同 schema）。已不使用 GitHub Actions；如不需要可整个删除，前端不依赖它。

- `data.json.rising[]`：新号进步榜（最多 10 条），由 `scripts/process_hourly.py merge-posts` 每小时自动算，只用帖子池 `state/posts.json` 和粉丝快照，不额外调接口。条目：`{author{id,name,username,avatar,followers}, followers, followers_24h, gain, growth_pct, window, views_24h, post{id,url,views,created_at}}`
  - 入选：粉丝 300–5000，排除 tigerr3aue，涨粉 > 0
  - 排序：`growth_pct` 降序，相同时按 `views_24h`（作者 24h 内帖子曝光合计）降序
  - `window`：`"24h"` 时 `gain = followers_24h`，`growth_pct = gain / (followers - gain) × 100`；已有 7 天日快照（`state/followers-daily.json`，每作者每天一条，保留 8 天）的作者满 10 个后自动切到 `"7d"`，此时 `gain`/`growth_pct` 按 7 天算，`followers_24h` 仍为 24h 涨粉（可能为 null）
  - 手动重算：`python3 scripts/process_hourly.py rising`

## 本地预览
    node scripts/build-data.mjs --sample   # 仅在没有真实 data.json 时生成示例（会覆盖 data.json！）
    python3 -m http.server 8080

## 上线
仅需 tiger 的 GitHub：建仓库 → 推送 → Settings → Pages（main 根目录）。之后由数据 agent 每小时更新 data.json 并推送。

## 互评账本数据 ledger.json

由 `scripts/ledger.py` 生成（每 6 小时；每个收录号 2 次调用：`from:H is:reply` 和 `to:H is:reply`，各取最近 25 条）。事件累积在 `state/ledger-events.json`（不入库、不存正文），按 post id 去重，超过 7 天丢弃。

```
{"updated_at":"ISO UTC","window_days":7,
 "users":{"<handle 小写无@>":[
   {"handle","name","avatar"(400x400),
    "me_to":int,            // 我回复 TA 的次数
    "to_me":int,            // TA 回复我的次数
    "last_me","last_me_url",        // 我最近一次回复 TA（时间/链接），没有则省略
    "last_to_me","last_to_me_url",  // TA 最近一次回复我，没有则省略
    "latest_post_url"}      // TA 最新原创帖，暂未采集，目前一律省略
 ]}}
```
- 顶层 `since`：`{"<handle>":"ISO UTC"}`，该号最早保留事件的时间，即实际覆盖起点。页面可显示「统计自 since 起」；没有事件的号不出现在 since 里。
- 活跃号会翻页（每方向最多 4 页≈100 条，直到覆盖上次运行/6 小时前）。
- 前端分栏：互惠 = me_to>0 && to_me>0；待回评 = me_to>0 && to_me==0；我该回的 = to_me>0 && me_to==0。
- 列表已按 me_to+to_me 降序、最近时间降序排好。
- 已过滤“在自己帖子下回复评论者”（父帖是对方回复我的评论），这种算作回答，不算去对方那里串门。
- 局限：每次只拿最近 25 条，活跃号的单次覆盖可能只有几小时，账本靠每 6 小时累积补齐，并不是完整的 7 天。

## 数据总览 overview.json

由 `scripts/overview.py` 生成（每天一次，只覆盖 tigerr3aue / wugaga520 / xinjiangmoment）。
`{"updated_at","window_days":7,"users":{"<handle>":{posts,views,avg_views,likes,reposts(含引用),replies,eng_rate(小数),followers,followers_24h?,top_post:{url,views}}}}`
- posts 只算原创（不含回复和转帖），views 为 impression_count 之和；字段未知时省略。
- followers_24h 需要约 24h 前的粉丝快照，首日没有。
