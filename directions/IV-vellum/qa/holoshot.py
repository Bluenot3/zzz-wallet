import asyncio,os,sys
from playwright.async_api import async_playwright
async def m():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'])
        pg=await b.new_page(viewport={'width':1000,'height':660},device_scale_factor=2)
        pg.on('console', lambda m: print('console:',m.text[:500]))
        pg.on('pageerror', lambda e: print('pageerror:',str(e)[:500]))
        await pg.goto('file://'+os.path.abspath('holotest.html'))
        await pg.wait_for_function('window.__done===1',timeout=60000)
        await pg.wait_for_timeout(300)
        await pg.screenshot(path='holo.png'); await b.close()
asyncio.run(m())
