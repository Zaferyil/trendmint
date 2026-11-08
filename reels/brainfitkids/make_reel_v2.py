"""BrainFit Kids – Premium Instagram Reel v2 (1080x1920, 29 s, 30 fps).

Usage: python3 make_reel_v2.py <assets_dir> <voiceover.mp3> <out_dir>
assets_dir must contain flyer1.png, flyer2.png, flyer3.png.
Voiceover (ElevenLabs, German) is placed at VO_OFFSET; music is ducked under it.
"""
import math, os, subprocess, sys, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

ASSETS, VO, OUT = sys.argv[1:4]
os.makedirs(OUT, exist_ok=True)
W, H, FPS, DUR, SR = 1080, 1920, 30, 29.0, 44100
VO_OFFSET = 1.0
FD = "/usr/share/fonts/opentype/inter/"
GOLD, GOLD2, CREAM, WHITE = (255, 200, 60), (255, 236, 160), (255, 246, 225), (255, 255, 255)
NAVY, INK, GREEN, ROSE = (10, 22, 52), (6, 12, 30), (37, 211, 102), (255, 92, 130)

_fc = {}
def F(size, w="Black"):
    k = (size, w)
    if k not in _fc:
        _fc[k] = ImageFont.truetype(FD + f"InterDisplay-{w}.otf", max(1, int(size)))
    return _fc[k]

def cl(x, a=0, b=1): return max(a, min(b, x))
def eo(t): t = cl(t); return 1 - (1 - t) ** 4                 # ease-out quart
def eio(t): t = cl(t); return t * t * (3 - 2 * t)
def bk(t, s=1.4): t = cl(t); return 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2
def win(t, a, b, fi=0.35, fo=0.3):  # visibility window 0..1
    return eo((t - a) / fi) * (1 - eio((t - (b - fo)) / fo))

# ---------- assets ----------
fl = [Image.open(os.path.join(ASSETS, f"flyer{i}.png")).convert("RGB") for i in (1, 2, 3)]
def crop_r(img, box, size):
    return img.crop(box).resize(size, Image.LANCZOS)
KIDS = crop_r(fl[0], (0, 700, 941, 1250), (1000, 584))
BOY = crop_r(fl[1], (560, 600, 941, 1160), (560, 823))
ABAC = crop_r(fl[0], (165, 1040, 712, 1205), (900, 271))

def rounded(img, r, border=0, bcol=GOLD):
    m = Image.new("L", img.size, 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, *img.size), r, fill=255)
    out = img.convert("RGBA"); out.putalpha(m)
    if border:
        d = ImageDraw.Draw(out); d.rounded_rectangle((1, 1, img.width - 2, img.height - 2), r, outline=bcol + (255,), width=border)
    return out

KIDS_R, BOY_R, ABAC_R = rounded(KIDS, 48, 5), rounded(BOY, 48, 5), rounded(ABAC, 30)

def shadow(sz, r, blur=40, a=170):
    s = Image.new("RGBA", (sz[0] + blur * 4, sz[1] + blur * 4), (0, 0, 0, 0))
    ImageDraw.Draw(s).rounded_rectangle((blur * 2, blur * 2, blur * 2 + sz[0], blur * 2 + sz[1]), r, fill=(0, 0, 0, a))
    return s.filter(ImageFilter.GaussianBlur(blur))
SH_KIDS, SH_BOY = shadow(KIDS.size, 48), shadow(BOY.size, 48)

# ---------- background ----------
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
RAD = np.sqrt(((xx - W / 2) / W) ** 2 + ((yy - H * 0.42) / H) ** 2)
VIG = np.clip(1 - (RAD * 1.25) ** 2.2, 0, 1)[..., None]
rng = np.random.default_rng(7)
BOKEH = [(rng.uniform(0, W), rng.uniform(0, H), rng.uniform(6, 34), rng.uniform(0.2, 1), rng.uniform(0, 6.28)) for _ in range(34)]
GRAIN = [(rng.normal(0, 7, (H // 2, W // 2))).astype(np.int16) for _ in range(6)]

def background(t, hue=0.0):
    c1 = np.array([18, 40, 96]) * (1 - hue) + np.array([60, 24, 70]) * hue
    base = INK + (c1 - INK) * VIG
    glow = np.exp(-(((xx - W * (0.5 + 0.18 * math.sin(t * 0.5))) / 520) ** 2 + ((yy - H * 0.3) / 700) ** 2))[..., None]
    base = base + glow * np.array([70, 55, 10]) * 0.55
    img = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8)).convert("RGBA")
    lay = Image.new("RGBA", (W, H)); d = ImageDraw.Draw(lay)
    for x, y, r, sp, ph in BOKEH:
        yy2 = (y - t * 40 * sp) % (H + 80) - 40; xx2 = x + 20 * math.sin(t * 0.7 + ph)
        a = int(40 + 50 * (0.5 + 0.5 * math.sin(t * 2 * sp + ph)))
        d.ellipse((xx2 - r, yy2 - r, xx2 + r, yy2 + r), fill=(255, 210, 120, a))
    lay = lay.filter(ImageFilter.GaussianBlur(6))
    img.alpha_composite(lay)
    return img

def finish(img, t):
    arr = np.asarray(img.convert("RGB")).astype(np.int16)
    g = GRAIN[int(t * FPS) % len(GRAIN)].repeat(2, 0).repeat(2, 1)
    arr = arr + g[..., None]
    arr = (arr * (0.55 + 0.45 * np.clip(1 - (RAD * 1.05) ** 3, 0, 1))[..., None])  # vignette
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))

# ---------- text helpers ----------
def gold_text(txt, size, w="Black", grad=(GOLD2, GOLD)):
    f = F(size, w); bb = f.getbbox(txt); tw, th = bb[2] + 8, bb[3] + 12
    m = Image.new("L", (tw, th)); ImageDraw.Draw(m).text((2, 2), txt, font=f, fill=255)
    g = np.linspace(0, 1, th)[:, None, None]
    col = (np.array(grad[0]) * (1 - g) + np.array(grad[1]) * g).repeat(tw, 1)
    im = Image.fromarray(col.astype(np.uint8)).convert("RGBA"); im.putalpha(m)
    return im

def solid_text(txt, size, col=WHITE, w="Black"):
    f = F(size, w); bb = f.getbbox(txt)
    im = Image.new("RGBA", (bb[2] + 8, bb[3] + 12)); ImageDraw.Draw(im).text((2, 2), txt, font=f, fill=col + (255,))
    return im

def put(canvas, im, cx, y, alpha=1.0, scale=1.0, glow=0, center=True, dy=0):
    if alpha <= 0.01: return
    if scale != 1.0:
        im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.LANCZOS)
    if alpha < 1:
        a = im.getchannel("A").point(lambda v: int(v * alpha)); im = im.copy(); im.putalpha(a)
    x = int(cx - im.width / 2) if center else int(cx); y = int(y + dy - (im.height / 2 if center else 0))
    if glow:
        gl = im.copy().filter(ImageFilter.GaussianBlur(glow))
        canvas.alpha_composite(gl, (x, y)) if 0 <= x and 0 <= y and x + gl.width <= W and y + gl.height <= H else canvas.paste(gl, (x, y), gl)
    canvas.paste(im, (x, y), im)

def word_reveal(canvas, words, cx, y, t, start, step, size, colors, w="Black"):
    """Words rise + fade in one by one, centered as a line."""
    ims = [(gold_text(x, size, w) if c == "gold" else solid_text(x, size, c, w)) for x, c in zip(words, colors)]
    sp = size * 0.28; total = sum(i.width for i in ims) + sp * (len(ims) - 1); x = cx - total / 2
    for k, im in enumerate(ims):
        p = eo((t - start - k * step) / 0.45)
        if p > 0: put(canvas, im, x, y + 40 * (1 - p), alpha=p, center=False)
        x += im.width + sp

def glass(canvas, box, r=40, a=70, border=(255, 255, 255, 60)):
    x0, y0, x1, y1 = [int(v) for v in box]
    x0, y0 = max(0, x0), max(0, y0); x1, y1 = min(W, x1), min(H, y1)
    if x1 <= x0 or y1 <= y0: return
    region = canvas.crop((x0, y0, x1, y1)).filter(ImageFilter.GaussianBlur(18))
    m = Image.new("L", region.size); ImageDraw.Draw(m).rounded_rectangle((0, 0, *region.size), r, fill=255)
    canvas.paste(region, (x0, y0), m)
    ov = Image.new("RGBA", canvas.size); d = ImageDraw.Draw(ov)
    d.rounded_rectangle((x0, y0, x1, y1), r, fill=(255, 255, 255, a), outline=border, width=2)
    canvas.alpha_composite(ov)

def logo(canvas, cx, y, s=1.0, a=1.0):
    b, k = solid_text("BrainFit", 96 * s, WHITE), gold_text("Kids", 96 * s)
    tot = b.width + k.width; put(canvas, b, cx - tot / 2, y, a, center=False); put(canvas, k, cx - tot / 2 + b.width, y, a, center=False)
    # brain-ish emblem: concentric arcs
    ov = Image.new("RGBA", canvas.size); d = ImageDraw.Draw(ov); r = 70 * s; ey = y - 110 * s
    d.ellipse((cx - r, ey - r, cx + r, ey + r), outline=GOLD + (int(255 * a),), width=int(7 * s))
    for i, ang in enumerate(range(0, 360, 60)):
        ax = cx + r * 0.55 * math.cos(math.radians(ang)); ay = ey + r * 0.55 * math.sin(math.radians(ang))
        d.ellipse((ax - 9 * s, ay - 9 * s, ax + 9 * s, ay + 9 * s), fill=GOLD2 + (int(255 * a),))
        d.line((cx, ey, ax, ay), fill=GOLD + (int(200 * a),), width=int(4 * s))
    d.ellipse((cx - 14 * s, ey - 14 * s, cx + 14 * s, ey + 14 * s), fill=WHITE + (int(255 * a),))
    canvas.alpha_composite(ov)

def light_sweep(canvas, t, y0, y1, dur=0.8):
    if not 0 <= t <= dur: return
    ov = Image.new("RGBA", canvas.size); d = ImageDraw.Draw(ov)
    x = -300 + (W + 600) * (t / dur)
    d.polygon([(x, y0), (x + 120, y0), (x - 80, y1), (x - 200, y1)], fill=(255, 255, 255, 70))
    canvas.alpha_composite(ov.filter(ImageFilter.GaussianBlur(20)))

def pill(canvas, txt, cx, cy, size, bg=GOLD, fg=INK, a=1.0, pad=(46, 22)):
    f = F(size, "ExtraBold"); bb = f.getbbox(txt); w, h = bb[2] + pad[0] * 2, bb[3] + pad[1] * 2
    im = Image.new("RGBA", (w, h)); d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, w - 1, h - 1), h // 2, fill=bg + (255,)); d.text((pad[0], pad[1] - bb[1] / 2), txt, font=f, fill=fg + (255,))
    put(canvas, im, cx, cy, a)

def card(canvas, img, sh, cx, cy, t, a, scale=1.0, rot=0.0):
    im = img; shi = sh
    if scale != 1.0:
        im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
        shi = sh.resize((int(sh.width * scale), int(sh.height * scale)))
    if rot:
        im = im.rotate(rot, Image.BICUBIC, expand=True); shi = shi.rotate(rot, Image.BICUBIC, expand=True)
    put(canvas, shi, cx, cy + 30, a); put(canvas, im, cx, cy, a)

# ---------- scenes (VO v3, offset 1.0 s) ----------
LOGO_IMG = Image.open(os.path.join(ASSETS, "logo.png")).convert("RGBA")
def logo(canvas, cx, cy, s=1.0, a=1.0, width=760):
    w = max(1, int(width * s)); im = LOGO_IMG.resize((w, int(LOGO_IMG.height * w / LOGO_IMG.width)), Image.LANCZOS)
    gl = Image.new("RGBA", (im.width + 200, im.height + 200)); gl.paste(im, (100, 100), im)
    gl = gl.filter(ImageFilter.GaussianBlur(30)); al = gl.getchannel("A").point(lambda v: int(v * 0.5)); gl.putalpha(al)
    put(canvas, gl, cx, cy, a); put(canvas, im, cx, cy, a)

def s_intro(c, t):  # 0 – 1.0
    ov = Image.new("RGBA", c.size); d = ImageDraw.Draw(ov)
    for i in range(3):
        r = 80 + 900 * eo((t - i * 0.1) / 1.0)
        d.ellipse((W / 2 - r, 900 - r, W / 2 + r, 900 + r), outline=GOLD + (int(130 * (1 - cl(t / 1.0))),), width=5)
    c.alpha_composite(ov)
    logo(c, W / 2, 900, 0.6 + 0.4 * bk(t / 0.6), eo(t / 0.3), 900)
    light_sweep(c, t - 0.35, 700, 1100, 0.6)

def s_hook(c, t):  # 1.0 – 4.6  "Mach dein Kind fit für Mathe – mit BrainFit Kids!"
    a = win(t, 0, 3.6, 0.3, 0.3)
    word_reveal(c, ["Mach", "dein", "Kind"], W / 2, 230, t, 0.0, 0.12, 100, [WHITE, WHITE, WHITE])
    word_reveal(c, ["fit", "für"], W / 2, 350, t, 0.4, 0.12, 120, ["gold", WHITE])
    put(c, gold_text("MATHE!", 210), W / 2, 580, a * eo((t - 0.8) / 0.3), scale=0.7 + 0.3 * bk((t - 0.8) / 0.45))
    card(c, KIDS_R, SH_KIDS, W / 2, 1060, t, a * eo((t - 0.3) / 0.5), 0.96 + 0.04 * t / 3.6)
    if t > 1.85:
        put(c, solid_text("mit", 50, CREAM, "SemiBold"), W / 2, 1420, a * eo((t - 1.85) / 0.3))
        logo(c, W / 2, 1620, 0.7 + 0.3 * bk((t - 1.9) / 0.5), a * eo((t - 1.9) / 0.25), 620)

def s_potential(c, t):  # 4.6 – 7.3  "Jedes Kind hat unglaubliches Potenzial."
    a = win(t, 0, 2.7, 0.3, 0.3)
    card(c, BOY_R, SH_BOY, W / 2, 1230, t, a * eo(t / 0.5), 1.0 + 0.04 * t / 2.7, 2)
    word_reveal(c, ["Jedes", "Kind", "hat"], W / 2, 240, t, 0.0, 0.12, 96, [WHITE, WHITE, WHITE])
    put(c, gold_text("unglaubliches", 118), W / 2, 450, a * eo((t - 0.6) / 0.35), scale=0.8 + 0.2 * bk((t - 0.6) / 0.45))
    put(c, gold_text("Potenzial", 150), W / 2, 600, a * eo((t - 0.9) / 0.35), scale=0.8 + 0.2 * bk((t - 0.9) / 0.45))
    light_sweep(c, t - 1.3, 380, 700, 0.8)

BENEFITS = [("Konzentration", 0.4), ("Gedächtnis", 1.3), ("Mathematisches Denken", 2.2)]
def s_benefits(c, t):  # 7.3 – 14.4
    a = win(t, 0, 7.1, 0.35, 0.35)
    put(c, solid_text("Wir fördern", 90, WHITE), W / 2, 260, a * eo(t / 0.35), dy=30 * (1 - eo(t / 0.35)))
    for k, (name, st) in enumerate(BENEFITS):
        p = eo((t - st) / 0.45)
        if p <= 0: continue
        y = 400 + k * 170; x0 = 70 - 500 * (1 - p)
        glass(c, (x0, y, x0 + 940, y + 140), 70, int(60 * p * a), (255, 210, 100, int(120 * p * a)))
        ov = Image.new("RGBA", c.size); d = ImageDraw.Draw(ov)
        d.ellipse((x0 + 22, y + 22, x0 + 118, y + 118), fill=GOLD + (int(255 * p * a),))
        d.line([(x0 + 48, y + 72), (x0 + 64, y + 90), (x0 + 94, y + 52)], fill=INK + (int(255 * p * a),), width=12, joint="curve")
        c.alpha_composite(ov)
        put(c, solid_text(name, 58 if len(name) > 15 else 64, WHITE), x0 + 150, y + 34, p * a, center=False)
        if 0 < t - st < 0.7: light_sweep(c, t - st, y, y + 140, 0.7)
    # "für mehr Selbstvertrauen und bessere Leistungen in der Schule" (~3.8s)
    pf = eo((t - 3.7) / 0.4)
    if pf > 0:
        put(c, ABAC_R, W / 2, 1080, a * pf, dy=40 * (1 - pf))
        put(c, solid_text("für mehr", 56, CREAM, "SemiBold"), W / 2, 1300, a * pf)
        put(c, gold_text("Selbstvertrauen", 110), W / 2, 1420, a * eo((t - 4.0) / 0.35), scale=0.8 + 0.2 * bk((t - 4.0) / 0.45))
        pill(c, "+ bessere Leistungen in der Schule", W / 2, 1590, 44, GREEN, WHITE, a * eo((t - 5.0) / 0.35))

def s_trust(c, t):  # 14.4 – 18.2  "Fünfzehn Jahre Erfahrung. Tausende erfolgreiche Kinder."
    a = win(t, 0, 3.8, 0.3, 0.3)
    n = int(15 * eo(t / 0.9))
    put(c, gold_text(f"{n}", 400), W / 2, 560, a, scale=0.9 + 0.1 * bk(t / 0.5))
    put(c, solid_text("Jahre Erfahrung", 96, WHITE), W / 2, 820, a * eo((t - 0.3) / 0.35))
    ov = Image.new("RGBA", c.size); d = ImageDraw.Draw(ov)
    d.line((W / 2 - 200, 960, W / 2 + 200, 960), fill=GOLD + (int(200 * a),), width=4); c.alpha_composite(ov)
    pk = eo((t - 1.0) / 0.4)
    if pk > 0:
        put(c, gold_text("Tausende", 150), W / 2, 1120, a * pk, scale=0.8 + 0.2 * bk((t - 1.0) / 0.45))
        put(c, solid_text("erfolgreiche Kinder", 84, WHITE), W / 2, 1290, a * eo((t - 1.3) / 0.35))
        for k in range(5):  # stars
            ps = eo((t - 1.6 - k * 0.1) / 0.3)
            if ps > 0: put(c, gold_text("★", 90), W / 2 + (k - 2) * 120, 1460, a * ps, scale=0.5 + 0.5 * bk((t - 1.6 - k * 0.1) / 0.35))

def s_webinar(c, t):  # 18.2 – 24.2  "Jetzt ist dein Kind an der Reihe! Kostenloser Online-Infoabend am Sonntag, 22. November."
    a = win(t, 0, 6.0, 0.3, 0.3)
    if t < 1.7:
        aa = 1 - eio((t - 1.4) / 0.3)
        word_reveal(c, ["Jetzt", "ist", "dein", "Kind"], W / 2, 640, t, 0.0, 0.1, 100, [WHITE] * 4)
        put(c, gold_text("an der Reihe!", 150), W / 2, 900, aa * eo((t - 0.5) / 0.3), scale=0.75 + 0.25 * bk((t - 0.5) / 0.45))
        if t < 1.4: return
    lt = t - 1.4; p = bk(lt / 0.5)
    pill(c, "KOSTENLOS", W / 2, 250, 44, ROSE, WHITE, a * cl(lt / 0.2))
    put(c, solid_text("Online-", 110, WHITE), W / 2, 390, a * eo(lt / 0.35), scale=0.85 + 0.15 * p)
    put(c, gold_text("Infoabend", 150), W / 2, 530, a * eo((lt - 0.15) / 0.35), scale=0.85 + 0.15 * p)
    put(c, solid_text("für Eltern", 48, CREAM, "SemiBold"), W / 2, 665, a * eo((lt - 0.5) / 0.35))
    light_sweep(c, lt - 0.4, 430, 630, 0.8)
    pd = eo((lt - 1.0) / 0.45)
    if pd > 0:
        y0 = 800 + 80 * (1 - pd)
        glass(c, (110, y0, W - 110, y0 + 560), 56, int(55 * pd * a), (255, 210, 100, int(140 * pd * a)))
        ov = Image.new("RGBA", c.size); d = ImageDraw.Draw(ov)
        d.rounded_rectangle((110, y0, W - 110, y0 + 110), 56, fill=ROSE + (int(230 * pd * a),))
        d.rectangle((110, y0 + 60, W - 110, y0 + 110), fill=ROSE + (int(230 * pd * a),)); c.alpha_composite(ov)
        put(c, solid_text("SONNTAG", 52, WHITE, "ExtraBold"), W / 2, y0 + 55, pd * a)
        put(c, gold_text("22", 240), W / 2, y0 + 260, pd * a, scale=0.9 + 0.1 * bk((lt - 1.2) / 0.5))
        put(c, solid_text("NOVEMBER 2026", 60, WHITE, "ExtraBold"), W / 2, y0 + 420, eo((lt - 1.6) / 0.35) * a)
        put(c, solid_text("18:00 Uhr  ·  Online", 48, CREAM, "SemiBold"), W / 2, y0 + 500, eo((lt - 2.0) / 0.35) * a)
    logo(c, W / 2, 1600, 1.0, a * eo((lt - 2.4) / 0.4), 460)

def s_cta(c, t):  # 24.2 – 26.8  "Sichere dir jetzt deinen Platz – per WhatsApp!"
    a = win(t, 0, 2.6, 0.3, 0.25)
    word_reveal(c, ["Sichere", "dir", "jetzt"], W / 2, 330, t, 0.0, 0.1, 96, [WHITE] * 3)
    put(c, gold_text("deinen kostenlosen", 84), W / 2, 520, a * eo((t - 0.35) / 0.3))
    put(c, gold_text("Platz!", 170), W / 2, 670, a * eo((t - 0.5) / 0.3), scale=0.75 + 0.25 * bk((t - 0.5) / 0.45))
    pw = eo((t - 0.9) / 0.35)
    if pw > 0:
        pulse = (t * 1.8) % 1; y = 900; e = 30 * pulse
        ov = Image.new("RGBA", c.size); d = ImageDraw.Draw(ov)
        d.rounded_rectangle((70 - e, y - e, W - 70 + e, y + 240 + e), 120 + e, outline=GREEN + (int(230 * (1 - pulse) * a),), width=7)
        d.rounded_rectangle((70, y, W - 70, y + 240), 120, fill=GREEN + (int(255 * pw * a),))
        d.ellipse((105, y + 40, 265, y + 200), fill=WHITE + (int(255 * pw * a),))
        d.ellipse((143, y + 78, 227, y + 162), outline=GREEN + (int(255 * pw * a),), width=11)
        c.alpha_composite(ov)
        put(c, solid_text("Schreib uns per WhatsApp", 42, WHITE, "Bold"), 295, y + 45, pw * a, center=False)
        put(c, solid_text("0676 463 44 44", 84, WHITE), 295, y + 105, pw * a, center=False)
    po = eo((t - 1.4) / 0.35)
    put(c, solid_text("oder direkt anmelden auf", 44, CREAM, "SemiBold"), W / 2, 1300, a * po)
    pill(c, "brainfitkids.mentalmath.at", W / 2, 1400, 52, GOLD, INK, a * po)

def s_outro(c, t):  # 26.8 – 29
    ov = Image.new("RGBA", c.size); d = ImageDraw.Draw(ov); r = 330 + 30 * math.sin(t * 3)
    d.ellipse((W / 2 - r, 760 - r, W / 2 + r, 760 + r), fill=GOLD + (45,)); c.alpha_composite(ov.filter(ImageFilter.GaussianBlur(70)))
    logo(c, W / 2, 760, 0.8 + 0.2 * bk(t / 0.55), eo(t / 0.3), 900)
    light_sweep(c, t - 0.4, 560, 980, 0.7)
    put(c, solid_text("Wir freuen uns auf dich! 👋".replace(" 👋", ""), 62, WHITE), W / 2, 1150, eo((t - 0.4) / 0.35))
    pill(c, "Gratis Infoabend · So 22.11. · 18:00", W / 2, 1290, 42, GOLD, INK, eo((t - 0.6) / 0.35))
    put(c, solid_text("@MentalMath.Kids", 44, GOLD, "Bold"), W / 2, 1420, eo((t - 0.8) / 0.35))

SCENES = [(0.0, 1.0, s_intro, 0.0), (1.0, 4.6, s_hook, 0.0), (4.6, 7.3, s_potential, 0.1), (7.3, 14.4, s_benefits, 0.15),
          (14.4, 18.2, s_trust, 0.0), (18.2, 24.2, s_webinar, 0.35), (24.2, 26.8, s_cta, 0.0), (26.8, 29.0, s_outro, 0.0)]

def frame(n):
    tt = n / FPS
    for s, e, fn, hue in SCENES:
        if s <= tt < e or (e == DUR and tt >= s): break
    c = background(tt, hue)
    lt = tt - s
    # zoom-in transition at scene start
    fn(c, lt)
    if lt < 0.25 and s > 0:
        z = 1 + 0.12 * (1 - eo(lt / 0.25))
        cc = c.resize((int(W * z), int(H * z)), Image.BILINEAR)
        c = cc.crop(((cc.width - W) // 2, (cc.height - H) // 2, (cc.width - W) // 2 + W, (cc.height - H) // 2 + H))
        fl_ = Image.new("RGBA", (W, H), (255, 240, 200, int(120 * (1 - lt / 0.25)))); c.alpha_composite(fl_)
    if tt < 0.3: c.alpha_composite(Image.new("RGBA", (W, H), (0, 0, 0, int(255 * (1 - tt / 0.3)))))
    if tt > DUR - 0.6: c.alpha_composite(Image.new("RGBA", (W, H), (0, 0, 0, int(255 * eio((tt - DUR + 0.6) / 0.6)))))
    # progress bar
    d = ImageDraw.Draw(c); d.rectangle((0, H - 10, int(W * tt / DUR), H), fill=GOLD + (255,))
    return finish(c, tt)

# ---------- audio ----------
def lp(x, a):  # one-pole lowpass
    y = np.empty_like(x); s = 0.0
    from itertools import accumulate
    # vectorized-ish via scipy-free IIR
    for i in range(0, len(x), 4096):
        seg = x[i:i + 4096]; out = np.empty_like(seg)
        for j, v in enumerate(seg): s += a * (v - s); out[j] = s
        y[i:i + 4096] = out
    return y

def music():
    """Happy kids track: C-major, 124 BPM, ukulele strums, glockenspiel melody, claps, bouncy bass."""
    n = int(SR * DUR); out = np.zeros(n); rng = np.random.default_rng(1)
    beat = 60 / 124; m2f = lambda m: 440 * 2 ** ((m - 69) / 12)
    prog = [[60, 64, 67], [67, 71, 74], [69, 72, 76], [65, 69, 72]]  # C G Am F
    mel = [76, 79, 81, 79, 76, 74, 72, 74, 76, 76, 74, 72, 74, 79, 76, None,
           72, 74, 76, 79, 81, 79, 76, 74, 72, 74, 76, 74, 72, None, 72, None]
    def add(i, sig):
        L = min(len(sig), n - i)
        if L > 0: out[i:i + L] += sig[:L]
    def pluck(f, d, a):  # Karplus-Strong ukulele
        N = max(2, int(SR / f)); buf = rng.uniform(-1, 1, N); L = int(d * SR); y = np.empty(L)
        for k in range(L):
            y[k] = buf[k % N]; buf[k % N] = 0.996 * 0.5 * (buf[k % N] + buf[(k + 1) % N])
        return a * y
    cache = {}
    def uke(m):
        if m not in cache: cache[m] = pluck(m2f(m), 0.5, 0.11)
        return cache[m]
    def glock(f, a=0.13):
        s = np.arange(int(0.7 * SR)) / SR
        return a * (np.sin(2 * np.pi * f * s) + 0.35 * np.sin(2 * np.pi * f * 2.76 * s)) * np.exp(-s * 5)
    clap_s = np.arange(int(0.12 * SR)) / SR
    clap = 0.18 * rng.standard_normal(len(clap_s)) * (np.exp(-clap_s * 40) + 0.5 * np.exp(-(clap_s - 0.012).clip(0) * 60) * (clap_s > 0.012))
    nb = int(DUR / beat) + 1
    for b in range(nb):
        st = b * beat; i0 = int(st * SR); ch = prog[(b // 4) % 4]
        # ukulele: down-up strum on every half beat
        for h in (0, 0.5):
            j = i0 + int(h * beat * SR)
            for q, m in enumerate(ch + [ch[0] + 12]):
                add(j + int(q * 0.008 * SR), uke(m) * (1.0 if h == 0 else 0.6))
        # bouncy bass
        s = np.arange(int(0.25 * SR)) / SR; f = m2f(ch[0] - 24 + (7 if b % 2 else 0))
        add(i0, 0.25 * np.sin(2 * np.pi * f * s) * np.exp(-s * 8))
        if st >= 1.4:
            s = np.arange(int(0.25 * SR)) / SR
            add(i0, 0.45 * np.sin(2 * np.pi * (50 + 100 * np.exp(-s * 35)) * s) * np.exp(-s * 12))
            if b % 2 == 1: add(i0, clap)
            sh = 0.03 * rng.standard_normal(int(0.04 * SR)) * np.exp(-np.arange(int(0.04 * SR)) / SR * 70)
            add(i0 + int(0.5 * beat * SR), sh)
        # glockenspiel melody (half-beat notes) from 6 s on
        if 6.2 <= st < 27.5:
            for h in range(2):
                m = mel[(b * 2 + h) % len(mel)]
                if m: add(i0 + int(h * beat / 2 * SR), glock(m2f(m + 12)))
    return out

def sfx(n):
    out = np.zeros(n)
    def add(at, sig):
        i = int(at * SR); L = min(len(sig), n - i); out[i:i + L] += sig[:L]
    def whoosh(d=0.6, a=0.35):
        L = int(d * SR); s = np.arange(L) / SR; nz = np.random.randn(L)
        P = np.fft.rfft(nz); fr = np.fft.rfftfreq(L, 1 / SR); P *= np.exp(-((fr - 1500) / 1200) ** 2); nz = np.fft.irfft(P, L)
        return a * nz / np.max(np.abs(nz)) * np.sin(np.pi * s / d) ** 3
    def riser(d=1.2):
        L = int(d * SR); s = np.arange(L) / SR
        return 0.18 * np.sin(2 * np.pi * (150 * s + 600 * s ** 2 / d)) * (s / d) ** 2 + 0.06 * np.random.randn(L) * (s / d) ** 3
    def impact():
        L = int(1.2 * SR); s = np.arange(L) / SR
        return 0.7 * np.sin(2 * np.pi * (38 + 60 * np.exp(-s * 8)) * s) * np.exp(-s * 3.5) + 0.15 * np.random.randn(L) * np.exp(-s * 20)
    def chime(f=1568):
        L = int(1.0 * SR); s = np.arange(L) / SR
        return 0.18 * (np.sin(2 * np.pi * f * s) + 0.5 * np.sin(2 * np.pi * f * 2.0 * s) + 0.25 * np.sin(2 * np.pi * f * 3.0 * s)) * np.exp(-s * 4)
    def tick():
        L = int(0.05 * SR); s = np.arange(L) / SR
        return 0.12 * np.sin(2 * np.pi * 2400 * s) * np.exp(-s * 120)
    add(0.0, riser(0.8)); add(0.7, impact())
    for c in (1.0, 4.6, 7.3, 14.4, 18.2, 24.2, 26.8): add(c - 0.3, whoosh())
    add(1.8, chime(1760)); add(2.95, chime(2093))                    # MATHE! / logo
    add(6.2, chime(1568))                                            # Potenzial
    for st in (7.7, 8.6, 9.5): add(st, chime(1318))                  # benefit cards
    add(11.3, chime(1760))                                           # Selbstvertrauen
    for k in range(15): add(14.4 + k * 0.9 / 15, tick())             # 15 counter
    for k in range(5): add(16.0 + k * 0.1, chime(2093 + k * 200) * 0.5)  # stars
    add(17.0, riser(1.2)); add(18.2, impact()); add(18.7, chime(2093))
    add(20.6, chime(1568)); add(21.0, chime(1760))                   # date card
    add(25.1, chime(2349))                                           # whatsapp
    add(26.8, impact() * 0.7); add(27.0, chime(1760))
    return out

def build_audio():
    n = int(SR * DUR)
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", VO, "-f", "s16le", "-ac", "1", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    vo = np.frombuffer(raw, np.int16).astype(np.float64) / 32768
    voice = np.zeros(n); i = int(VO_OFFSET * SR); L = min(len(vo), n - i); voice[i:i + L] = vo[:L]
    voice *= 0.95 / max(1e-9, np.max(np.abs(voice)))
    # sidechain: smooth envelope of voice
    env = np.abs(voice); k = int(0.25 * SR); env = np.convolve(env, np.ones(k) / k, "same"); env = np.clip(env / (env.max() * 0.35), 0, 1)
    duck = 1 - 0.6 * env
    m = music(); m *= 0.55 / np.max(np.abs(m))
    fade = np.ones(n); fo = int(1.2 * SR); fade[-fo:] = np.linspace(1, 0, fo)
    mix = m * duck * fade + voice + sfx(n) * (1 - 0.35 * env)
    mix = np.tanh(mix * 1.1) * 0.92
    st = np.stack([mix, mix], 1)
    with wave.open(os.path.join(OUT, "mix.wav"), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st * 32767).astype(np.int16).tobytes())

if __name__ == "__main__":
    build_audio()
    mp4 = os.path.join(OUT, "BrainFitKids_Reel_Premium_9x16.mp4")
    previews = [int(x * FPS) for x in (0.8, 3.8, 6.8, 13.0, 17.5, 18.9, 23.0, 25.8, 28.0)]
    if "--audio-only" in sys.argv:
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", mp4, "-i", os.path.join(OUT, "mix.wav"), "-map", "0:v",
                        "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-t", str(DUR), "-movflags", "+faststart",
                        mp4.replace(".mp4", "_happy.mp4")], check=True)
        sys.exit()
    if "--preview" in sys.argv:
        for n in previews: frame(n).save(os.path.join(OUT, f"pv_{n:03d}.jpg"), quality=75)
        sys.exit()
    p = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                          "-r", str(FPS), "-i", "-", "-i", os.path.join(OUT, "mix.wav"), "-c:v", "libx264", "-preset", "slow",
                          "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "256k", "-t", str(DUR),
                          "-movflags", "+faststart", mp4], stdin=subprocess.PIPE)
    for n in range(int(DUR * FPS)):
        p.stdin.write(frame(n).tobytes())
    p.stdin.close(); p.wait(); print("done", mp4)
