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

## 本地预览
    node scripts/build-data.mjs --sample   # 仅在没有真实 data.json 时生成示例（会覆盖 data.json！）
    python3 -m http.server 8080

## 上线
仅需 tiger 的 GitHub：建仓库 → 推送 → Settings → Pages（main 根目录）。之后由数据 agent 每小时更新 data.json 并推送。
