"""Build Zenith artboards from src/ into project/ (shared CSS/defs + generated pattern data).
Blob placeholders (/_blob/ZN_*) are resolved to real asset ids when blob_ids.json exists and --publish is passed."""
import json, os, re, sys, glob
HERE = os.path.dirname(os.path.abspath(__file__))
V3 = os.path.dirname(HERE)
P = json.load(open(os.path.join(HERE, 'patterns.json')))

BASE_CSS = r"""
body{margin:0;background:#050508;color:#ECEEF4;font-family:'Instrument Sans',ui-sans-serif,-apple-system,'Segoe UI',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
a{color:#9FE8F4;text-decoration:none}a:hover{color:#D5F8FC}
button{font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
a:focus-visible,button:focus-visible{outline:2px solid #7FE3F0;outline-offset:3px}
.zn-d{font-family:'Anybody','Instrument Sans',ui-sans-serif,sans-serif}
.zn-m{font-family:'Martian Mono',ui-monospace,'SF Mono',Menlo,monospace;font-stretch:87.5%}
.zn-tnum{font-variant-numeric:tabular-nums lining-nums}
.zn-hit{position:relative}
.zn-hit::after{content:"";position:absolute;left:-2px;right:-2px;top:50%;height:44px;transform:translateY(-50%)}
.zn-glass{background:linear-gradient(180deg,rgba(255,255,255,.085) 0%,rgba(255,255,255,.03) 100%);-webkit-backdrop-filter:blur(26px) saturate(170%);backdrop-filter:blur(26px) saturate(170%);box-shadow:inset 0 1px 0 rgba(255,255,255,.12),inset 0 -1px 0 rgba(0,0,0,.35),0 24px 48px -24px rgba(0,0,0,.9)}
.zn-edge::before{content:"";position:absolute;inset:0;border-radius:inherit;padding:1px;background:conic-gradient(from var(--zn-a),rgba(255,255,255,.05),rgba(127,227,240,.6) 12%,rgba(168,139,255,.4) 20%,rgba(255,190,138,.45) 28%,rgba(255,255,255,.05) 40%,rgba(255,255,255,.05) 62%,rgba(255,255,255,.22) 76%,rgba(255,255,255,.05) 90%);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none;animation:zn-edge 12s linear infinite}
@property --zn-a{syntax:'<angle>';inherits:false;initial-value:200deg}
@keyframes zn-edge{from{--zn-a:200deg}to{--zn-a:560deg}}
.zn-chip{background:linear-gradient(180deg,rgba(255,255,255,.085),rgba(255,255,255,.025));-webkit-backdrop-filter:blur(18px) saturate(160%);backdrop-filter:blur(18px) saturate(160%);box-shadow:inset 0 1px 0 rgba(255,255,255,.13),inset 0 0 0 1px rgba(255,255,255,.07)}
.zn-tile{background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.016));box-shadow:inset 0 1px 0 rgba(255,255,255,.09),inset 0 0 0 1px rgba(255,255,255,.05);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);transition:background .25s ease}
.zn-tile:hover{background:linear-gradient(180deg,rgba(255,255,255,.095),rgba(255,255,255,.03))}
.zn-seg{background:rgba(255,255,255,.04);box-shadow:inset 0 0 0 1px rgba(255,255,255,.08);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}
.zn-spectral{background-image:linear-gradient(100deg,#F4F6FB 0%,#F4F6FB 34%,#9FE8F4 44%,#B9A6FF 50%,#FFC89A 56%,#F4F6FB 66%,#F4F6FB 100%);background-size:300% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;animation:zn-sheen 9s cubic-bezier(.6,0,.4,1) infinite}
@keyframes zn-sheen{0%,14%{background-position:100% 0}62%,100%{background-position:0 0}}
.zn-hero-mask{-webkit-mask-image:radial-gradient(circle at 50% 50%,#000 34%,rgba(0,0,0,.55) 52%,transparent 70%);mask-image:radial-gradient(circle at 50% 50%,#000 34%,rgba(0,0,0,.55) 52%,transparent 70%)}
.zn-spin-slow{animation:zn-spin 240s linear infinite}
.zn-spin-rev{animation:zn-spin 420s linear infinite reverse}
.zn-spin-bezel{animation:zn-spin 600s linear infinite}
@keyframes zn-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@property --zn-s{syntax:'<angle>';inherits:false;initial-value:360deg}
.zn-sweep{-webkit-mask-image:conic-gradient(from 0deg,#000 var(--zn-s),transparent calc(var(--zn-s) + 50deg));mask-image:conic-gradient(from 0deg,#000 var(--zn-s),transparent calc(var(--zn-s) + 50deg));animation:zn-spin 420s linear infinite reverse,zn-sweep 3.4s cubic-bezier(.5,0,.2,1) .4s both}
@keyframes zn-sweep{from{--zn-s:-50deg}to{--zn-s:360deg}}
.zn-twinkle{animation:zn-tw 7s ease-in-out infinite alternate}
@keyframes zn-tw{from{opacity:.42}to{opacity:.72}}
.zn-live{animation:zn-live 2.4s ease-out infinite}
@keyframes zn-live{0%{box-shadow:0 0 0 0 rgba(127,227,240,.65)}70%{box-shadow:0 0 0 7px rgba(127,227,240,0)}100%{box-shadow:0 0 0 0 rgba(127,227,240,0)}}
.zn-orbit{animation:zn-spin 9s linear infinite}
.zn-rise{animation:zn-rise 1.1s cubic-bezier(.2,.8,.2,1) both}
@keyframes zn-rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
.zn-roll{animation:zn-roll 2s cubic-bezier(.16,.84,.2,1) both}
@keyframes zn-roll{from{transform:translateY(0)}to{transform:translateY(var(--ty))}}
.zn-mini{perspective:140px}
.zn-mini i{position:absolute;inset:3px;border-radius:50%;border:1.2px solid;transform:rotateZ(var(--r)) rotateX(72deg);animation:zn-mini 5s linear infinite}
@keyframes zn-mini{from{transform:rotateZ(var(--r)) rotateX(72deg)}to{transform:rotateZ(calc(var(--r) + 360deg)) rotateX(72deg)}}
.zn-corebtn{position:relative;background:radial-gradient(circle at 50% 40%,rgba(127,227,240,.42),rgba(34,56,110,.45) 52%,rgba(8,10,16,.92) 100%);box-shadow:inset 0 0 0 1px rgba(207,246,251,.38),0 0 22px rgba(127,227,240,.35),0 8px 18px rgba(0,0,0,.6)}
.zn-corebtn::after{content:"";position:absolute;inset:-4px;border-radius:50%;background:conic-gradient(from 0deg,rgba(127,227,240,0),rgba(127,227,240,.9) 18%,rgba(127,227,240,0) 36%,rgba(168,139,255,0) 50%,rgba(255,190,138,.7) 68%,rgba(255,190,138,0) 86%);-webkit-mask:radial-gradient(circle,transparent 25px,#000 25.5px,#000 26.5px,transparent 27px);mask:radial-gradient(circle,transparent 25px,#000 25.5px,#000 26.5px,transparent 27px);animation:zn-spin 6s linear infinite}
@media (prefers-reduced-motion:reduce){.zn-spin-slow,.zn-spin-rev,.zn-spin-bezel,.zn-orbit,.zn-mini i,.zn-spectral,.zn-edge::before,.zn-live,.zn-twinkle,.zn-corebtn::after,.zn-flow,.zn-pulse{animation:none!important}.zn-sweep{animation:none!important;-webkit-mask-image:none;mask-image:none}.zn-rise,.zn-roll,.zn-draw{animation-duration:.01s!important;animation-delay:0s!important}}
""".strip()

DEFS = """<svg width="0" height="0" style="position: absolute" aria-hidden="true" focusable="false">
<defs>
<symbol id="zn-mark" viewBox="0 0 100 86"><path fill-rule="evenodd" d="M0 31L12 31L22 21L10 21L10 9L44 9L0 53L0 75L5 75L10 70L10 57L58 9L77 9L0 86L100 86L100 55L88 55L78 65L90 65L90 77L56 77L100 33L100 11L95 11L90 16L90 29L42 77L23 77L100 0L0 0Z"></path></symbol>
<linearGradient id="zn-ti" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F6F8FB"></stop><stop offset=".38" stop-color="#9DA5B3"></stop><stop offset=".62" stop-color="#E7EBF1"></stop><stop offset="1" stop-color="#6D7482"></stop></linearGradient>
<linearGradient id="zn-arcfade" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7FE3F0" stop-opacity=".55"></stop><stop offset=".5" stop-color="#DCE3EE" stop-opacity=".08"></stop><stop offset="1" stop-color="#A88BFF" stop-opacity=".45"></stop></linearGradient>
<linearGradient id="zn-g-usd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"></stop><stop offset="1" stop-color="#9AA3B2"></stop></linearGradient>
<linearGradient id="zn-g-usdc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8FE9FF"></stop><stop offset="1" stop-color="#2F5BFF"></stop></linearGradient>
<linearGradient id="zn-g-btc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE0AE"></stop><stop offset="1" stop-color="#E0843A"></stop></linearGradient>
<linearGradient id="zn-g-eth" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#D9CCFF"></stop><stop offset="1" stop-color="#7650F0"></stop></linearGradient>
<linearGradient id="zn-g-photon" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7FE3F0" stop-opacity="0"></stop><stop offset=".5" stop-color="#CFF6FB"></stop><stop offset="1" stop-color="#7FE3F0" stop-opacity="0"></stop></linearGradient>
</defs>
</svg>"""

def build(publish=False):
    ids = {}
    if publish:
        ids = json.load(open(os.path.join(HERE, 'blob_ids.json')))
    for src in sorted(glob.glob(os.path.join(V3, 'src', '*.dc.html'))):
        s = open(src).read()
        s = s.replace('__ZN_BASE_CSS__', BASE_CSS).replace('__ZN_DEFS__', DEFS)
        for k in ('bezel176', 'bezel300', 'roseSmall'):
            s = s.replace('__' + k.upper() + '__', P[k])
        extra = os.path.join(HERE, 'extra.json')
        if os.path.exists(extra):
            for k, v in json.load(open(extra)).items():
                s = s.replace('__' + k + '__', v)
        left = re.findall(r'__[A-Z0-9_]+__', s)
        if left: print('UNRESOLVED', os.path.basename(src), sorted(set(left)))
        if publish:
            for k, v in ids.items():
                s = s.replace('/_blob/' + k + '"', '/_blob/' + v + '"').replace("/_blob/" + k + "'", "/_blob/" + v + "'")
            miss = re.findall(r'/_blob/ZN_[A-Z0-9_]+', s)
            if miss: print('MISSING BLOB', os.path.basename(src), sorted(set(miss)))
        out = os.path.join(V3, 'project' if not publish else 'publish/project', os.path.basename(src))
        os.makedirs(os.path.dirname(out), exist_ok=True)
        open(out, 'w').write(s)
        print('built', os.path.basename(src), len(s))

if __name__ == '__main__':
    build('--publish' in sys.argv)
