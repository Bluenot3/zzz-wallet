"""Render engine posters: python3 poster.py '<json list of {q, w, h, out}>' -> PNG at 2x + WebP."""
import sys, json, asyncio, os
from playwright.async_api import async_playwright
import harness
from PIL import Image
async def main(jobs):
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'])
        for j in jobs:
            ctx = await b.new_context(viewport={'width': j['w'], 'height': j['h']}, device_scale_factor=2)
            pg = await ctx.new_page(); await pg.route('**/*', harness.route)
            pg.on('pageerror', lambda e: print('ERR pageerror', str(e)[:300]))
            pg.on('console', lambda m: print('ERR console', m.text[:300]) if m.type == 'error' else None)
            await pg.goto('http://dc.local/qs-poster.html?' + j['q'] + '&w=%d&h=%d' % (j['w'], j['h']))
            await pg.wait_for_function('window.__done === true', timeout=240000)
            png = os.path.join(harness.SHOTS, j['out'] + '.png')
            await pg.screenshot(path=png, clip={'x': 0, 'y': 0, 'width': j['w'], 'height': j['h']}, timeout=400000)
            im = Image.open(png).convert('RGB'); webp = os.path.join(os.path.dirname(harness.HERE), 'assets', j['out'] + '.webp')
            im.save(webp, 'WEBP', quality=88, method=6); print('poster', j['out'], im.size, os.path.getsize(webp))
            await ctx.close()
        await b.close()
if __name__ == '__main__': asyncio.run(main(json.loads(sys.argv[1])))
