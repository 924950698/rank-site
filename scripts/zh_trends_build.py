#!/usr/bin/env python3
"""从 state/zh-trends-raw.json 聚合中文热点话题 → trends.json。只输出话题名/热度/帖数/代表帖链接，不落盘正文。"""
import json, math, re, time
from collections import defaultdict
from pathlib import Path
import jieba, jieba.posseg as pseg, jieba.analyse
jieba.setLogLevel(60)
ROOT = Path(__file__).resolve().parents[1]
raw = json.loads((ROOT / "state/zh-trends-raw.json").read_text())
KW = json.loads((ROOT / "scripts/keywords.json").read_text())
SPAM = set(KW.get("blacklist_words", [])) | set("""私信 加V 加微 带单 稳赚 保本 空投 撸毛 白名单 合约 杠杆 爆仓 喊单 交易所 返佣 邀请码 注册 链接 福利 约炮 裸聊 同城 楼凤 外围 上门 资源 看片 黄推 涩涩 色色 成人 男娘 小姐姐 福利姬 包养 博彩 赌场 棋牌 代理 兼职 日结 招聘 USDT 币安 OKX BTC ETH IPX 雞雞 鸡鸡 有人嗎 在線等 在线等 开云 百家乐 体育 娱乐城 交友 女大 反差 母狗 调教 露出 约啪 比特币 比特 币圈 山寨币 Exchange meme MEME Meme 土狗 金狗 百倍 千倍 CA 撸 airdrop""".split())
STOP = set("""的 了 是 在 我 你 他 她 它 们 这 那 有 和 就 也 都 不 没 很 还 又 被 把 给 对 说 要 会 能 让 想 去 来 到 上 下 里 中 个 一 人 什么 怎么 为什么 这个 那个 一个 我们 你们 他们 自己 没有 现在 今天 昨天 明天 时候 已经 还是 但是 因为 所以 如果 可以 就是 真的 这样 那样 一下 知道 觉得 看到 看看 大家 东西 事情 问题 一样 一直 其实 然后 而且 只是 只有 不是 还有 可能 应该 需要 开始 出来 起来 一起 今年 时间 感觉 喜欢 中国 国家 美国 日本 世界 社会 政府 人民 朋友 老师 孩子 女人 男人 视频 图片 新闻 突发 刚刚 热搜 曝光 比赛 发布 官宣 回应 夺冠 推特 推文 X 关注 转发 评论 点赞 分享 内容 账号 粉丝 互关 涨粉 回关 一定 最后 第一 之后 之前 以后 以前 不要 不能 不会 不用 非常 特别 越来 越 更 最 再 才 都是 还要 这么 那么 怎样 多少 哪里 这里 那里 所有 很多 一些 有些 这些 那些 别人 好像 当然 直接 完全 确实 继续 必须 甚至 包括 发现 表示 认为 进行 成为 通过 出现 作为 根据 关于 对于 以及 或者 而是 是否 一次 一天 一年 一种 两个 几个 每天 每个 生活 工作 世界 历史 文化 经济 政治 网友 博主 原文 全文 链接 详情 点击 转化率 创作者 曝光 进度条 老公 老婆 收益 分成 流量 数据 Sol SOL 主页 小号 大号 推友 蓝V 认证 会员 早安 早上好 晚安 卧槽 全网 刷到 没官 牛逼 哈哈 哈哈哈 笑死 破防 吐槽 求助 日常 网友们 谢谢 明白 中國 所有人 任何借口 道歉 Tomorrow 今天 晚上 早上 朋友们 老铁 兄弟 姐妹 东西 女朋友 男朋友 大佬 宝宝 全世界 智慧 朋友圈 聊天 the The Pro pro App app new New you is and for this that with 普通 说白了 首页 普通人 好消息 原以为 美金 卢比 gt GT 英雄 截图 #曝光""".split())
def eng(p): m = p.get("public_metrics", {}); return m.get("like_count",0) + 2*m.get("reply_count",0) + 3*m.get("retweet_count",0) + 3*m.get("quote_count",0) + m.get("bookmark_count",0)
posts = []
for p in raw["posts"]:
    t = p.get("text", "")
    if p.get("lang") != "zh" or any(w in t for w in SPAM) or t.count("#") > 5 or t.count("@") > 4: continue
    posts.append(p)
IDF = jieba.analyse.default_tfidf.idf_freq
ALIAS = {"Huang": "黄仁勋", "老黄": "黄仁勋", "Jensen": "黄仁勋", "JensenHuang": "黄仁勋", "特朗普": "川普", "Trump": "川普", "黃仁勳": "黄仁勋", "NVDA": "英伟达", "Nvidia": "英伟达", "NVIDIA": "英伟达", "輝達": "英伟达", "马斯克": "马斯克", "Musk": "马斯克", "Elon": "马斯克"}
GOOD_POS = {"nr","ns","nt","nz","nrt","eng","n","vn","x"}
def clean(t): return re.sub(r"https?://\S+|@\w+", " ", t)
def tokens(t):
    out = []
    for w, f in pseg.lcut(clean(t)):
        w = w.strip()
        if not w: continue
        out.append((w, f))
    return out
cand = defaultdict(lambda: {"posts": set(), "authors": set()})
for p in posts:
    pid, au = p["id"], p["author_id"]
    for tag in (p.get("entities") or {}).get("hashtags", []) or []:
        h = tag["tag"]
        if re.search(r"[\u4e00-\u9fff]", h) or len(h) >= 3: cand["#"+h]["posts"].add(pid); cand["#"+h]["authors"].add(au)
    toks = tokens(p.get("text",""))
    words = [w for w, f in toks]
    seen = set()
    for i, (w, f) in enumerate(toks):
        ok = lambda w, f: (f in GOOD_POS or f.startswith("n")) and w not in STOP and (len(w) >= 2 or re.match(r"[A-Za-z0-9]{2,}", w)) and not re.fullmatch(r"\d+|[^\w]+", w)
        if w not in STOP and len(w) >= 2 and ((ok(w, f) and (f in {"nr","ns","nt","nz","nrt","eng"} or len(w) >= 3)) or (re.search(r"[\u4e00-\u9fff]", w) and IDF.get(w, 0) >= 9.5)): seen.add(ALIAS.get(w, w))
        # 2~3 词短语（例：BLG 击败 T1）
        for n in (2, 3):
            seg = toks[i:i+n]
            if len(seg) < n: continue
            ws = [x for x, _ in seg]
            if any(re.fullmatch(r"[\s\W_]+", x) for x in ws) or ws[0] in STOP or ws[-1] in STOP: continue
            if not (ok(*seg[0]) or ok(*seg[-1])): continue
            ph = "".join(x if re.search(r"[\u4e00-\u9fff]", x) else x for x in ws)
            if 4 <= len(ph) <= 12: seen.add(ph)
    for w in seen: cand[w]["posts"].add(pid); cand[w]["authors"].add(au)
byid = {p["id"]: p for p in posts}
topics = []
for k, v in cand.items():
    na = len(v["authors"])
    if na < 3: continue
    if k.lower() in {s.lower() for s in STOP}: continue
    e = sum(eng(byid[i]) for i in v["posts"])
    score = round(math.log1p(e) * 10 + na * 8)
    topics.append({"k": k, "posts": v["posts"], "na": na, "e": e, "score": score})
topics.sort(key=lambda x: -x["score"])
# 合并：短词被长短语包含且帖子高度重合 → 保留更具体的那个；帖子重合度高的 → 合并
kept = []
for t in topics:
    dup = False
    for k in kept:
        inter = len(t["posts"] & k["posts"]) / max(1, min(len(t["posts"]), len(k["posts"])))
        if inter >= 0.6:
            if t["k"] in k["k"] or k["k"] in t["k"] or inter >= 0.8:
                dup = True; k["posts"] |= t["posts"]
                if t["k"] not in k["k"] and len(k.setdefault("rel", [])) < 3: k["rel"].append(t["k"])
                break
    if not dup: kept.append(t)
    if len(kept) >= 40: break
# 第二轮：与更热话题同帖率 ≥40% 的并入（作为关联词），首个关联词同帖率 ≥50% 时并入标题，如「黄仁勋 出轨」
final = []
for t in kept:
    host = None
    for k in final:
        if len(t["posts"] & k["posts"]) / max(1, len(t["posts"])) >= 0.4: host = k; break
    if host is None: final.append(t); continue
    r = len(t["posts"] & host["posts"]) / len(t["posts"])
    if r >= 0.5 and t["k"] not in host["k"] and not host["k"].startswith("#"): host.setdefault("join", []).append((t["k"], len(t["posts"])))
    if t["k"] not in host.get("rel", []) and len(host.setdefault("rel", [])) < 3: host["rel"].append(t["k"])
    host["posts"] |= t["posts"]
for t in final:
    j = [w for w in t.get("join", []) if re.search(r"[\u4e00-\u9fff]", w[0])] or t.get("join", [])
    if j:
        ent = lambda w: w in ALIAS.values() or any(f in {"nr","ns","nt","nz","nrt","eng"} for _, f in pseg.lcut(w))
        best = max(j, key=lambda w: (not ent(w[0]), w[1]))[0]
        t["k"] = t["k"] + " " + best; t["rel"] = [w for w in t.get("rel", []) if w != best]
    t["na"] = len({byid[i]["author_id"] for i in t["posts"]}); t["e"] = sum(eng(byid[i]) for i in t["posts"])
    t["score"] = round(math.log1p(t["e"]) * 10 + t["na"] * 8)
final.sort(key=lambda x: -x["score"])
out = []
final = [t for t in final if t["na"] >= 4]
for t in final[:20]:
    rep = max(t["posts"], key=lambda i: eng(byid[i]))
    rp = byid[rep]
    out.append({"name": t["k"], "heat": t["score"], "count": len(t["posts"]), "authors": t["na"], "related": t.get("rel", []),
                "rep": f"https://x.com/{rp.get('username') or 'i'}/status/{rep}"})
json.dump({"updated": raw["fetched"], "source": "x_recent_search_zh", "window_h": 6, "sampled": len(posts), "topics": out},
          open(ROOT / "trends.json", "w"), ensure_ascii=False, indent=1)
for t in out: print(t["heat"], t["count"], t["authors"], t["name"], t["related"])
