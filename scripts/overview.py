#!/usr/bin/env python3
"""数据总览：3 个账号近 7 天公开数据 → overview.json（不存正文）。
用法：python3 scripts/overview.py USERS_FILE HANDLE=FILE[,FILE...] ...
  USERS_FILE：x.get_users_by_usernames(usernames=..., user.fields=public_metrics) 的原始结果
  FILE：x.search_posts_all(query="from:H -is:retweet -is:reply", max_results=100, start_time=now-7d,
        post.fields=created_at,public_metrics) 的各页原始结果（每页最多 25 条，按 meta.next_token 翻页）
脚本会打印每个 FILE 的 next_token（还没翻完时）。followers_24h 用 state/followers.json（按 user id 的 {t ms, f} 快照）里最接近 24h 前的一条，差距超过 3h 则省略；脚本每次运行会把粉丝数存进 state/overview-followers.json，第二天起就能算出 followers_24h。
"""
import json, sys, os, datetime as dt
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def raw(p):
    s = open(p, encoding='utf-8').read(); return json.loads(s[s.index('{'):s.rindex('}') + 1])
now = dt.datetime.now(dt.timezone.utc)
users = {u['username'].lower(): u for u in raw(sys.argv[1]).get('data', [])}
SNAP = os.path.join(ROOT, 'state', 'overview-followers.json')
own = json.load(open(SNAP)) if os.path.exists(SNAP) else {}
snaps = json.load(open(os.path.join(ROOT, 'state', 'followers.json'))) if os.path.exists(os.path.join(ROOT, 'state', 'followers.json')) else {}
cut = (now - dt.timedelta(days=7)).strftime('%Y-%m-%dT%H:%M:%S')
out = {}
for arg in sys.argv[2:]:
    h, files = arg.split('=', 1); h = h.lower()
    posts = {}
    for f in files.split(','):
        d = raw(f)
        tok = (d.get('meta') or {}).get('next_token')
        if tok: print(f'{h} {os.path.basename(f)} next_token={tok}', file=sys.stderr)
        for t in d.get('data', []) or []:
            if t['created_at'][:19] >= cut: posts[t['id']] = t
    pm = [(t['id'], t.get('public_metrics', {})) for t in posts.values()]
    views = sum(m.get('impression_count', 0) for _, m in pm)
    r = {'posts': len(pm), 'views': views, 'avg_views': round(views / len(pm)) if pm else 0,
         'likes': sum(m.get('like_count', 0) for _, m in pm),
         'reposts': sum(m.get('retweet_count', 0) + m.get('quote_count', 0) for _, m in pm),
         'replies': sum(m.get('reply_count', 0) for _, m in pm)}
    if views: r['eng_rate'] = round((r['likes'] + r['reposts'] + r['replies']) / views, 4)
    u = users.get(h)
    if u:
        r['followers'] = u['public_metrics']['followers_count']
        own.setdefault(u['id'], []).append({'t': int(now.timestamp() * 1000), 'f': r['followers']})
        own[u['id']] = [x for x in own[u['id']] if x['t'] > (now.timestamp() - 3 * 86400) * 1000]
        hist = (snaps.get(u['id']) or []) + own[u['id']][:-1]
        target = (now.timestamp() - 86400) * 1000
        if hist:
            best = min(hist, key=lambda s: abs(s['t'] - target))
            if abs(best['t'] - target) <= 3 * 3600 * 1000: r['followers_24h'] = r['followers'] - best['f']
    if pm:
        tid, m = max(pm, key=lambda x: x[1].get('impression_count', 0))
        r['top_post'] = {'url': f'https://x.com/{u["username"] if u else h}/status/{tid}', 'views': m.get('impression_count', 0)}
    out[h] = r
json.dump(own, open(SNAP, 'w'))
prev = json.load(open(os.path.join(ROOT, 'overview.json'))).get('users', {}) if os.path.exists(os.path.join(ROOT, 'overview.json')) else {}
prev.update(out)  # 只更新本次传入的账号，其余保留
res = {'updated_at': now.strftime('%Y-%m-%dT%H:%M:%SZ'), 'window_days': 7, 'users': prev}
json.dump(res, open(os.path.join(ROOT, 'overview.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print(json.dumps(res, ensure_ascii=False, indent=1))
