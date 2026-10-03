"""Build Quicksilver (Direction VII) boards: inline shared CSS + UI helpers; --publish swaps blob tokens for uploaded ids."""
import os, re, sys, glob, json
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
def build(publish=False):
    css = open(os.path.join(HERE, 'css.css')).read().strip(); ui = open(os.path.join(HERE, 'ui.js')).read().strip()
    ids = json.load(open(os.path.join(HERE, 'blob_ids.json'))) if publish and os.path.exists(os.path.join(HERE, 'blob_ids.json')) else {}
    for src in sorted(glob.glob(os.path.join(ROOT, 'src', '*.dc.html'))):
        s = open(src).read().replace('__QS_CSS__', css).replace('__QS_UI__', ui)
        left = re.findall(r'__QS_[A-Z_]+__', s)
        if left: print('UNRESOLVED', os.path.basename(src), left)
        for k, v in ids.items(): s = s.replace('/_blob/' + k + '"', '/_blob/' + v + '"')
        if publish:
            miss = set(re.findall(r'/_blob/([a-z][a-z0-9-]+)"', s))
            if miss: print('UNMAPPED BLOBS', os.path.basename(src), miss)
        out = os.path.join(ROOT, 'publish' if publish else 'project', os.path.basename(src)); os.makedirs(os.path.dirname(out), exist_ok=True)
        open(out, 'w').write(s); print('built', os.path.basename(src), len(s))
if __name__ == '__main__': build('--publish' in sys.argv)
