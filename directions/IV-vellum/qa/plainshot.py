import asyncio, sys, os, importlib.util
spec=importlib.util.spec_from_file_location('h','harness.py'); h=importlib.util.module_from_spec(spec); spec.loader.exec_module(h)
from playwright.async_api import async_playwright
async def m(page,out,w,hh):
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'])
        ctx=await b.new_context(viewport={'width':w,'height':hh},device_scale_factor=2); pg=await ctx.new_page()
        await pg.route('**/*',h.route); pg.on('console',lambda m: print('console:',m.text[:300]))
        await pg.goto('http://dc.local/'+page); await pg.wait_for_timeout(2000); await pg.screenshot(path=out); await b.close()
asyncio.run(m(sys.argv[1],sys.argv[2],int(sys.argv[3]),int(sys.argv[4])))
