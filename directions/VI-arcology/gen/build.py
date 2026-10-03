"""Build Arcology (Direction VI) boards: inline shared CSS and the city engine; --publish swaps blob tokens."""
import os, re, sys, glob, json
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
def build(publish=False):
    css = open(os.path.join(HERE, 'css.css')).read().strip(); eng = open(os.path.join(HERE, 'engine.js')).read().strip()
    ids = json.load(open(os.path.join(HERE, 'blob_ids.json'))) if publish and os.path.exists(os.path.join(HERE, 'blob_ids.json')) else {}
    for src in sorted(glob.glob(os.path.join(ROOT, 'src', '*.dc.html'))):
        s = open(src).read().replace('__AR_CSS__', css).replace('__AR_ENGINE__', eng)
        left = re.findall(r'__AR_[A-Z_]+__', s)
        if left: print('UNRESOLVED', os.path.basename(src), left)
        for k, v in ids.items(): s = s.replace('/_blob/' + k + '"', '/_blob/' + v + '"')
        out = os.path.join(ROOT, 'publish' if publish else 'project', os.path.basename(src)); os.makedirs(os.path.dirname(out), exist_ok=True)
        open(out, 'w').write(s); print('built', os.path.basename(src), len(s))
if __name__ == '__main__': build('--publish' in sys.argv)
