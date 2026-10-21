"""Browser check of the NO-BUILD preview, not a validation of Next.js.
Usage: python scripts/browser-smoke.py [--bridge] [--chromium /usr/bin/chromium]
Installs nothing. Requires Python + playwright and a local Chromium browser.
--bridge relays fetch through Python to the REAL HTTP API if browser navigation
is administratively blocked. This does not test native browser cookies/CSRF.
"""
from pathlib import Path
import argparse, json, os, subprocess, tempfile, time, urllib.request, urllib.error, http.cookiejar
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--bridge',action='store_true');parser.add_argument('--chromium',default='/usr/bin/chromium');args=parser.parse_args()
port=3492;origin=f'http://localhost:{port}';results=[];errors=[]
jar=http.cookiejar.CookieJar();opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
def transport(info):
    headers=info.get('headers') or {};headers['Origin']=origin
    req=urllib.request.Request(f'http://127.0.0.1:{port}'+info['path'],data=info.get('body','').encode() if info.get('body') else None,headers=headers,method=info.get('method','GET'))
    try: response=opener.open(req,timeout=20)
    except urllib.error.HTTPError as exc: response=exc
    return {'status':response.status,'body':response.read().decode(),'headers':dict(response.headers)}
def record(name):results.append({'name':name,'passed':True})
# A separate in-memory server, never the developer's persisted preview database.
server=subprocess.Popen(['node','-e',f"require('./demo/server.cjs').createPreview({{port:{port},persistPath:null,reset:true}}).then(a=>a.listen())"],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
try:
    for _ in range(60):
        try:
            if transport({'path':'/api/health'})['status']==200:break
        except Exception:time.sleep(.1)
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path=args.chromium,headless=True,args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':1440,'height':1100},device_scale_factor=1)
        page.on('pageerror',lambda e:errors.append(str(e)))
        if args.bridge:
            page.expose_function('apiBridge',transport)
            page.set_content('<html><head></head><body><div id="app"></div><div id="toast-root"></div></body></html>')
            page.add_style_tag(content=(ROOT/'apps/web/app/globals.css').read_text())
            page.add_script_tag(content="window.fetch=async (path,opts={})=>{const r=await window.apiBridge({path,method:opts.method||'GET',headers:opts.headers||{},body:opts.body});return new Response(r.body,{status:r.status,headers:r.headers});}; if(!crypto.randomUUID) crypto.randomUUID=()=> 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=crypto.getRandomValues(new Uint8Array(1))[0]%16;return(c==='x'?r:(r&3|8)).toString(16)});")
            page.add_script_tag(content=(ROOT/'demo/preview.js').read_text())
        else:page.goto(origin,wait_until='networkidle')
        def sign(role):
            page.get_by_role('button',name=role,exact=True).click();page.get_by_role('button',name='Sign in →',exact=True).click();page.locator('nav').wait_for()
        def nav(label):page.locator('nav').get_by_role('button',name=label,exact=False).click()
        def out():page.get_by_role('button',name='Sign out',exact=True).click();page.get_by_role('heading',name='Welcome back').wait_for()
        sign('Rider');expect(page.get_by_role('heading',name='Good to see you, Maya.')).to_be_visible();expect(page.locator('.ride-card')).to_have_count(3);record('rider sign-in and schedule-aware recommendations')
        (ROOT/'docs').mkdir(exist_ok=True);page.screenshot(path=str(ROOT/'docs/dashboard.png'),full_page=True)
        page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1');page.screenshot(path=str(ROOT/'docs/mobile.png'),full_page=True);record('mobile layout has no document-wide horizontal overflow');page.set_viewport_size({'width':1440,'height':1100})
        nav('Find a ride');page.get_by_label('Quiet ride',exact=True).check();page.get_by_role('button',name='Update results').click();expect(page.locator('.ride-card')).to_have_count(2);record('quiet-only search filter')
        page.get_by_label('Quiet ride',exact=True).uncheck();page.get_by_label('Accessible vehicle',exact=True).check();page.get_by_role('button',name='Update results').click();expect(page.locator('.ride-card')).to_have_count(1);record('vehicle accessibility filter')
        page.get_by_label('Accessible vehicle',exact=True).uncheck();page.get_by_role('button',name='Update results').click();expect(page.locator('.ride-card')).to_have_count(3)
        page.locator('.ride-card').filter(has_text='Leo Chen').get_by_role('button',name='Request seat',exact=False).click();page.get_by_label('Note to the driver (optional)').fill('Meet by the public transit shelter.');page.get_by_role('button',name='Send request',exact=True).click();expect(page.get_by_role('dialog')).to_have_count(0);record('rider submits a seat request')
        nav('My trips');expect(page.locator('.trip-card .badge')).to_have_text('requested');expect(page.get_by_role('button',name='Trip messages',exact=True)).to_have_count(0);record('pending request does not grant chat access')
        out();sign('Driver');nav('Driver hub');row=page.locator('.request-card').filter(has_text='Maya Patel');expect(row).to_be_visible();page.screenshot(path=str(ROOT/'docs/driver-hub.png'),full_page=False);row.get_by_role('button',name='Approve',exact=True).click();expect(page.locator('.request-card').filter(has_text='Maya Patel').locator('.badge')).to_have_text('confirmed');record('driver approves a rider request')
        out();sign('Rider');nav('My trips');expect(page.locator('.trip-card .badge')).to_have_text('confirmed');record('confirmed status persists across sign-in sessions')
        calendar=page.get_by_role('link',name='Calendar ↓').get_attribute('href')
        if args.bridge:payload=transport({'path':calendar})['body']
        else:payload=page.context.request.get(origin+calendar).text()
        assert 'BEGIN:VEVENT' in payload;record('confirmed trip exports a calendar payload')
        page.get_by_role('button',name='Trip messages',exact=True).click();payload='<img src=x onerror="window.injected=true"> public pickup';page.get_by_label('Message',exact=True).fill(payload);page.get_by_role('button',name='Send message',exact=True).click();expect(page.locator('.messages p')).to_have_text(payload);assert page.evaluate('window.injected === undefined');record('trip messages persist and render untrusted text safely');page.get_by_role('button',name='Close',exact=True).click()
        page.get_by_role('button',name='Report',exact=True).click();page.get_by_label('Describe your concern').fill('The public pickup instructions need clarification.');page.get_by_role('button',name='Send report',exact=True).click();expect(page.get_by_role('dialog')).to_have_count(0);record('rider submits a private moderation report')
        nav('Class schedule');page.get_by_label('Course name',exact=True).fill('CS 499 · Browser validation');page.get_by_role('button',name='Add class',exact=True).click();expect(page.locator('.class-card').filter(has_text='CS 499 · Browser validation')).to_have_count(1);record('private weekly schedule persists');page.screenshot(path=str(ROOT/'docs/schedule.png'),full_page=True)
        nav('Profile');page.get_by_label('Make and model').fill('Honda Civic');page.get_by_label('Color',exact=True).fill('Silver');page.get_by_role('button',name='Add vehicle',exact=True).click();expect(page.get_by_text('Silver Honda Civic',exact=True)).to_be_visible();record('profile adds a driver-owned vehicle')
        nav('Driver hub');page.get_by_label('Departure',exact=True).fill('06:30');page.get_by_label('Arrival',exact=True).fill('07:00');page.get_by_role('button',name='Publish offer →',exact=True).click();expect(page.locator('.trip-card')).to_have_count(1);record('student publishes an actual ride offer')
        out();sign('Moderator');nav('Moderation');expect(page.get_by_text('The public pickup instructions need clarification.',exact=True)).to_be_visible();page.get_by_role('button',name='Resolve',exact=True).click();page.get_by_label('Resolution',exact=True).fill('Reviewed the public pickup instructions with the driver.');page.get_by_role('button',name='Save resolution',exact=True).click();expect(page.locator('#workspace .badge')).to_have_text('resolved');record('moderator resolves report through role-gated workflow')
        assert not errors,errors;record('no uncaught JavaScript page errors during the scenario')
        browser.close()
finally:
    server.terminate()
    try:server.wait(timeout=5)
    except subprocess.TimeoutExpired:server.kill()
    (ROOT/'reports').mkdir(exist_ok=True)
    (ROOT/'reports/browser-results.json').write_text(json.dumps({'transport':'Python HTTP bridge to real Node API' if args.bridge else 'native browser HTTP','frontend':'dependency-free preview; NOT Next.js','checks':results,'pageErrors':errors},indent=2)+'\n')
print(f'{len(results)} browser checks passed; transport: '+('bridge' if args.bridge else 'native'))
