"""BrainFit Kids – Instagram Reel (1080x1920, 9:16, 29 s, 30 fps).

Usage: python3 make_reel.py <flyer1.png> <flyer2.png> <flyer3.png> <out_dir>
Renders frames with Pillow, synthesizes upbeat music + SFX with numpy,
and muxes everything with ffmpeg.
"""
import math, os, subprocess, sys, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, FPS, DUR = 1080, 1920, 30, 29.0
SR = 44100
F1, F2, F3, OUT = sys.argv[1:5]
os.makedirs(OUT, exist_ok=True)
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
NAVY, YEL, WHITE, GREEN, PINK = (14, 34, 78), (255, 210, 40), (255, 255, 255), (30, 160, 70), (235, 40, 110)

def font(s): return ImageFont.truetype(FONT, s)
def ease(t): t = max(0, min(1, t)); return 1 - (1 - t) ** 3
def back(t):
    t = max(0, min(1, t)); c = 1.7
    return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2

def cover(img, scale=1.0, dx=0, dy=0):
    s = max(W / img.width, H / img.height) * scale
    im = img.resize((int(img.width * s), int(img.height * s)), Image.LANCZOS)
    x = (im.width - W) // 2 + int(dx); y = (im.height - H) // 2 + int(dy)
    x = max(0, min(im.width - W, x)); y = max(0, min(im.height - H, y))
    return im.crop((x, y, x + W, y + H))

flyers = [Image.open(p).convert("RGB") for p in (F1, F2, F3)]
blur_bg = [cover(f, 1.15).filter(ImageFilter.GaussianBlur(28)) for f in flyers]

def gradient_bg(t):
    img = Image.new("RGB", (W, H))
    a = np.linspace(0, 1, H)[:, None]
    shift = 0.5 + 0.5 * math.sin(t * 1.3)
    top = np.array([20 + 20 * shift, 60, 140]); bot = np.array([10, 25, 70 + 30 * shift])
    arr = (top * (1 - a) + bot * a)[:, None, :].repeat(W, 1).reshape(H, W, 3)
    img = Image.fromarray(arr.astype(np.uint8))
    d = ImageDraw.Draw(img, "RGBA")
    rng = np.random.default_rng(3)
    for i in range(40):  # floating sparkles / numbers
        x = (rng.uniform(0, W) + t * 30 * (i % 3 - 1)) % W
        y = (rng.uniform(0, H) - t * 60 * (1 + i % 4)) % H
        if i % 4 == 0:
            d.text((x, y), str(i % 10), font=font(46), fill=(255, 255, 255, 50))
        else:
            r = 3 + i % 5; d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 220, 80, 90))
    return img

def text_c(d, y, s, size, fill=WHITE, stroke=0, sfill=NAVY, alpha=255, x=None):
    f = font(size); w = d.textlength(s, font=f)
    xx = (W - w) / 2 if x is None else x
    d.text((xx, y), s, font=f, fill=fill + (alpha,), stroke_width=stroke, stroke_fill=sfill + (alpha,))
    return w

def pill(d, y, s, size, bg=YEL, fg=NAVY, alpha=255, pad=34):
    f = font(size); w = d.textlength(s, font=f); h = size + pad
    x = (W - w) / 2 - pad
    d.rounded_rectangle((x, y, x + w + 2 * pad, y + h), radius=h // 2, fill=bg + (alpha,))
    d.text((x + pad, y + pad / 2 - size * 0.08), s, font=f, fill=fg + (alpha,))

def logo(d, y, scale=1.0, alpha=255):
    s1, s2 = "BrainFit ", "Kids"; f = font(int(92 * scale))
    w = d.textlength(s1, font=f) + d.textlength(s2, font=f); x = (W - w) / 2
    d.text((x, y), s1, font=f, fill=WHITE + (alpha,), stroke_width=4, stroke_fill=NAVY + (alpha,))
    d.text((x + d.textlength(s1, font=f), y), s2, font=f, fill=YEL + (alpha,), stroke_width=4, stroke_fill=NAVY + (alpha,))

def soroban(d, cx, cy, t, alpha=255):
    bw, bh = 760, 300; x0, y0 = cx - bw / 2, cy - bh / 2
    d.rounded_rectangle((x0, y0, x0 + bw, y0 + bh), 26, fill=(150, 85, 40, alpha), outline=(95, 50, 20, alpha), width=10)
    d.rectangle((x0 + 20, y0 + 95, x0 + bw - 20, y0 + 107), fill=(240, 240, 240, alpha))
    for i in range(9):
        x = x0 + 60 + i * 80
        d.line((x, y0 + 20, x, y0 + bh - 20), fill=(60, 40, 20, alpha), width=5)
        moved = (t * 6 + i * 0.7) % 4 > 2
        ty = y0 + (55 if not moved else 75)
        d.ellipse((x - 34, ty - 18, x + 34, ty + 18), fill=YEL + (alpha,), outline=(180, 120, 0, alpha), width=3)
        for k in range(4):
            by = y0 + 140 + k * 38 - (16 if (k < (i * 3 + int(t * 4)) % 5) else 0)
            d.ellipse((x - 34, by - 17, x + 34, by + 17), fill=YEL + (alpha,), outline=(180, 120, 0, alpha), width=3)

# ---------------- scenes ----------------
def scene_intro(t):  # 0-3s
    img = gradient_bg(t); d = ImageDraw.Draw(img, "RGBA")
    # burst rays
    for i in range(16):
        a = i * math.pi / 8 + t * 0.6; r1, r2 = 260, 260 + 700 * ease(t / 0.8)
        d.line((W / 2 + r1 * math.cos(a), 800 + r1 * math.sin(a), W / 2 + r2 * math.cos(a), 800 + r2 * math.sin(a)),
               fill=(255, 210, 40, 60), width=18)
    sc = back(t / 0.7)
    lay = Image.new("RGBA", (W, H)); ld = ImageDraw.Draw(lay)
    ld.ellipse((W / 2 - 200, 600, W / 2 + 200, 1000), fill=YEL + (255,))
    ld.text((W / 2 - 120, 680), "🧠" if False else "1+1", font=font(130), fill=NAVY + (255,))
    lay = lay.resize((max(1, int(W * sc)), max(1, int(H * sc))))
    img.paste(lay, (int((W - lay.width) / 2), int((H - lay.height) / 2 - 160 * (sc - 1))), lay)
    a = int(255 * ease((t - 0.6) / 0.5))
    logo(d, 1080, 1.0, a)
    if t > 1.2:
        pill(d, 1230, "Mental Arithmetik", 64, alpha=int(255 * ease((t - 1.2) / 0.4)))
    if t > 1.7:
        text_c(d, 1370, "Soroban-Kurs für Kinder 4–12", 46, alpha=int(255 * ease((t - 1.7) / 0.4)))
    return img

def scene_hook(t):  # 3-8s
    img = gradient_bg(t + 3); d = ImageDraw.Draw(img, "RGBA")
    a = int(255 * ease(t / 0.4))
    text_c(d, 260, "Kann dein Kind", 76, alpha=a, stroke=5)
    text_c(d, 360, "SO SCHNELL", 110, fill=YEL, alpha=a, stroke=6)
    text_c(d, 500, "im Kopf rechnen?", 76, alpha=a, stroke=5)
    probs = [("47 + 38", "85"), ("126 + 279", "405"), ("8 × 7", "56")]
    i = min(2, int(t / 1.5)); lt = t - i * 1.5
    q, ans = probs[i]
    sc = back(lt / 0.35)
    s = q + " = " + (ans if lt > 0.8 else "?")
    fit = min(150, int(150 * 820 / d.textlength(q + " = " + ans, font=font(150))))
    f = font(max(1, int(fit * max(0.01, sc))))
    w = d.textlength(s, font=f)
    d.rounded_rectangle((90, 760, W - 90, 1060), 50, fill=(255, 255, 255, 235))
    d.text(((W - w) / 2, 910 - fit * 0.6 * max(0.01, sc)), s, font=f, fill=(GREEN if lt > 0.8 else NAVY) + (255,))
    soroban(d, W / 2, 1400, t)
    text_c(d, 1650, "⚡ Ohne Taschenrechner!".replace("⚡ ", ""), 58, fill=YEL, stroke=4)
    return img

def scene_site(t):  # 8-13s
    img = gradient_bg(t + 8); d = ImageDraw.Draw(img, "RGBA")
    text_c(d, 200, "Online-Lernplattform", 70, stroke=5, alpha=int(255 * ease(t / 0.4)))
    text_c(d, 290, "für Kinder von 4–12 Jahren", 52, fill=YEL, stroke=4, alpha=int(255 * ease(t / 0.4)))
    items = [("57", "Lektionen", (90, 170, 255)), ("🎮", "Denkspiele", PINK), ("📚", "Bücher", (255, 150, 40)),
             ("🧮", "echter Soroban", GREEN)]
    labels = ["57", "∞", "+", "✓"]
    for k, ((_, lbl, col), sym) in enumerate(zip(items, labels)):
        st = t - 0.4 - k * 0.45
        if st < 0: continue
        e = back(st / 0.4); x = -900 + (900 + 110) * e if k % 2 == 0 else W + 50 - (W + 50 - 110) * e
        y = 470 + k * 270
        d.rounded_rectangle((x, y, x + 860, y + 220), 110, fill=(255, 255, 255, 240))
        d.ellipse((x + 15, y + 15, x + 205, y + 205), fill=col + (255,))
        f = font(80); sw = d.textlength(sym, font=f)
        d.text((x + 110 - sw / 2, y + 62), sym, font=f, fill=WHITE + (255,))
        d.text((x + 250, y + 72), lbl, font=font(64), fill=NAVY + (255,))
    if t > 2.6:
        pill(d, 1600, "15 Min. am Tag genügen", 56, bg=GREEN, fg=WHITE, alpha=int(255 * ease((t - 2.6) / 0.4)))
    return img

def scene_benefits(t):  # 13-17s : flyer 2 Ken Burns
    img = cover(flyers[1], 1.0 + 0.06 * t / 4, dy=-40 + 30 * t)
    d = ImageDraw.Draw(img, "RGBA")
    return img

def scene_webinar(t):  # 17-25s : flyer 1 then flyer 3
    if t < 4:
        img = cover(flyers[0], 1.08 - 0.06 * t / 4)
        d = ImageDraw.Draw(img, "RGBA")
        if t < 1.2:  # flash banner
            a = int(255 * (1 - ease((t - 0.8) / 0.4))) if t > 0.8 else 255
            d.rectangle((0, 820, W, 1060), fill=PINK + (int(a * 0.9),))
            text_c(d, 870, "GRATIS WEBINAR", 110, alpha=a, stroke=6)
    else:
        lt = t - 4
        img = cover(flyers[2], 1.0 + 0.05 * lt / 4, dy=20 * lt)
        d = ImageDraw.Draw(img, "RGBA")
        # pulsing ring around WhatsApp button
        p = (lt * 1.5) % 1
        r = 40 + 90 * p
        d.rounded_rectangle((30 - r / 3, 1240 - r / 3, W - 30 + r / 3, 1460 + r / 3), 130,
                            outline=(255, 255, 255, int(200 * (1 - p))), width=8)
    return img

def scene_outro(t):  # 25-29s
    img = gradient_bg(t + 25); d = ImageDraw.Draw(img, "RGBA")
    e = back(t / 0.6)
    lay = Image.new("RGBA", (W, H)); ld = ImageDraw.Draw(lay)
    logo(ld, 420, 1.15)
    lay = lay.resize((max(1, int(W * e)), max(1, int(H * e))))
    img.paste(lay, ((W - lay.width) // 2, int((H - lay.height) / 2 * 0.6)), lay)
    if t > 0.5:
        a = int(255 * ease((t - 0.5) / 0.4))
        text_c(d, 720, "Jetzt Platz sichern!", 80, fill=YEL, stroke=5, alpha=a)
        pill(d, 860, "So, 22.11.2026 · 18:00 · Online", 52, alpha=a)
    if t > 1.0:
        a = int(255 * ease((t - 1.0) / 0.4))
        d.rounded_rectangle((90, 1040, W - 90, 1250), 105, fill=GREEN + (a,))
        text_c(d, 1065, "WhatsApp-Anmeldung", 50, alpha=a)
        text_c(d, 1135, "0676 463 44 44", 84, fill=YEL, alpha=a)
    if t > 1.5:
        a = int(255 * ease((t - 1.5) / 0.4))
        text_c(d, 1340, "brainfitkids.mentalmath.at", 54, alpha=a, stroke=3)
        text_c(d, 1430, "@MentalMath.Kids", 54, fill=YEL, alpha=a, stroke=3)
    if t > 3.4:  # fade to black
        ov = Image.new("RGBA", (W, H), (0, 0, 0, int(255 * ease((t - 3.4) / 0.6))))
        img.paste(ov, (0, 0), ov)
    return img

SCENES = [(0, 3, scene_intro), (3, 8, scene_hook), (8, 13, scene_site), (13, 17, scene_benefits),
          (17, 25, scene_webinar), (25, 29, scene_outro)]
CUTS = [s for s, _, _ in SCENES[1:]] + [21]

def frame(n):
    tt = n / FPS
    for s, e, fn in SCENES:
        if s <= tt < e or (e == DUR and tt >= s):
            img = fn(tt - s); break
    # white flash transition at each cut
    for c in CUTS:
        dt = tt - c
        if 0 <= dt < 0.18:
            ov = Image.new("RGBA", (W, H), (255, 255, 255, int(220 * (1 - dt / 0.18))))
            img = img.convert("RGBA"); img.alpha_composite(ov)
    return img.convert("RGB")

# ---------------- audio ----------------
def audio():
    n = int(SR * DUR); t = np.arange(n) / SR; out = np.zeros(n)
    bpm = 120; beat = 60 / bpm
    chords = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]]  # C G Am F
    mtof = lambda m: 440 * 2 ** ((m - 69) / 12)
    for b in range(int(DUR / beat)):
        st = b * beat; i0 = int(st * SR); ch = chords[(b // 4) % 4]
        seg = np.arange(int(beat * SR)) / SR; i1 = min(n, i0 + len(seg)); seg = seg[: i1 - i0]
        env = np.exp(-seg * 3)
        for m in ch:  # pad/pluck
            out[i0:i1] += 0.06 * env * np.sign(np.sin(2 * np.pi * mtof(m) * seg)) * 0.5
            out[i0:i1] += 0.05 * env * np.sin(2 * np.pi * mtof(m + 12) * seg)
        bass = mtof(ch[0] - 24)
        out[i0:i1] += 0.18 * np.exp(-seg * 4) * np.sin(2 * np.pi * bass * seg)
        if 3 <= st < 27.5:  # drums after intro
            k = np.exp(-seg * 25) * np.sin(2 * np.pi * (50 + 120 * np.exp(-seg * 30)) * seg)
            out[i0:i1] += 0.5 * k
            hh_i = i0 + int(beat / 2 * SR); L = min(n - hh_i, int(0.05 * SR))
            if L > 0: out[hh_i:hh_i + L] += 0.08 * np.random.randn(L) * np.exp(-np.arange(L) / SR * 80)
            if b % 2 == 1:
                L = min(n - i0, int(0.15 * SR))
                out[i0:i0 + L] += 0.18 * np.random.randn(L) * np.exp(-np.arange(L) / SR * 25)
        # arpeggio lead from 8s
        if 8 <= st < 27:
            for q in range(4):
                m = ch[q % 3] + 12 + (12 if q == 3 else 0); s0 = i0 + int(q * beat / 4 * SR)
                L = min(n - s0, int(beat / 4 * SR)); ss = np.arange(L) / SR
                out[s0:s0 + L] += 0.05 * np.exp(-ss * 12) * np.sin(2 * np.pi * mtof(m) * ss)
    # SFX: whoosh at cuts, pop on intro, ding on answers, rise before webinar
    def add(at, sig):
        i = int(at * SR); L = min(len(sig), n - i); out[i:i + L] += sig[:L]
    wl = int(0.5 * SR); ws = np.arange(wl) / SR
    nz = np.convolve(np.random.randn(wl), np.ones(30) / 30, "same")
    whoosh = 0.5 * nz * np.sin(np.pi * ws / 0.5) ** 2
    for c in [3, 8, 13, 17, 21, 25]: add(c - 0.25, whoosh)
    ps = np.arange(int(0.15 * SR)) / SR
    pop = 0.5 * np.sin(2 * np.pi * (300 + 900 * ps) * ps) * np.exp(-ps * 30)
    for at in [0.2, 1.2, 1.7, 8.4, 8.85, 9.3, 9.75, 25.5, 26.0, 26.5]: add(at, pop)
    ds = np.arange(int(0.6 * SR)) / SR
    ding = 0.3 * (np.sin(2 * np.pi * 1318 * ds) + 0.5 * np.sin(2 * np.pi * 1975 * ds)) * np.exp(-ds * 6)
    for at in [3.8, 5.3, 6.8]: add(at, ding)
    rs = np.arange(int(1.0 * SR)) / SR
    add(16.0, 0.25 * np.random.randn(len(rs)) * rs ** 2 + 0.15 * np.sin(2 * np.pi * (200 + 800 * rs) * rs) * rs)
    fade = np.ones(n); fo = int(1.5 * SR); fade[-fo:] = np.linspace(1, 0, fo); fade[:int(0.05 * SR)] = np.linspace(0, 1, int(0.05 * SR))
    out *= fade; out /= np.max(np.abs(out)) / 0.9
    st = np.stack([out, np.roll(out, 200)], 1)
    with wave.open(os.path.join(OUT, "audio.wav"), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((st * 32767).astype(np.int16).tobytes())

audio()
mp4 = os.path.join(OUT, "BrainFitKids_Reel_9x16.mp4")
p = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                      "-r", str(FPS), "-i", "-", "-i", os.path.join(OUT, "audio.wav"), "-c:v", "libx264",
                      "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
                      "-t", str(DUR), "-movflags", "+faststart", mp4], stdin=subprocess.PIPE)
for n in range(int(DUR * FPS)):
    p.stdin.write(frame(n).tobytes())
    if n in (45, 160, 300, 420, 540, 700, 800): frame(n).save(os.path.join(OUT, f"preview_{n:03d}.jpg"), quality=70)
p.stdin.close(); p.wait()
print("done", mp4)
