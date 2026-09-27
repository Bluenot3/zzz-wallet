import sys,asyncio
from playwright.async_api import async_playwright
async def m(src,out,w,h,s):
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        pg=await b.new_page(viewport={'width':w,'height':h},device_scale_factor=s)
        pg.on('console', lambda m: print('console:',m.text[:300]))
        pg.on('pageerror', lambda e: print('pageerror:',str(e)[:300]))
        await pg.goto('file://'+src); await pg.wait_for_timeout(int(sys.argv[6]) if len(sys.argv)>6 else 2500)
        await pg.screenshot(path=out); await b.close()
asyncio.run(m(sys.argv[1],sys.argv[2],int(sys.argv[3]),int(sys.argv[4]),float(sys.argv[5])))
