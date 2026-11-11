#!/usr/bin/env bash
# 只提交并推送 office/status.json（不必整站部署）。
# 用法：在仓库根目录或任意位置执行 scripts/push_office_status.sh
# 需要环境变量 GH_TOKEN（repo 权限）。令牌只通过临时 GIT_ASKPASS 传给 git，不写入 remote 或任何文件。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
: "${GH_TOKEN:?GH_TOKEN not set}"
STATUS="office/status.json"
[ -f "$STATUS" ] || { echo "缺少 $STATUS" >&2; exit 1; }

# 校验 JSON、必要字段、status 枚举、名称在 12 人名单内
node - "$STATUS" <<'JS'
const fs = require('fs');
const file = process.argv[2]; // node - file <<'JS' 时 argv[1] 是 '-'
const TEAM = [
  '大汉丞相', '选题大师', '剪辑大师', '产品经理', '全栈工程师', '运营大师',
  '插画机器人', '推文bot-小组长', '职场导师', '加密货币', '金融分析师', '微信bot',
];
const STATUSES = new Set(['idle', 'thinking', 'tool', 'typing', 'waiting', 'done']);
let data;
try { data = JSON.parse(fs.readFileSync(file, 'utf8')); }
catch (e) { console.error(file + ' 不是合法 JSON：' + e.message); process.exit(1); }
if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.agents)) {
  console.error(file + ' 必须是含 agents 数组的对象');
  process.exit(1);
}
function checkTime(v, label) {
  if (v == null || v === '') return;
  if (typeof v !== 'string' || !Number.isFinite(Date.parse(v))) {
    console.error(label + ' 不是合法 ISO 8601 时间：' + v);
    process.exit(1);
  }
}
checkTime(data.updatedAt, 'updatedAt');
const seen = new Set();
for (const rec of data.agents) {
  if (!rec || typeof rec !== 'object') { console.error('agents 里有无效项'); process.exit(1); }
  if (typeof rec.name !== 'string' || !TEAM.includes(rec.name)) {
    console.error('未知或不合法的助手名：' + (rec && rec.name));
    process.exit(1);
  }
  if (seen.has(rec.name)) { console.error('重复的助手名：' + rec.name); process.exit(1); }
  seen.add(rec.name);
  if (!STATUSES.has(rec.status)) {
    console.error(rec.name + ' 的 status 不在 idle/thinking/tool/typing/waiting/done 内：' + rec.status);
    process.exit(1);
  }
  if (rec.activity != null && rec.activity !== '') {
    if (typeof rec.activity !== 'string' || /[\r\n]/.test(rec.activity) || rec.activity.length > 40) {
      console.error(rec.name + ' 的 activity 须为不超过 40 字的单行粗粒度说明');
      process.exit(1);
    }
  }
  checkTime(rec.updatedAt, rec.name + '.updatedAt');
  checkTime(rec.lastEventAt, rec.name + '.lastEventAt');
}
console.log('status.json ok，' + data.agents.length + ' 位助手');
JS

REMOTE="https://github.com/924950698/rank-site.git"
ASK="$(mktemp)"; trap 'rm -f "$ASK"' EXIT
printf '#!/bin/sh\ncase "$1" in *sername*) echo x-access-token;; *) echo "$GH_TOKEN";; esac\n' > "$ASK"; chmod 700 "$ASK"
export GIT_ASKPASS="$ASK" GIT_TERMINAL_PROMPT=0
git config user.name >/dev/null || git config user.name "rank-bot"
git config user.email >/dev/null || git config user.email "924950698@users.noreply.github.com"

STASHED=0
if ! git diff --quiet -- income.js style.css || ! git diff --cached --quiet -- income.js style.css; then
  git stash push -m "growth-report unpublished" -- income.js style.css
  STASHED=1
fi

# 只提交 status.json，不要 git add -A，不要改 index.html 的 cache-bust
git add -- "$STATUS"
if git diff --cached --quiet -- "$STATUS"; then
  echo "office/status.json 没有新的改动"
  if [ "$STASHED" = 1 ]; then git stash pop; fi
  exit 0
fi
git commit -q -m "office-status: $(date '+%F %H:%M') CST"
if git ls-remote --exit-code "$REMOTE" main >/dev/null 2>&1; then
  git pull -q --rebase --autostash "$REMOTE" main
fi
git push -q "$REMOTE" HEAD:main
echo "pushed $(git rev-parse --short HEAD) ($STATUS)"
if [ "$STASHED" = 1 ]; then git stash pop; fi
