"""Zenith pattern library generator.
Writes: inline path strings (json) + static SVG assets."""
import math, json, random
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

OUT = {}
def f(v):
    s = f"{v:.1f}"
    if s.endswith('.0'): s = s[:-2]
    return '0' if s == '-0' else s

# 1 — orbital resonance rose (Earth:Venus 13:8), viewBox -200 -200 400 400
def rose(R1=198, R2=143, years=8.0, n=260, ratio=1.6255):
    d = []
    for i in range(n):
        t = years * i / n
        a1 = 2 * math.pi * t - math.pi / 2
        a2 = 2 * math.pi * t * ratio - math.pi / 2
        x1, y1 = R1 * math.cos(a1), R1 * math.sin(a1)
        x2, y2 = R2 * math.cos(a2), R2 * math.sin(a2)
        d.append(f"M{f(x1)} {f(y1)}L{f(x2)} {f(y2)}")
    return ''.join(d)
OUT['rose'] = rose()
OUT['roseSmall'] = rose(n=150)

# 2 — celestial bezel ticks, centered at 0,0
def bezel(r0, minor, major, step=2, majEvery=10):
    d = []
    for k in range(0, 360, step):
        a = math.radians(k - 90)
        r1 = r0 + (major if k % majEvery == 0 else minor)
        d.append(f"M{f(r0*math.cos(a))} {f(r0*math.sin(a))}L{f(r1*math.cos(a))} {f(r1*math.sin(a))}")
    return ''.join(d)
OUT['bezel176'] = bezel(176, 3.5, 7.5)
OUT['bezel300'] = bezel(300, 4, 9)

# 3 — graticule (orthographic, axial tilt 23.44°), radius 200, as static SVG asset
def graticule(R=200, tilt=23.44, yaw=18):
    t = math.radians(tilt); y0 = math.radians(yaw)
    def proj(lat, lon):
        x = math.cos(lat) * math.cos(lon + y0); y = math.sin(lat); z = math.cos(lat) * math.sin(lon + y0)
        # tilt about x-axis
        y2 = y * math.cos(t) - z * math.sin(t); z2 = y * math.sin(t) + z * math.cos(t)
        return x * R, -y2 * R, z2
    paths = []
    def poly(pts):
        segs = []; cur = []
        for (x, y, z) in pts:
            if z >= -0.02: cur.append((x, y))
            else:
                if len(cur) > 1: segs.append(cur)
                cur = []
        if len(cur) > 1: segs.append(cur)
        return ''.join('M' + 'L'.join(f"{f(x)} {f(y)}" for x, y in s) for s in segs)
    mer = ''; par = ''
    for lon in range(0, 360, 15):
        pts = [proj(math.radians(la), math.radians(lon)) for la in np.linspace(-90, 90, 91)]
        mer += poly(pts)
    for lat in range(-75, 90, 15):
        pts = [proj(math.radians(lat), math.radians(lo)) for lo in np.linspace(0, 360, 181)]
        par += poly(pts)
    eq = poly([proj(0, math.radians(lo)) for lo in np.linspace(0, 360, 241)])
    ecl = ''
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="-210 -210 420 420" width="840" height="840">
<circle r="200" fill="none" stroke="#B9C7DA" stroke-opacity=".34" stroke-width=".6"/>
<path d="{mer}" fill="none" stroke="#B9C7DA" stroke-opacity=".20" stroke-width=".45"/>
<path d="{par}" fill="none" stroke="#B9C7DA" stroke-opacity=".20" stroke-width=".45"/>
<path d="{eq}" fill="none" stroke="#9BE6F5" stroke-opacity=".42" stroke-width=".7"/>
</svg>'''
    return svg
open('../assets/graticule.svg', 'w').write(graticule())

# 4 — starfield (402x874 and 1440x900)
def stars(W, H, n, seed):
    rnd = random.Random(seed)
    els = []
    for i in range(n):
        x, y = rnd.uniform(0, W), rnd.uniform(0, H)
        m = rnd.random() ** 3
        r = 0.35 + m * 0.95
        o = 0.18 + m * 0.7
        col = rnd.choice(['#FFFFFF', '#DDE9FF', '#FFF1E0', '#E6F7FF'])
        els.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="{r:.2f}" fill="{col}" fill-opacity="{o:.2f}"/>')
        if m > 0.72:
            L = 3 + m * 5
            els.append(f'<path d="M{f(x-L)} {f(y)}H{f(x+L)}M{f(x)} {f(y-L)}V{f(y+L)}" stroke="{col}" stroke-opacity="{o*0.35:.2f}" stroke-width=".5"/>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">' + ''.join(els) + '</svg>'
open('../assets/stars-phone.svg', 'w').write(stars(402, 874, 150, 7))
open('../assets/stars-desk.svg', 'w').write(stars(1440, 900, 260, 11))

# 5 — gravity field contours for Flows (map 402 x 440)
MW, MH = 402, 440
bodies = [
    ('vault', 201, 222, 1.00, 62),
    ('arsenal', 74, 96, 0.62, 48),
    ('qubit', 334, 84, 0.42, 40),
    ('yield', 58, 330, 0.16, 26),
    ('pioneer', 330, 338, 0.66, 50),
    ('compute', 190, 398, 0.36, 36),
]
xs = np.linspace(0, MW, 402); ys = np.linspace(0, MH, 440)
X, Y = np.meshgrid(xs, ys)
Z = np.zeros_like(X)
for _, bx, by, w, s in bodies:
    Z += w * np.exp(-((X - bx) ** 2 + (Y - by) ** 2) / (2 * s * s))
    Z += w * 0.35 * 1 / np.sqrt(((X - bx) ** 2 + (Y - by) ** 2) / (s * s) + 1.2)
levels = np.geomspace(Z.min() * 1.06, Z.max() * 0.97, 30)
fig = plt.figure(); cs = plt.contour(X, Y, Z, levels=levels)
minor = []; major = []
for li, segs in enumerate(cs.allsegs):
    for seg in segs:
        if len(seg) < 4: continue
        seg = seg[::3] if len(seg) > 18 else seg
        d = 'M' + 'L'.join(f"{f(x)} {f(y)}" for x, y in seg)
        (major if li % 5 == 0 else minor).append(d)
plt.close(fig)
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {MW} {MH}" width="{MW*2}" height="{MH*2}">
<path d="{''.join(minor)}" fill="none" stroke="#A9BCD4" stroke-opacity=".16" stroke-width=".55"/>
<path d="{''.join(major)}" fill="none" stroke="#B9E9F4" stroke-opacity=".34" stroke-width=".75"/>
</svg>'''
open('../assets/gravity-phone.svg', 'w').write(svg)
OUT['bodies'] = bodies

# desktop variant of the gravity field (map 560 x 300)
DW, DH = 560, 300
dbodies = [
    ('vault', 280, 150, 1.0, 50), ('arsenal', 70, 70, 0.6, 38), ('qubit', 150, 250, 0.42, 32),
    ('yield', 40, 200, 0.16, 20), ('pioneer', 480, 80, 0.66, 40), ('compute', 470, 238, 0.36, 30)]
xs = np.linspace(0, DW, 560); ys = np.linspace(0, DH, 300)
X, Y = np.meshgrid(xs, ys); Z = np.zeros_like(X)
for _, bx, by, w, s in dbodies:
    Z += w * np.exp(-((X - bx) ** 2 + (Y - by) ** 2) / (2 * s * s))
    Z += w * 0.35 * 1 / np.sqrt(((X - bx) ** 2 + (Y - by) ** 2) / (s * s) + 1.2)
levels = np.geomspace(Z.min() * 1.06, Z.max() * 0.97, 28)
fig = plt.figure(); cs = plt.contour(X, Y, Z, levels=levels)
minor = []; major = []
for li, segs in enumerate(cs.allsegs):
    for seg in segs:
        if len(seg) < 4: continue
        seg = seg[::3] if len(seg) > 18 else seg
        d = 'M' + 'L'.join(f"{f(x)} {f(y)}" for x, y in seg)
        (major if li % 5 == 0 else minor).append(d)
plt.close(fig)
open('../assets/gravity-desk.svg', 'w').write(f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {DW} {DH}" width="{DW*2}" height="{DH*2}">
<path d="{''.join(minor)}" fill="none" stroke="#A9BCD4" stroke-opacity=".15" stroke-width=".55"/>
<path d="{''.join(major)}" fill="none" stroke="#B9E9F4" stroke-opacity=".32" stroke-width=".75"/>
</svg>''')
OUT['dbodies'] = dbodies

# 6 — hash constellation: deterministic points from a proof hash
def constellation(h, R=34, n=8):
    b = bytes.fromhex(h)
    pts = []
    for i in range(n):
        a = (b[i] / 255) * 2 * math.pi + i * 0.78
        r = R * (0.35 + 0.65 * (b[i + n] / 255))
        pts.append((round(r * math.cos(a), 1), round(r * math.sin(a), 1)))
    # order by angle for a clean constellation line
    pts.sort(key=lambda p: math.atan2(p[1], p[0]))
    return pts
OUT['proof'] = '7f3a9c21e6b04d58a1c3f27e90b4d6c1'
OUT['constellation'] = constellation(OUT['proof'])

json.dump(OUT, open('patterns.json', 'w'))
for k, v in OUT.items():
    print(k, len(v) if isinstance(v, str) else v)
import os
for fn in ['graticule.svg', 'stars-phone.svg', 'stars-desk.svg', 'gravity-phone.svg', 'gravity-desk.svg']:
    print(fn, os.path.getsize('../assets/' + fn))
