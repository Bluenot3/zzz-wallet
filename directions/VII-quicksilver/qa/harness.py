"""Shared QA bench: boots real .dc.html boards (this direction's project/) with the Design runtime in headless Chromium.
usage: python3 harness.py '<jobs json>'   job = {"file": "X.dc.html", "scale": 1, "boot": 2500, "steps": [...]}
steps: ["wait",ms] ["shot",name] ["click",sel] ["hover",sel] ["eval",js] ["mouse",x,y,steps] ["down"] ["up"]
       ["key",key] ["focus",sel] ["type",sel,text] ["clickxy",x,y] ["scroll",sel,dy]
Console errors are printed as ERR lines (benign pre-hydration SVG template noise filtered)."""
import sys, json, asyncio, os, mimetypes, re
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.join(HERE, '..', 'project')
BLOBS = {k: (v if os.path.isabs(v) else os.path.normpath(os.path.join(HERE, v))) for k, v in (json.load(open(os.path.join(HERE, 'blobs.json'))) if os.path.exists(os.path.join(HERE, 'blobs.json')) else {}).items()}
PK = os.path.join(HERE, 'pk')
SHOTS = os.path.join(HERE, 'shots'); os.makedirs(SHOTS, exist_ok=True)
CDN = {'react@18.3.1/umd/react.production.min.js': PK + '/react-18.3.1/package/umd/react.production.min.js',
       'react-dom@18.3.1/umd/react-dom.production.min.js': PK + '/react-dom-18.3.1/package/umd/react-dom.production.min.js',
       '@babel/standalone@7.29.0/babel.min.js': PK + '/babel-standalone-7.29.0/package/babel.min.js'}
BENIGN = re.compile(r'Expected moveto|Expected length|Expected number|attribute (d|cx|cy|r|x|y|width|height|points|x1|x2|y1|y2|transform|viewBox|stroke-dasharray|stroke-dashoffset|offset|opacity):|Failed to load resource: net::ERR_FAILED|fonts\.g')
async def route(r):
    url = r.request.url
    if url.startswith('http://dc.local/'):
        p = url[len('http://dc.local/'):].split('?')[0].split('#')[0]
        if p == 'support.js': return await r.fulfill(path=os.path.join(HERE, 'support.js'), content_type='text/javascript')
        if p.startswith('_blob/'):
            f = BLOBS.get(p[6:])
            if f: return await r.fulfill(path=f, content_type=mimetypes.guess_type(f)[0] or 'application/octet-stream')
            print('ERR 404 blob', p); return await r.fulfill(status=404, body='')
        f = os.path.join(PROJ, p)
        if os.path.exists(f): return await r.fulfill(path=f, content_type=mimetypes.guess_type(f)[0] or 'text/html')
        print('ERR 404', p); return await r.fulfill(status=404, body='')
    if 'cdn.jsdelivr.net/npm/' in url:
        k = url.split('cdn.jsdelivr.net/npm/')[1]
        if k in CDN: return await r.fulfill(path=CDN[k], content_type='text/javascript')
    pass
    await r.continue_()
async def main(jobs):
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'])
        for job in jobs:
            src = open(os.path.join(PROJ, job['file'])).read()
            m = re.search(r'"\$preview":\{"width":(\d+),"height":(\d+)\}', src)
            w, h = (int(m.group(1)), int(m.group(2))) if m else (402, 874)
            ctx = await b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=job.get('scale', 1))
            pg = await ctx.new_page(); await pg.route('**/*', route)
            tag = job['file']
            pg.on('console', lambda m, t=tag: print('ERR console[%s] %s: %s' % (m.type, t, m.text[:300])) if m.type == 'error' and not BENIGN.search(m.text) else None)
            pg.on('pageerror', lambda e, t=tag: print('ERR pageerror %s: %s' % (t, str(e)[:300])))
            await pg.goto('http://dc.local/' + job['file'])
            await pg.wait_for_timeout(job.get('boot', 2500))
            for st in (job.get('steps') or [["shot", job['file'].replace('.dc.html', '')]]):
                k = st[0]
                if k == 'wait': await pg.wait_for_timeout(st[1])
                elif k == 'shot': await pg.screenshot(path=os.path.join(SHOTS, st[1] + '.png'))
                elif k == 'click': await pg.click(st[1], timeout=4000)
                elif k == 'hover': await pg.hover(st[1])
                elif k == 'eval': print('eval->', await pg.evaluate(st[1]))
                elif k == 'mouse': await pg.mouse.move(st[1], st[2], steps=st[3] if len(st) > 3 else 1)
                elif k == 'down': await pg.mouse.down()
                elif k == 'up': await pg.mouse.up()
                elif k == 'key': await pg.keyboard.press(st[1])
                elif k == 'focus': await pg.focus(st[1])
                elif k == 'kdown': await pg.keyboard.down(st[1])
                elif k == 'kup': await pg.keyboard.up(st[1])
                elif k == 'type': await pg.fill(st[1], st[2])
                elif k == 'clickxy': await pg.mouse.click(st[1], st[2])
                elif k == 'scroll': await pg.eval_on_selector(st[1], '(el, dy) => el.scrollBy(0, dy)', st[2])
                else: print('ERR unknown step', k)
            await ctx.close()
        await b.close()
if __name__ == '__main__': asyncio.run(main(json.loads(sys.argv[1])))
