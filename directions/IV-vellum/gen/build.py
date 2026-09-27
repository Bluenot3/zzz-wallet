"""Build Vellum (Direction IV) artboards from src/ into project/ (or publish/project with --publish)."""
import json, os, re, sys, glob
HERE = os.path.dirname(os.path.abspath(__file__))
V4 = os.path.dirname(HERE)

BASE_CSS = r"""
body{margin:0;background:#E9DCBF;color:#2B2118;font-family:'Alegreya Sans',ui-sans-serif,-apple-system,'Segoe UI',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
a{color:#243F9A;text-decoration:none}a:hover{color:#15296B}
button{font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
a:focus-visible,button:focus-visible{outline:2px solid #243F9A;outline-offset:3px}
.vl-serif{font-family:'Cormorant Garamond',Cormorant,Garamond,'Times New Roman',serif}
.vl-sc{font-family:'Alegreya SC',Alegreya,Georgia,serif;letter-spacing:.09em}
.vl-script{font-family:'Pinyon Script','Snell Roundhand',cursive}
.vl-onum{font-variant-numeric:oldstyle-nums proportional-nums}
.vl-tnum{font-variant-numeric:lining-nums tabular-nums}
.vl-vellum{background-color:#EFE3C8;background-image:url(/_blob/VL_TILE);background-size:256px 256px}
.vl-rubric{color:#A3321F}
.vl-hit{position:relative}
.vl-hit::after{content:"";position:absolute;left:50%;top:50%;width:max(100%,44px);height:max(100%,44px);transform:translate(-50%,-50%)}
.vl-glass{position:relative;background:linear-gradient(180deg,rgba(255,255,255,.42) 0%,rgba(255,252,244,.16) 55%,rgba(255,255,255,.26) 100%);-webkit-backdrop-filter:blur(2px) saturate(165%) brightness(1.04);backdrop-filter:blur(2px) saturate(165%) brightness(1.04);box-shadow:inset 0 1.5px 0 rgba(255,255,255,.95),inset 0 -1px 0 rgba(255,255,255,.45),inset 0 0 0 1px rgba(255,255,255,.34),inset 0 -12px 20px -12px rgba(120,86,36,.28),0 14px 30px -14px rgba(64,42,14,.45),0 2px 5px rgba(64,42,14,.16)}
.vl-glass::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:radial-gradient(90% 60% at 22% 0%,rgba(255,255,255,.75),rgba(255,255,255,0) 55%),radial-gradient(60% 50% at 88% 110%,rgba(255,255,255,.4),rgba(255,255,255,0) 60%);mix-blend-mode:soft-light}
.vl-glass::after{content:"";position:absolute;inset:0;border-radius:inherit;padding:1px;pointer-events:none;background:conic-gradient(from 210deg,rgba(255,255,255,.9),rgba(255,210,170,.5) 12%,rgba(255,255,255,.1) 30%,rgba(150,190,255,.45) 50%,rgba(255,255,255,.1) 70%,rgba(255,255,255,.9));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}
.vl-refract-dock{-webkit-backdrop-filter:blur(2px) saturate(165%) brightness(1.04);backdrop-filter:url(#vl-dockref) blur(.5px) saturate(175%) brightness(1.05)}
.vl-refract-sheet{-webkit-backdrop-filter:blur(10px) saturate(165%) brightness(1.05);backdrop-filter:url(#vl-sheetref) blur(8px) saturate(175%) brightness(1.06)}
.vl-sheet{background-color:#F6EEDC;background-image:url(/_blob/VL_TILE);background-size:256px 256px}
.vl-lift{box-shadow:0 1px 0 rgba(255,255,255,.7) inset,0 22px 44px -22px rgba(70,45,15,.55),0 3px 8px rgba(70,45,15,.16)}
.vl-wax{background:radial-gradient(circle at 36% 30%,#7C93F0 0%,#3553C4 26%,#1E3290 58%,#121E5C 100%);box-shadow:inset 0 2px 3px rgba(255,255,255,.45),inset 0 -3px 6px rgba(0,0,20,.5),0 3px 8px rgba(20,30,90,.35)}
.vl-gold{background-image:linear-gradient(100deg,#8C6418 0%,#E9C46A 22%,#FFF1C4 36%,#C8962F 52%,#F3D48A 70%,#8C6418 100%);background-size:220% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;animation:vl-gilt 7s ease-in-out infinite}
@keyframes vl-gilt{0%,100%{background-position:0 0}50%{background-position:100% 0}}
.vl-ink{animation:vl-ink 1.6s cubic-bezier(.3,.1,.1,1) both}
@keyframes vl-ink{from{clip-path:inset(0 100% 0 0);filter:blur(1.2px);opacity:.4}60%{filter:blur(.3px);opacity:1}to{clip-path:inset(0 -2% 0 0);filter:blur(0);opacity:1}}
.vl-rise{animation:vl-rise 1s cubic-bezier(.2,.8,.2,1) both}
@keyframes vl-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.vl-draw{animation:vl-draw 2.2s cubic-bezier(.45,0,.2,1) both}
@keyframes vl-draw{from{stroke-dashoffset:var(--len)}to{stroke-dashoffset:0}}
.vl-spin{animation:vl-spin 120s linear infinite}
@keyframes vl-spin{to{transform:rotate(360deg)}}
.vl-tile{transition:transform .35s cubic-bezier(.2,.8,.2,1),box-shadow .35s ease}
.vl-tile:hover{transform:translateY(-2px)}
@media (prefers-reduced-motion:reduce){.vl-gold,.vl-spin{animation:none!important}.vl-ink,.vl-rise,.vl-draw{animation-duration:.01s!important;animation-delay:0s!important}}
""".strip()

DEFS = """<svg width="0" height="0" style="position: absolute" aria-hidden="true" focusable="false">
<defs>
<symbol id="vl-mark" viewBox="0 0 100 86"><path fill-rule="evenodd" d="M0 31L12 31L22 21L10 21L10 9L44 9L0 53L0 75L5 75L10 70L10 57L58 9L77 9L0 86L100 86L100 55L88 55L78 65L90 65L90 77L56 77L100 33L100 11L95 11L90 16L90 29L42 77L23 77L100 0L0 0Z"></path></symbol>
<linearGradient id="vl-g-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FBE6A8"></stop><stop offset=".35" stop-color="#D9AC4B"></stop><stop offset=".6" stop-color="#F6DC92"></stop><stop offset="1" stop-color="#8C6418"></stop></linearGradient>
<linearGradient id="vl-g-lapis" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5B78E0"></stop><stop offset="1" stop-color="#1B2F7E"></stop></linearGradient>
<linearGradient id="vl-g-verm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E4704F"></stop><stop offset="1" stop-color="#9C2E1B"></stop></linearGradient>
<linearGradient id="vl-g-tyr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#B062A6"></stop><stop offset="1" stop-color="#55204F"></stop></linearGradient>
<pattern id="vl-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><path d="M0 0V4" stroke="#2B2118" stroke-opacity=".35" stroke-width=".7"></path></pattern>
<filter id="vl-deckle" x="-4%" y="-4%" width="108%" height="108%"><feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="3" seed="7" result="n"></feTurbulence><feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap></filter>
<filter id="vl-leaf" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3" result="n"></feTurbulence><feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 .9  0 0 0 0 .6  0 0 0 .55 0" result="c"></feColorMatrix><feComposite in="c" in2="SourceAlpha" operator="in" result="ci"></feComposite><feBlend in="SourceGraphic" in2="ci" mode="overlay"></feBlend></filter>
<filter id="vl-dockref" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feImage href="/_blob/VL_DOCKMAP" x="0" y="0" width="370" height="60" preserveAspectRatio="none" result="map"></feImage><feDisplacementMap in="SourceGraphic" in2="map" scale="26" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap></filter>
<filter id="vl-sheetref" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feImage href="/_blob/VL_SHEETMAP" x="0" y="0" width="370" height="430" preserveAspectRatio="none" result="map"></feImage><feDisplacementMap in="SourceGraphic" in2="map" scale="34" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap></filter>
</defs>
</svg>"""

def build(publish=False):
    ids = json.load(open(os.path.join(HERE, 'blob_ids.json'))) if publish else {}
    extra = json.load(open(os.path.join(HERE, 'extra.json'))) if os.path.exists(os.path.join(HERE, 'extra.json')) else {}
    for src in sorted(glob.glob(os.path.join(V4, 'src', '*.dc.html'))):
        s = open(src).read()
        s = s.replace('__VL_BASE_CSS__', BASE_CSS).replace('__VL_DEFS__', DEFS)
        # snippet includes (e.g. folio content duplicated into the loupe)
        for m in re.findall(r'__INC_([A-Z0-9_]+)__', s):
            p = os.path.join(V4, 'src', 'inc', m.lower() + '.html')
            s = s.replace('__INC_' + m + '__', open(p).read())
        for k, v in extra.items():
            s = s.replace('__' + k + '__', v)
        left = re.findall(r'__[A-Z0-9_]+__', s)
        if left: print('UNRESOLVED', os.path.basename(src), sorted(set(left)))
        if publish:
            for k, v in ids.items():
                s = re.sub(r'/_blob/' + k + r'(?![A-Z0-9_])', '/_blob/' + v, s)
            miss = re.findall(r'/_blob/(?:VL|ZN)_[A-Z0-9_]+', s)
            if miss: print('MISSING BLOB', os.path.basename(src), sorted(set(miss)))
        out = os.path.join(V4, 'publish/project' if publish else 'project', os.path.basename(src))
        os.makedirs(os.path.dirname(out), exist_ok=True)
        open(out, 'w').write(s)
        print('built', os.path.basename(src), len(s))

if __name__ == '__main__':
    build('--publish' in sys.argv)
