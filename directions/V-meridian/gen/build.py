"""Build Meridian (Direction V) artboards from src/ into project/ (shared CSS/defs).
Blob placeholders (/_blob/MD_*) are resolved to real asset ids when blob_ids.json exists and --publish is passed."""
import json, os, re, sys, glob
HERE = os.path.dirname(os.path.abspath(__file__))
V5 = os.path.dirname(HERE)

BASE_CSS = r"""
body{margin:0;background:#06070A;color:#ECEEF4;font-family:'Instrument Sans',ui-sans-serif,-apple-system,'Segoe UI',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
a{color:#9FE8F4;text-decoration:none}a:hover{color:#D5F8FC}
button{font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
a:focus-visible,button:focus-visible{outline:2px solid #7FE3F0;outline-offset:3px}
.md-d{font-family:'Anybody','Instrument Sans',ui-sans-serif,sans-serif}
.md-m{font-family:'Martian Mono',ui-monospace,'SF Mono',Menlo,monospace;font-stretch:87.5%}
.md-tnum{font-variant-numeric:tabular-nums lining-nums}
.md-hit{position:relative}
.md-hit::after{content:"";position:absolute;left:-2px;right:-2px;top:50%;height:44px;transform:translateY(-50%)}
.md-glass{background:linear-gradient(180deg,rgba(255,255,255,.085) 0%,rgba(255,255,255,.03) 100%);-webkit-backdrop-filter:blur(26px) saturate(170%);backdrop-filter:blur(26px) saturate(170%);box-shadow:inset 0 1px 0 rgba(255,255,255,.12),inset 0 -1px 0 rgba(0,0,0,.35),0 24px 48px -24px rgba(0,0,0,.9)}
.md-edge::before{content:"";position:absolute;inset:0;border-radius:inherit;padding:1px;background:conic-gradient(from var(--md-a),rgba(255,255,255,.05),rgba(127,227,240,.55) 12%,rgba(217,172,75,.55) 24%,rgba(168,139,255,.35) 34%,rgba(255,255,255,.05) 44%,rgba(255,255,255,.05) 62%,rgba(217,172,75,.4) 78%,rgba(255,255,255,.05) 90%);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none;animation:md-edge 13s linear infinite}
@property --md-a{syntax:'<angle>';inherits:false;initial-value:200deg}
@keyframes md-edge{from{--md-a:200deg}to{--md-a:560deg}}
.md-chip{background:linear-gradient(180deg,rgba(255,255,255,.085),rgba(255,255,255,.025));-webkit-backdrop-filter:blur(18px) saturate(160%);backdrop-filter:blur(18px) saturate(160%);box-shadow:inset 0 1px 0 rgba(255,255,255,.13),inset 0 0 0 1px rgba(255,255,255,.07)}
.md-tile{background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.016));box-shadow:inset 0 1px 0 rgba(255,255,255,.09),inset 0 0 0 1px rgba(255,255,255,.05);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);transition:background .25s ease}
.md-tile:hover{background:linear-gradient(180deg,rgba(255,255,255,.095),rgba(255,255,255,.03))}
.md-seg{background:rgba(255,255,255,.04);box-shadow:inset 0 0 0 1px rgba(255,255,255,.08);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}
.md-spectral{background-image:linear-gradient(100deg,#F4F6FB 0%,#F4F6FB 34%,#9FE8F4 44%,#D9AC4B 50%,#FFC89A 56%,#F4F6FB 66%,#F4F6FB 100%);background-size:300% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;animation:md-sheen 9s cubic-bezier(.6,0,.4,1) infinite}
@keyframes md-sheen{0%,14%{background-position:100% 0}62%,100%{background-position:0 0}}
.md-hero-mask{-webkit-mask-image:radial-gradient(circle at 50% 50%,#000 34%,rgba(0,0,0,.55) 52%,transparent 70%);mask-image:radial-gradient(circle at 50% 50%,#000 34%,rgba(0,0,0,.55) 52%,transparent 70%)}
.md-spin-slow{animation:md-spin 240s linear infinite}
.md-spin-rev{animation:md-spin 420s linear infinite reverse}
@keyframes md-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.md-twinkle{animation:md-tw 7s ease-in-out infinite alternate}
@keyframes md-tw{from{opacity:.4}to{opacity:.7}}
.md-live{animation:md-live 2.4s ease-out infinite}
@keyframes md-live{0%{box-shadow:0 0 0 0 rgba(127,227,240,.65)}70%{box-shadow:0 0 0 7px rgba(127,227,240,0)}100%{box-shadow:0 0 0 0 rgba(127,227,240,0)}}
.md-rise{animation:md-rise 1.1s cubic-bezier(.2,.8,.2,1) both}
@keyframes md-rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
.md-roll{animation:md-roll 2s cubic-bezier(.16,.84,.2,1) both}
@keyframes md-roll{from{transform:translateY(0)}to{transform:translateY(var(--ty))}}
.md-draw{stroke-dasharray:var(--len);stroke-dashoffset:var(--len);animation:md-draw 1.6s cubic-bezier(.2,.7,.15,1) forwards}
@keyframes md-draw{to{stroke-dashoffset:0}}
.md-corebtn{position:relative;background:radial-gradient(circle at 50% 40%,rgba(127,227,240,.4),rgba(34,56,110,.42) 52%,rgba(8,10,16,.92) 100%);box-shadow:inset 0 0 0 1px rgba(207,246,251,.36),0 0 22px rgba(127,227,240,.32),0 8px 18px rgba(0,0,0,.6)}
.md-engrave{background-image:repeating-conic-gradient(from 0deg,rgba(217,172,75,.42) 0deg .16deg,rgba(217,172,75,0) .16deg .95deg),repeating-conic-gradient(from .43deg,rgba(220,227,238,.18) 0deg .1deg,rgba(220,227,238,0) .1deg 1.55deg)}
.md-engrave-ring{border-radius:50%;-webkit-mask-image:radial-gradient(circle,transparent 0,transparent calc(50% - 9px),#000 calc(50% - 8px),#000 calc(50% - 1px),transparent calc(50% - .5px));mask-image:radial-gradient(circle,transparent 0,transparent calc(50% - 9px),#000 calc(50% - 8px),#000 calc(50% - 1px),transparent calc(50% - .5px))}
@media (prefers-reduced-motion:reduce){.md-spin-slow,.md-spin-rev,.md-live,.md-spectral,.md-edge::before,.md-twinkle{animation:none!important}.md-rise,.md-roll,.md-draw{animation-duration:.01s!important;animation-delay:0s!important}}
""".strip()

DEFS = """<svg width="0" height="0" style="position: absolute" aria-hidden="true" focusable="false">
<defs>
<symbol id="md-mark" viewBox="0 0 100 86"><path fill-rule="evenodd" d="M0 31L12 31L22 21L10 21L10 9L44 9L0 53L0 75L5 75L10 70L10 57L58 9L77 9L0 86L100 86L100 55L88 55L78 65L90 65L90 77L56 77L100 33L100 11L95 11L90 16L90 29L42 77L23 77L100 0L0 0Z"></path></symbol>
<linearGradient id="md-ti" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F6F8FB"></stop><stop offset=".38" stop-color="#9DA5B3"></stop><stop offset=".62" stop-color="#E7EBF1"></stop><stop offset="1" stop-color="#6D7482"></stop></linearGradient>
<linearGradient id="md-brass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F3D48A"></stop><stop offset=".5" stop-color="#B8872E"></stop><stop offset="1" stop-color="#8C6418"></stop></linearGradient>
<linearGradient id="md-arcfade" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7FE3F0" stop-opacity=".55"></stop><stop offset=".5" stop-color="#DCE3EE" stop-opacity=".08"></stop><stop offset="1" stop-color="#D9AC4B" stop-opacity=".5"></stop></linearGradient>
<linearGradient id="md-g-usd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"></stop><stop offset="1" stop-color="#9AA3B2"></stop></linearGradient>
<linearGradient id="md-g-usdc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8FE9FF"></stop><stop offset="1" stop-color="#2F5BFF"></stop></linearGradient>
<linearGradient id="md-g-btc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE0AE"></stop><stop offset="1" stop-color="#E0843A"></stop></linearGradient>
<linearGradient id="md-g-eth" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#D9CCFF"></stop><stop offset="1" stop-color="#7650F0"></stop></linearGradient>
<linearGradient id="md-g-chart" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7FE3F0" stop-opacity=".55"></stop><stop offset="1" stop-color="#7FE3F0" stop-opacity="0"></stop></linearGradient>
</defs>
</svg>"""

def build(publish=False):
    ids = {}
    if publish:
        ids = json.load(open(os.path.join(HERE, 'blob_ids.json')))
    for src in sorted(glob.glob(os.path.join(V5, 'src', '*.dc.html'))):
        s = open(src).read()
        s = s.replace('__MD_BASE_CSS__', BASE_CSS).replace('__MD_DEFS__', DEFS)
        left = re.findall(r'__[A-Z0-9_]+__', s)
        if left: print('UNRESOLVED', os.path.basename(src), sorted(set(left)))
        if publish:
            for k, v in ids.items():
                s = s.replace('/_blob/' + k + '"', '/_blob/' + v + '"').replace("/_blob/" + k + "'", "/_blob/" + v + "'")
            miss = re.findall(r'/_blob/MD_[A-Z0-9_]+', s)
            if miss: print('MISSING BLOB', os.path.basename(src), sorted(set(miss)))
        out = os.path.join(V5, 'project' if not publish else 'publish/project', os.path.basename(src))
        os.makedirs(os.path.dirname(out), exist_ok=True)
        open(out, 'w').write(s)
        print('built', os.path.basename(src), len(s))

if __name__ == '__main__':
    build('--publish' in sys.argv)
