#!/usr/bin/env python3
"""互评账本：把 x search_posts_all 原始结果合并成 ledger.json。
用法：
  python3 scripts/ledger.py ingest HANDLE out|in FILE   # out = from:HANDLE is:reply ; in = to:HANDLE is:reply
  python3 scripts/ledger.py next FILE [CUTOFF_ISO]       # 需要翻页时打印 pagination_token（最多翻到第 4 页）
  python3 scripts/ledger.py build                        # 生成 ledger.json（7 天窗口）
推荐查询参数（每个号每轮 2 次调用）：
  query="from:H is:reply" / "to:H is:reply", max_results=25, sort_order=recency, start_time=now-7d,
  post.fields=created_at,in_reply_to_user_id,author_id,referenced_tweets,conversation_id,
  expansions=in_reply_to_user_id,author_id,referenced_tweets.id, user.fields=username,name,profile_image_url
事件只存 id/时间/方向/url/对方，不存正文。按 post id 去重，超过 7 天丢弃。
"""
import json, sys, re, os, datetime as dt
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EV = os.path.join(ROOT, 'state', 'ledger-events.json')
OUT = os.path.join(ROOT, 'ledger.json')
WIN = 7

def load(p, d):
    try: return json.load(open(p))
    except Exception: return d

def parse_raw(path):
    s = open(path, encoding='utf-8').read()
    return json.loads(s[s.index('{'):s.rindex('}') + 1])

def av(u):
    return (u.get('profile_image_url') or '').replace('_normal.', '_400x400.')

def ingest(handle, direction, path):
    handle = handle.lower().lstrip('@')
    st = load(EV, {'events': {}, 'users': {}, 'tracked': []})
    d = parse_raw(path)
    inc = d.get('includes', {})
    users = {u['id']: u for u in inc.get('users', [])}
    for u in users.values():
        st['users'][u['username'].lower()] = {'name': u.get('name', ''), 'avatar': av(u), 'id': u['id']}
    parents = {t['id']: t for t in inc.get('tweets', [])}
    n = 0
    for t in d.get('data', []) or []:
        a = users.get(t.get('author_id'), {}).get('username', '').lower()
        b = users.get(t.get('in_reply_to_user_id'), {}).get('username', '').lower()
        if not a or not b or a == b: continue
        # 过滤“在自己帖子下回复评论者”：父帖是对方发的、且对方父帖本身是在回复我 → 是回答，不算去串门
        pid = next((r['id'] for r in t.get('referenced_tweets', []) or [] if r.get('type') == 'replied_to'), None)
        p = parents.get(pid)
        if p and p.get('in_reply_to_user_id') == t.get('author_id'):
            continue
        st['events'][t['id']] = {'a': a, 'b': b, 't': t['created_at'], 'u': t.get('url') or f'https://x.com/{a}/status/{t["id"]}'}
        n += 1
    if handle not in st['tracked']: st['tracked'].append(handle)
    json.dump(st, open(EV, 'w'), ensure_ascii=False, separators=(',', ':'))
    print(f'{handle} {direction}: {n} events kept, total {len(st["events"])}')

def build():
    st = load(EV, {'events': {}, 'users': {}, 'tracked': []})
    cut = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=WIN)).strftime('%Y-%m-%dT%H:%M:%S')
    st['events'] = {k: v for k, v in st['events'].items() if v['t'][:19] >= cut}
    json.dump(st, open(EV, 'w'), ensure_ascii=False, separators=(',', ':'))
    prof = load(os.path.join(ROOT, 'partners.json'), {}).get('profiles', {})
    def info(h):
        u = st['users'].get(h, {}); p = prof.get(h, {})
        return (u.get('name') or p.get('name')), (p.get('avatar') or u.get('avatar'))
    out = {}
    for me in st['tracked']:
        peers = {}
        for e in st['events'].values():
            if e['a'] == me: other, k = e['b'], 'me'
            elif e['b'] == me: other, k = e['a'], 'to_me'
            else: continue
            r = peers.setdefault(other, {'handle': other, 'me_to': 0, 'to_me': 0})
            if k == 'me':
                r['me_to'] += 1
                if e['t'] > r.get('last_me', ''): r['last_me'], r['last_me_url'] = e['t'], e['u']
            else:
                r['to_me'] += 1
                if e['t'] > r.get('last_to_me', ''): r['last_to_me'], r['last_to_me_url'] = e['t'], e['u']
        rows = []
        for h, r in peers.items():
            name, a = info(h)
            if name: r['name'] = name
            if a: r['avatar'] = a
            rows.append(r)
        rows.sort(key=lambda r: (r['me_to'] + r['to_me'], max(r.get('last_me', ''), r.get('last_to_me', ''))), reverse=True)
        out[me] = rows
    since = {}
    for me in out:
        ts = [e['t'] for e in st['events'].values() if me in (e['a'], e['b'])]
        if ts: since[me] = min(ts)[:19] + 'Z'
    led = {'updated_at': dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'window_days': WIN, 'users': out, 'since': since}
    tmp = OUT + '.tmp'; json.dump(led, open(tmp, 'w'), ensure_ascii=False, separators=(',', ':')); os.replace(tmp, OUT)
    print(f'ledger.json: {len(out)} users, {sum(len(v) for v in out.values())} peer rows, {len(st["events"])} events')

def next_page(path, cutoff=None):
    """打印下一页 pagination_token；若本页最早一条已早于 cutoff（默认 now-6h）或没有下一页，则不输出。"""
    d = parse_raw(path)
    if not cutoff:
        cutoff = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=6)).strftime('%Y-%m-%dT%H:%M:%S')
    ts = [t['created_at'] for t in d.get('data', []) or []]
    tok = (d.get('meta') or {}).get('next_token')
    if tok and ts and min(ts)[:19] > cutoff[:19]: print(tok)

if __name__ == '__main__':
    if sys.argv[1] == 'ingest': ingest(*sys.argv[2:5])
    elif sys.argv[1] == 'next': next_page(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
    else: build()
