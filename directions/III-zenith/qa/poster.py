"""usage: python3 poster.py '[{"out":"pv_orbit.png","w":402,"h":420,"opts":{...},"t":7,"params":{...}}]'"""
import sys, json, asyncio, base64, os
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
async def m(jobs):
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'])
        for j in jobs:
            pg = await b.new_page(viewport={'width': j['w'], 'height': j['h']}, device_scale_factor=j.get('scale', 2))
            pg.on('console', lambda m: print('console:', m.text[:300]))
            pg.on('pageerror', lambda e: print('pageerror:', str(e)[:300]))
            await pg.goto('file://' + os.path.join(HERE, 'poster.html'))
            url = await pg.evaluate('([w,h,o,t,p]) => window.renderPoster(w,h,o,t,p)', [j['w'], j['h'], j.get('opts', {}), j.get('t', 7), j.get('params', {})])
            data = base64.b64decode(url.split(',')[1])
            open(os.path.join(HERE, '..', 'assets', j['out']), 'wb').write(data)
            print('poster', j['out'], len(data))
            await pg.close()
        await b.close()
asyncio.run(m(json.loads(sys.argv[1])))
