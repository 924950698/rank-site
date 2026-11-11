#!/usr/bin/env bash
# 从 whatsmyagentdoing（MIT, cheoyu/Charonyuu）源码生成静态展示页 office/。
# 用法：scripts/sync_office.sh [源码目录，默认 /workspace/myoffice]
# 只读源码目录；对上游文件只做最小路径补丁（绝对路径 → 相对 /office/）。
# 不被本脚本覆盖、同步时必须保留：
#   office/demo-api.js   —— 读 status.json 的 API 替身（不要收回假循环演示）
#   office/status.json   —— 各助手真实工作状态
#   office/showcase.css  —— 展示页外框
# 同步后仍会重打「助手列表」补丁（i18n.js）。
set -euo pipefail
SRC="${1:-/workspace/myoffice}"
DST="$(cd "$(dirname "$0")/.." && pwd)/office"
mkdir -p "$DST/assets/scenes"
cp "$SRC/public/"{i18n.js,office.js,office3d.js,popout.js,index.html} "$DST/"
# 侧栏标题：Agent 列表 → 助手列表（简中/繁中）
sed -i 's/agentsTitle: "Agent 列表"/agentsTitle: "助手列表"/g' "$DST/i18n.js"
cp "$SRC/LICENSE" "$DST/LICENSE.txt"
rm -rf "$DST/assets/agents" "$DST/assets/kenney" "$DST/assets/scene-icons"
cp -r "$SRC/assets/agents" "$SRC/assets/kenney" "$SRC/assets/scene-icons" "$DST/assets/"
cp "$SRC/assets/logo.svg" "$DST/assets/"
cp "$SRC/assets/scenes/office.jpg" "$DST/assets/scenes/"   # 只带内置办公室，不带场景包
# 上游 bug（v0.8.1）：窄屏布局里没有桌上足球时 office3d 每帧取 foosball.y 会抛错、动画停住；兜底成 y=0
sed -i 's#this.plan.props.find(u=>u.t==="foosball").y#(this.plan.props.find(u=>u.t==="foosball")||{y:0}).y#' "$DST/office3d.js"
grep -q '||{y:0}).y' "$DST/office3d.js" || { echo "foosball 补丁没打上" >&2; exit 1; }
# --- 最小路径补丁（静态托管在 /office/ 子路径下）---
sed -i "s#'/assets/agents/#'./assets/agents/#g" "$DST/office.js"
sed -i 's#`/assets/kenney/#`./assets/kenney/#g' "$DST/office3d.js"
sed -i "s#new URL('/', location.href)#new URL('./', location.href)#" "$DST/popout.js"
python3 - "$DST/index.html" <<'PY'
import sys,re
p=sys.argv[1]; s=open(p,encoding='utf-8').read()
rep=[('<script src="/i18n.js"></script>','<script src="./i18n.js"></script>\n<!-- markpump: 静态演示替身（替代 Node API，演示数据、仅状态） -->\n<script src="./demo-api.js"></script>'),
('<script src="/office.js"></script>','<script src="./office.js"></script>'),
('<script src="/popout.js"></script>','<script src="./popout.js"></script>'),
("import('/office3d.js')","import('./office3d.js')"),
('src="/assets/','src="./assets/'),
("<html lang=\"en\">","<html lang=\"zh-CN\">"),
("<title>What's my agent doing</title>","<title>办公室</title>\n<link rel=\"stylesheet\" href=\"./showcase.css\">"),
('<div class="ver" id="ver"></div>','<div class="ver" id="ver"></div>\n<div class="mp-credit">演示数据 · 仅显示状态，不公开对话 · 基于开源项目 <a href="https://github.com/Charonyuu/whatsmyagentdoing" target="_blank" rel="noopener">whatsmyagentdoing</a>（MIT，作者 cheoyu / Charonyuu）· <a href="./LICENSE.txt" target="_blank">许可证</a></div>'),
]
for a,b in rep:
    n=s.count(a); assert n>=1,(a,n); s=s.replace(a,b)
s=s.replace('src="/assets/','src="./assets/')
open(p,'w',encoding='utf-8').write(s)
PY
# 剩余的绝对路径只应是 /api、/events、/scenes（由 demo-api.js 接管）
grep -noE "[\"'\`]/(assets|office3d|i18n|office\.js|popout)" "$DST"/*.js "$DST/index.html" && { echo "还有未改的绝对路径" >&2; exit 1; } || true
# 保留真实状态链路，不要在同步时丢掉或收回假循环
for f in demo-api.js status.json showcase.css; do
  [ -f "$DST/$f" ] || { echo "同步后缺少 office/$f，已中止" >&2; exit 1; }
done
grep -q 'status.json' "$DST/demo-api.js" || { echo "office/demo-api.js 应读取 status.json，不要收回假循环" >&2; exit 1; }
grep -q '假演示循环' "$DST/demo-api.js" || { echo "office/demo-api.js 缺少失败兜底说明，可能被旧演示脚本覆盖" >&2; exit 1; }
grep -q 'agentsTitle: "助手列表"' "$DST/i18n.js" || { echo "助手列表补丁没打上" >&2; exit 1; }
echo "synced -> $DST"
