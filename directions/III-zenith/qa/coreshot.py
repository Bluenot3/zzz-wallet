import sys,asyncio
from playwright.async_api import async_playwright
async def m():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'])
        for q,out in [a.split('|') for a in sys.argv[1:]]:
            pg=await b.new_page(viewport={'width':402,'height':402},device_scale_factor=2)
            pg.on('console', lambda m: print('console:',m.text[:500]))
            pg.on('pageerror', lambda e: print('pageerror:',str(e)[:500]))
            await pg.goto('file://'+__import__('os').path.abspath((__import__('sys').argv.pop() if False else 'coretest.html'))+'?'+q)
            await pg.wait_for_function('window.__done===1',timeout=60000)
            await pg.wait_for_timeout(200)
            await pg.screenshot(path=out); await pg.close()
        await b.close()
asyncio.run(m())
