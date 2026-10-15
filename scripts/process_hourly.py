#!/usr/bin/env python3
"""Merge X search/partner raw JSON into data.json / partners.json (PRD v1.3)."""
from __future__ import annotations
import json, os, sys, time, re
from pathlib import Path
from datetime import datetime, timezone, timedelta

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / "state"
OWNER = "tigerr3aue"
H24_MS = 86400_000
MIN_FOLLOWERS = 500
BLACKLIST_WORDS = ["私信领取", "带单", "稳赚", "保本", "加V", "加微"]
BLACKLIST_USERS = set()

def load(p, default):
    try:
        return json.loads(Path(p).read_text())
    except Exception:
        return default

def write_atomic(path: Path, obj):
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(obj, ensure_ascii=False, indent=1) + "\n")
    os.replace(tmp, path)

def now_ms():
    return int(time.time() * 1000)

def normalize_search(payload: dict) -> list[dict]:
    users = {u["id"]: u for u in (payload.get("includes") or {}).get("users") or []}
    media = {m["media_key"]: m for m in (payload.get("includes") or {}).get("media") or []}
    out = []
    for t in payload.get("data") or []:
        text = t.get("text") or ""
        if t.get("lang") and t["lang"] != "zh":
            continue
        refs = t.get("referenced_tweets") or []
        if any(r.get("type") == "retweeted" for r in refs):
            continue
        if any(w in text for w in BLACKLIST_WORDS):
            continue
        u = users.get(t.get("author_id") or "", {})
        uname = (u.get("username") or "").lower()
        if not uname or uname == OWNER or uname in BLACKLIST_USERS:
            continue
        pm = t.get("public_metrics") or {}
        img = None
        for k in (t.get("attachments") or {}).get("media_keys") or []:
            m = media.get(k)
            if m and (m.get("type") == "photo" or m.get("preview_image_url")):
                img = {"url": m.get("url") or m.get("preview_image_url"), "w": m.get("width"), "h": m.get("height")}
                break
        out.append({
            "id": t["id"],
            "url": f"https://x.com/{u.get('username')}/status/{t['id']}",
            "created_at": t.get("created_at"),
            "author": {
                "id": u.get("id"),
                "name": u.get("name"),
                "username": u.get("username"),
                "avatar": u.get("profile_image_url"),
                "followers": (u.get("public_metrics") or {}).get("followers_count") or 0,
            },
            "metrics": {
                "views": pm.get("impression_count") or 0,
                "replies": pm.get("reply_count") or 0,
                "reposts": pm.get("retweet_count") or 0,
                "likes": pm.get("like_count") or 0,
                "quotes": pm.get("quote_count") or 0,
                "bookmarks": pm.get("bookmark_count") or 0,
            },
            "image": img,
        })
    return out

def ok_post(p):
    a = p.get("author") or {}
    if not a.get("username"):
        return False
    if (a.get("followers") or 0) < MIN_FOLLOWERS:
        return False
    if a["username"].lower() == OWNER or a["username"] in BLACKLIST_USERS:
        return False
    try:
        created = datetime.fromisoformat(p["created_at"].replace("Z", "+00:00"))
    except Exception:
        return False
    age = (datetime.now(timezone.utc) - created).total_seconds() * 1000
    return age < H24_MS

def interactions(p):
    m = p["metrics"]
    return m["replies"] + m["reposts"] + m["likes"] + m["quotes"]

def gain_of(hist, aid):
    h = hist.get(aid) or []
    if len(h) < 2:
        return None
    now = now_ms()
    old = next((x for x in h if now - x["t"] <= H24_MS + 3600_000), None)
    if not old:
        return None
    span = h[-1]["t"] - old["t"]
    if span < 23 * 3600_000:
        return None
    return h[-1]["f"] - old["f"]

def compute(pool, follower_hist, api_calls):
    posts = [p for p in pool.values() if ok_post(p)]
    def top(arr, key, n=50):
        return sorted(arr, key=lambda p: p["metrics"][key], reverse=True)[:n]
    by_author = {}
    for p in posts:
        aid = p["author"]["id"]
        a = by_author.setdefault(aid, {"author": p["author"], "posts": [], "interactions": 0})
        a["posts"].append(p)
        a["interactions"] += interactions(p)
        # keep freshest author metrics
        a["author"] = p["author"]
    growth = []
    for a in by_author.values():
        g = gain_of(follower_hist, a["author"]["id"])
        if g and g > 0:
            best = top(a["posts"], "views", 1)
            if best:
                growth.append({"gain": g, "post": best[0]})
    growth.sort(key=lambda x: x["gain"], reverse=True)
    best = sorted(by_author.values(), key=lambda x: x["interactions"], reverse=True)[:10]
    best = [{"author": a["author"], "interactions": a["interactions"], "gain": gain_of(follower_hist, a["author"]["id"])} for a in best]
    return {
        "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
        "exposure": top(posts, "views", 10),
        "comments": top(posts, "replies", 10),
        "growth": growth[:10],
        "photos": top([p for p in posts if p.get("image")], "views", 60),
        "best": best,
        "meta": {"pool_size": len(posts), "api_calls_this_run": api_calls},
    }

def cmd_merge_posts(raw_paths, api_calls: int):
    STATE.mkdir(parents=True, exist_ok=True)
    pool = load(STATE / "posts.json", {})
    hist = load(STATE / "followers.json", {})
    for path in raw_paths:
        payload = load(path, {})
        for p in normalize_search(payload):
            pool[p["id"]] = p
    # drop >24h
    now = datetime.now(timezone.utc)
    for pid in list(pool.keys()):
        try:
            created = datetime.fromisoformat(pool[pid]["created_at"].replace("Z", "+00:00"))
            if (now - created).total_seconds() * 1000 > H24_MS:
                del pool[pid]
        except Exception:
            del pool[pid]
    t = now_ms()
    for p in pool.values():
        aid = p["author"]["id"]
        if not aid:
            continue
        h = hist.setdefault(aid, [])
        if not h or t - h[-1]["t"] > 30 * 60_000:
            h.append({"t": t, "f": p["author"]["followers"]})
    for aid in list(hist.keys()):
        hist[aid] = [x for x in hist[aid] if t - x["t"] < 26 * 3600_000]
        if not hist[aid]:
            del hist[aid]
    data = compute(pool, hist, api_calls)
    write_atomic(STATE / "posts.json", pool)
    write_atomic(STATE / "followers.json", hist)
    write_atomic(ROOT / "data.json", data)
    print(json.dumps({"ok": True, "pool": len(pool), "exposure": len(data["exposure"]), "comments": len(data["comments"]), "growth": len(data["growth"]), "photos": len(data["photos"]), "best": len(data["best"])}))

HANDLE_RE = re.compile(r"@([A-Za-z0-9_]{1,15})")

def extract_partners_from_posts(payload: dict, self_handle: str, self_id: str | None) -> tuple[dict, dict]:
    """Return (counts{handle:int}, profiles{handle:{name,avatar}})."""
    users = {u["id"]: u for u in (payload.get("includes") or {}).get("users") or []}
    counts: dict[str, int] = {}
    profiles: dict[str, dict] = {}
    self_l = self_handle.lower()
    for u in users.values():
        h = (u.get("username") or "").lower()
        if h and h != self_l:
            profiles[h] = {"name": u.get("name") or h, "avatar": u.get("profile_image_url") or ""}
    for t in payload.get("data") or []:
        author = users.get(t.get("author_id") or "", {})
        author_h = (author.get("username") or "").lower()
        text = t.get("text") or ""
        # mentions in text
        for m in HANDLE_RE.findall(text):
            h = m.lower()
            if h == self_l:
                continue
            counts[h] = counts.get(h, 0) + 1
        # if this is someone else's post mentioning/replying to self, count the author
        if author_h and author_h != self_l:
            # mentions endpoint: others mentioning self
            if self_id and t.get("author_id") != self_id:
                # only count if @self in text or in_reply_to
                if f"@{self_l}" in text.lower() or True:
                    # for mentions API all posts mention the user; for posts API only count outs
                    pass
            counts[author_h] = counts.get(author_h, 0) + 1
            profiles[author_h] = {
                "name": author.get("name") or author_h,
                "avatar": author.get("profile_image_url") or "",
            }
        # referenced users already in expansions
    # remove self
    counts.pop(self_l, None)
    profiles.pop(self_l, None)
    return counts, profiles

def merge_partner_counts(posts_payload, mentions_payload, self_handle, self_id):
    """posts = user's own timeline (outgoing replies/@); mentions = inbound @."""
    counts: dict[str, int] = {}
    profiles: dict[str, dict] = {}
    self_l = self_handle.lower()
    users_posts = {(u.get("username") or "").lower(): u for u in (posts_payload.get("includes") or {}).get("users") or []}
    users_all = {u["id"]: u for u in (posts_payload.get("includes") or {}).get("users") or []}
    users_all.update({u["id"]: u for u in (mentions_payload.get("includes") or {}).get("users") or []})

    def add_profile(u):
        h = (u.get("username") or "").lower()
        if h and h != self_l:
            profiles[h] = {"name": u.get("name") or h, "avatar": u.get("profile_image_url") or ""}

    for u in users_all.values():
        add_profile(u)

    # Outgoing: from user's posts, count @handles and in_reply_to authors
    for t in posts_payload.get("data") or []:
        text = t.get("text") or ""
        for m in HANDLE_RE.findall(text):
            h = m.lower()
            if h != self_l:
                counts[h] = counts.get(h, 0) + 1
        # reply-to user via referenced tweets author if present in includes — skip if unknown
        for ref in t.get("referenced_tweets") or []:
            if ref.get("type") == "replied_to":
                # can't resolve without tweet lookup; rely on @ in text
                pass

    # Inbound mentions: count authors
    for t in mentions_payload.get("data") or []:
        u = users_all.get(t.get("author_id") or "", {})
        h = (u.get("username") or "").lower()
        if h and h != self_l:
            counts[h] = counts.get(h, 0) + 1
            add_profile(u)
        for m in HANDLE_RE.findall(t.get("text") or ""):
            hm = m.lower()
            if hm != self_l:
                counts[hm] = counts.get(hm, 0) + 1

    counts.pop(self_l, None)
    # top 30
    ranked = sorted(counts.items(), key=lambda x: (-x[1], x[0]))[:30]
    lst = []
    for h, c in ranked:
        pr = profiles.get(h) or {"name": h, "avatar": ""}
        lst.append({"handle": h, "name": pr.get("name") or h, "avatar": pr.get("avatar") or "", "count": c})
    return lst, profiles

def cmd_merge_partners(jobs_path: str):
    """jobs: [{handle, id, posts_file, mentions_file}]"""
    jobs = load(jobs_path, [])
    prev = load(ROOT / "partners.json", {})
    # drop sample
    users = {} if prev.get("sample") else dict(prev.get("users") or {})
    profiles = {} if prev.get("sample") else dict(prev.get("profiles") or {})
    fetched = {} if prev.get("sample") else dict((prev.get("meta") or {}).get("fetched_at") or {})
    now = datetime.now(timezone.utc)
    # purge >7d
    cutoff = now - timedelta(days=7)
    for h in list(fetched.keys()):
        try:
            ts = datetime.fromisoformat(fetched[h].replace("Z", "+00:00"))
            if ts < cutoff:
                users.pop(h, None)
                fetched.pop(h, None)
        except Exception:
            users.pop(h, None)
            fetched.pop(h, None)
    for job in jobs:
        handle = job["handle"].lower().lstrip("@")
        posts = load(job["posts_file"], {})
        ments = load(job["mentions_file"], {})
        lst, pr = merge_partner_counts(posts, ments, handle, job.get("id"))
        if lst:
            users[handle] = lst
            fetched[handle] = now.strftime("%Y-%m-%dT%H:%M:%SZ")
            profiles.update(pr)
            # also store self profile if present
            for payload in (posts, ments):
                for u in (payload.get("includes") or {}).get("users") or []:
                    if (u.get("username") or "").lower() == handle:
                        profiles[handle] = {"name": u.get("name") or handle, "avatar": u.get("profile_image_url") or ""}
    out = {
        "updated_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "method": "按最近回复和@次数",
        "users": users,
        "profiles": profiles,
        "meta": {"fetched_at": fetched, "accounts_this_run": len(jobs)},
    }
    write_atomic(ROOT / "partners.json", out)
    print(json.dumps({"ok": True, "users": len(users), "this_run": len(jobs), "profiles": len(profiles)}))

if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "merge-posts":
        calls = int(sys.argv[2])
        cmd_merge_posts(sys.argv[3:], calls)
    elif cmd == "merge-partners":
        cmd_merge_partners(sys.argv[2])
    else:
        sys.exit("unknown cmd")
