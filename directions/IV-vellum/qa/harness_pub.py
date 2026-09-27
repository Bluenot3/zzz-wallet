"""Local QA harness: boots real .dc.html artboards with the Design runtime in headless Chromium.
usage: python3 harness.py '<jobs json>'
job = {"file": "Zenith-Vault.dc.html", "out": "zv", "scale": 2, "steps": [["wait", 1500], ["shot", "zv_a"], ["click", "css"], ["eval", "js"], ["mouse", x, y], ["down"], ["up"], ["hover", "css"]]}
"""
import sys, json, asyncio, os, mimetypes
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.join(HERE, '..', 'publish', 'project')
LEGACY3 = os.path.join(HERE, '..', '..', 'v3', 'publish', 'project')
LEGACY = os.path.join(HERE, '..', '..', 'zen', 'project')
BLOBS = json.load(open(os.path.join(HERE, 'blobs.json'))) if os.path.exists(os.path.join(HERE, 'blobs.json')) else {}
PK = os.path.join(HERE, 'pk')
CDN = {
    'react@18.3.1/umd/react.production.min.js': PK + '/react-18.3.1/package/umd/react.production.min.js',
    'react-dom@18.3.1/umd/react-dom.production.min.js': PK + '/react-dom-18.3.1/package/umd/react-dom.production.min.js',
    '@babel/standalone@7.29.0/babel.min.js': PK + '/babel-standalone-7.29.0/package/babel.min.js',
}

async def route(r):
    url = r.request.url
    if url.startswith('http://dc.local/'):
        p = url[len('http://dc.local/'):].split('?')[0]
        if p == 'support.js':
            return await r.fulfill(path=os.path.join(HERE, 'support.js'), content_type='text/javascript')
        if p.startswith('_blob/'):
            bid = p[6:]
            f = BLOBS.get(bid)
            if f:
                return await r.fulfill(path=f, content_type=mimetypes.guess_type(f)[0] or 'application/octet-stream')
            print('404 blob', p); return await r.fulfill(status=404, body='')
        for base in (PROJ, LEGACY, LEGACY3, HERE):
            f = os.path.join(base, p)
            if os.path.exists(f):
                return await r.fulfill(path=f, content_type=mimetypes.guess_type(f)[0] or 'text/html')
        print('404', p); return await r.fulfill(status=404, body='')
    if 'cdn.jsdelivr.net/npm/' in url:
        k = url.split('cdn.jsdelivr.net/npm/')[1]
        if k in CDN:
            return await r.fulfill(path=CDN[k], content_type='text/javascript')
    await r.continue_()

async def main(jobs):
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--enable-webgl'])
        for job in jobs:
            import re
            sp = os.path.join(PROJ, job['file']); sp = sp if os.path.exists(sp) else (os.path.join(LEGACY3, job['file']) if os.path.exists(os.path.join(LEGACY3, job['file'])) else os.path.join(LEGACY, job['file'])); src = open(sp).read()
            m = re.search(r'"\$preview":\{"width":(\d+),"height":(\d+)\}', src)
            w, h = (int(m.group(1)), int(m.group(2))) if m else (402, 874)
            ctx = await b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=job.get('scale', 2))
            pg = await ctx.new_page()
            await pg.route('**/*', route)
            pg.on('console', lambda m: print('console[%s]:' % m.type, m.text[:400]) if m.type in ('error', 'warning') else None)
            pg.on('pageerror', lambda e: print('pageerror:', str(e)[:400]))
            await pg.goto('http://dc.local/' + job['file'])
            await pg.wait_for_timeout(job.get('boot', 2500))
            for st in (job.get('steps') or [["shot", job.get('out','shot')]]):
                k = st[0]
                if k == 'wait': await pg.wait_for_timeout(st[1])
                elif k == 'shot': await pg.screenshot(path=os.path.join(HERE, st[1] + '.png'))
                elif k == 'click': await pg.click(st[1])
                elif k == 'hover': await pg.hover(st[1])
                elif k == 'eval': print('eval->', await pg.evaluate(st[1]))
                elif k == 'mouse': await pg.mouse.move(st[1], st[2], steps=st[3] if len(st) > 3 else 1)
                elif k == 'down': await pg.mouse.down()
                elif k == 'up': await pg.mouse.up()
            await ctx.close()
        await b.close()

if __name__ == '__main__':
    asyncio.run(main(json.loads(sys.argv[1])))
