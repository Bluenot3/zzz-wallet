import sys, json, asyncio, base64, os
from playwright.async_api import async_playwright
HERE=os.path.dirname(os.path.abspath(__file__))
async def m(jobs):
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'])
        for j in jobs:
            pg=await b.new_page(viewport={'width':max(j['w'],10),'height':max(j['h'],10)},device_scale_factor=j.get('scale',3))
            pg.on('pageerror',lambda e: print('pageerror',str(e)[:300]))
            await pg.goto('file://'+os.path.join(HERE,'hposter.html'))
            url=await pg.evaluate('([w,h,o,t,tl])=>window.renderPoster(w,h,o,t,tl)',[j['w'],j['h'],j.get('opts',{}),j.get('t',2),j.get('tilt',[0,0])])
            open(os.path.join(HERE,'..','assets',j['out']),'wb').write(base64.b64decode(url.split(',')[1])); print('poster',j['out']); await pg.close()
        await b.close()
asyncio.run(m(json.loads(sys.argv[1])))
