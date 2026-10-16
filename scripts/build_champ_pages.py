#!/usr/bin/env python3
"""每个榜单冠军生成 champ/{board}.png（1200x630 分享预览图）和 champ/{board}.html（带 og 标签，打开后跳回站点冠军卡）。
只读 data.json，不调用 X 接口；头像从 data.json 里的图片地址下载，失败就画首字母。"""
import json, io, os, sys, html, urllib.request
from PIL import Image, ImageDraw, ImageFont
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://924950698.github.io/rank-site/"
FONT = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
NAMES = {"exposure": "曝光榜", "comments": "评论榜", "growth": "涨粉榜", "rising": "新号进步榜"}
def num(n):
    n = int(n or 0); return f"{n/10000:.1f}万".replace(".0万", "万") if n >= 10000 else (f"{n/1000:.1f}k" if n >= 1000 else str(n))
def champ(D, b):
    L = D.get(b) or []
    if b in ("growth", "rising"):
        if not L: return None
        x = L[0]; p = x.get("post") or {}; a = p.get("author") or x.get("author") or {}
        return a, f"+{num(x.get('gain'))} 粉"
    seen = set()
    for p in L:
        m = p.get("metrics") or {}; k = (p.get("author") or {}).get("username", "").lower()
        if (m.get("views") or 0) >= 5000 and not ((m.get("likes") or 0) + (m.get("replies") or 0) + (m.get("reposts") or 0)): continue
        if k in seen: continue
        seen.add(k)
        return p["author"], (f"{num(m.get('replies'))} 评论" if b == "comments" else f"{num(m.get('views'))} 曝光")
    return None
def avatar(url, size):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        im = Image.open(io.BytesIO(urllib.request.urlopen(req, timeout=10).read())).convert("RGB").resize((size, size))
    except Exception: return None
    mk = Image.new("L", (size, size), 0); ImageDraw.Draw(mk).ellipse((0, 0, size, size), fill=255); im.putalpha(mk); return im
def clean(t):  # 字体里没有的 emoji 去掉，避免画出方框
    return "".join(ch for ch in t if not (0x1F000 <= ord(ch) <= 0x1FFFF or 0x2600 <= ord(ch) <= 0x27BF or ord(ch) in (0xFE0F, 0x200D))).strip()
def F(s): return ImageFont.truetype(FONT, s)
def draw(a, stat, board, out):
    W, H = 1200, 630; im = Image.new("RGB", (W, H), "#050805"); d = ImageDraw.Draw(im)
    for y in range(H):  # 顶部金色渐变
        t = max(0, 1 - y / 420); d.line([(0, y), (W, y)], fill=(int(5 + 85 * t), int(8 + 66 * t), int(5 + 3 * t)))
    d.rounded_rectangle((20, 20, W - 20, H - 20), 36, outline="#ffd23f", width=5)
    S, cx, cy = 300, 230, 315
    av = avatar(a.get("avatar") or "", S)
    if av: im.paste(av, (cx - S // 2, cy - S // 2), av)
    else:
        d.ellipse((cx - S // 2, cy - S // 2, cx + S // 2, cy + S // 2), fill="#1d1f23")
        d.text((cx, cy), (a.get("username") or "?")[0].upper(), font=F(140), fill="#39ff14", anchor="mm")
    d.ellipse((cx - S // 2 - 6, cy - S // 2 - 6, cx + S // 2 + 6, cy + S // 2 + 6), outline="#ffd23f", width=10)
    x = 440
    d.text((x, 90), f"今日 X 中文{board}冠军", font=F(54), fill="#ffd23f")
    nm = clean(a.get("name") or "") or ("@" + (a.get("username") or "")); f = F(64)
    while d.textlength(nm, font=f) > W - x - 60 and len(nm) > 1: nm = nm[:-1]
    d.text((x, 190), nm, font=f, fill="#ffffff")
    d.text((x, 280), "@" + (a.get("username") or ""), font=F(40), fill="#c8c8c8")
    f2 = F(52); bw = d.textlength(stat, font=f2) + 80
    d.rounded_rectangle((x, 350, x + bw, 440), 45, fill="#ffd23f"); d.text((x + bw / 2, 395), stat, font=f2, fill="#000", anchor="mm")
    d.text((x, 500), "X 中文创作者成长站", font=F(40), fill="#39ff14")
    d.text((x, 555), "924950698.github.io/rank-site", font=F(28), fill="#c8c8c8")
    im.save(out, optimize=True)
PAGE = """<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{t}</title><meta name="description" content="{desc}">
<meta property="og:type" content="website"><meta property="og:url" content="{url}"><meta property="og:title" content="{t}"><meta property="og:description" content="{desc}">
<meta property="og:image" content="{img}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:site" content="@tigerr3aue">
<meta name="twitter:title" content="{t}"><meta name="twitter:description" content="{desc}"><meta name="twitter:image" content="{img}">
<meta http-equiv="refresh" content="0;url={go}"><script>location.replace({go_js})</script></head>
<body style="background:#000;color:#fff;font-family:sans-serif;text-align:center;padding:40px"><a href="{go}" style="color:#39ff14">去 X 中文创作者成长站看冠军卡片</a></body></html>"""
def main():
    D = json.load(open(os.path.join(ROOT, "data.json"), encoding="utf-8")); v = str(D.get("updated_at", ""))[:16].replace(":", "").replace("-", "")
    os.makedirs(os.path.join(ROOT, "champ"), exist_ok=True); done = []
    for b, name in NAMES.items():
        c = champ(D, b)
        if not c or not c[0].get("username"): continue
        a, stat = c; u = a["username"]
        draw(a, stat, name, os.path.join(ROOT, "champ", f"{b}.png"))
        go = f"{SITE}?champ={u}&board={b}#rank"; e = html.escape
        open(os.path.join(ROOT, "champ", f"{b}.html"), "w", encoding="utf-8").write(PAGE.format(
            t=e(f"今日 X 中文{name}冠军：{a.get('name') or u}（@{u}）"), desc=e(f"{stat}，来看看今天谁在爆，你排第几"),
            url=f"{SITE}champ/{b}.html", img=f"{SITE}champ/{b}.png?v={v}", go=e(go), go_js=json.dumps(go)))
        done.append(f"{b}:@{u}")
    print("champ pages:", " ".join(done) or "none")
if __name__ == "__main__": main()
