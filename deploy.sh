#!/usr/bin/env bash
# 用法：./deploy.sh            提交并推送 data.json / partners.json 的变化（无变化则跳过）
#       ./deploy.sh --all      提交并推送所有改动（站点代码更新时用）
# 需要环境变量 GH_TOKEN（repo 权限）。令牌只通过临时 GIT_ASKPASS 传给 git，不写入 remote 或任何文件。
set -euo pipefail
cd "$(dirname "$0")"
: "${GH_TOKEN:?GH_TOKEN not set}"
REMOTE="https://github.com/924950698/rank-site.git"
ASK="$(mktemp)"; trap 'rm -f "$ASK"' EXIT
printf '#!/bin/sh\ncase "$1" in *sername*) echo x-access-token;; *) echo "$GH_TOKEN";; esac\n' > "$ASK"; chmod 700 "$ASK"
export GIT_ASKPASS="$ASK" GIT_TERMINAL_PROMPT=0
git config user.name >/dev/null || git config user.name "rank-bot"
git config user.email >/dev/null || git config user.email "924950698@users.noreply.github.com"
if [ "${1:-}" = "--all" ]; then
  V="$(date +%Y%m%d%H%M%S)"; sed -i -E "s/\?v=[A-Za-z0-9]+\"/?v=$V\"/g; s/ASSET_V=\"[A-Za-z0-9]+\"/ASSET_V=\"$V\"/" index.html   # 缓存版本号
  git add -A; else
  # 校验 JSON，避免把写了一半的文件推上去
  for f in data.json partners.json ledger.json; do [ -f "$f" ] && { node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" || { echo "$f 不是合法 JSON，放弃推送" >&2; exit 1; }; git add "$f"; }; done
fi
if git diff --cached --quiet; then echo "no new changes"; else git commit -q -m "data: $(date '+%F %H:%M') CST"; fi
if git ls-remote --exit-code "$REMOTE" main >/dev/null 2>&1; then git pull -q --rebase "$REMOTE" main; fi
git push -q "$REMOTE" HEAD:main
echo "pushed $(git rev-parse --short HEAD)"
