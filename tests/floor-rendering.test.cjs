const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { chromium, webkit } = require('playwright');
const root = path.resolve(__dirname, '..');
let server, base;
const hook = `__floorTest: {
  idle() { return running && !busy && !paused; },
  probe(height, floor, inverted, progress = 1) {
    const saved = {cfg, mode, hover};
    cfg = {...cfg, inverted}; mode = 'idle'; hover = null;
    const now = performance.now(), c = {r:2,c:2,h:height,t:'land_flat',walk:true,floor,prev:progress<1?'dull':floor,flipT:progress<1?now-480*progress:0,sd:1};
    const lift = progress < 1 ? -Math.sin(Math.PI*progress)*th*.22 : 0;
    const p = topOf(c); p.y += lift;
    g.save(); g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,cv.width,cv.height);
    const effects = [], imageNames = [];
    const fill = g.fill, image = g.drawImage;
    g.fill = function(...args) { if(this.globalCompositeOperation==='screen')effects.push(this.globalAlpha);return fill.apply(this,args); };
    g.drawImage = function(im,...args) { imageNames.push(im.src||'canvas');return image.call(this,im,...args); };
    try { drawCell(c,2,now,null,null,null); } finally { delete g.fill; delete g.drawImage; }
    // The body beneath the top face includes overlapping stacked sprites.
    const pixels = g.getImageData(Math.round(p.x-tw*.25),Math.round(p.y+th*.6),Math.round(tw*.5),Math.round(th*.55+height*hStep)).data;
    const alphas = [];
    for(let i=3;i<pixels.length;i+=4) if(pixels[i]) alphas.push(pixels[i]);
    const topPixel = Array.from(g.getImageData(Math.round(p.x),Math.round(p.y),1,1).data);
    let bodyHash=2166136261;for(const v of pixels)bodyHash=Math.imul(bodyHash^v,16777619)>>>0;
    g.restore(); cfg=saved.cfg;mode=saved.mode;hover=saved.hover;
    return {bodyMax:Math.max(...alphas),bodyPixels:alphas.length,bodyHash,topPixel,effects,imageNames,contextAlpha:g.globalAlpha};
  }
}, `;
before(async () => {
  const mime = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};
  server = http.createServer(async (req,res) => {
    try {
      const pathname = new URL(req.url,'http://localhost').pathname;
      const file = path.resolve(root,'.'+(pathname==='/'?'/index.html':decodeURIComponent(pathname)));
      if(!file.startsWith(root+path.sep)) throw new Error('outside root');
      let body = await fs.readFile(file);
      if(file===path.join(root,'js/board.js')) body=body.toString().replace('    start, enterPhase1, help, stop,',hook+'    start, enterPhase1, help, stop,');
      res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(body);
    } catch {res.writeHead(404);res.end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}/`;
});
after(async()=>{if(server)await new Promise(r=>server.close(r));});
for(const [name,engine,viewport] of [['desktop',chromium,{width:1440,height:900}],['phone',webkit,{width:390,height:844}]]) {
  test(`Allied floors retain ordinary terrain beneath a translucent rainbow aura on ${name}`,async()=>{
    const browser=await engine.launch();const context=await browser.newContext({viewport,deviceScaleFactor:2,hasTouch:name==='phone'});
    const errors=[];const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
    try {
      await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
      await page.goto(base+'#board=cove',{waitUntil:'networkidle'});await page.locator('#gate').click();await page.locator('#gate').waitFor({state:'detached'});await page.waitForFunction(()=>Board.__floorTest.idle());
      // The actual landscape must be loaded underneath the transparent canvas.
      assert.equal(await page.locator('#boardCanvas').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
      assert(await page.locator('#bgLayer .bg.show').evaluate(async e=>{const im=new Image();im.src=e.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/)[1];await im.decode();return im.naturalWidth>0&&getComputedStyle(e).opacity!=='0';}));
      for(const inverted of [false,true])for(const height of [0,1,2]) {
        const p=await page.evaluate(({height,inverted})=>Board.__floorTest.probe(height,'rainbow',inverted),{height,inverted});
        assert(p.bodyPixels>20,'A rendered side face must be sampled');
        const normal=await page.evaluate(({height,inverted})=>Board.__floorTest.probe(height,'neutral',inverted),{height,inverted});
        assert.equal(p.bodyHash,normal.bodyHash,'Purification must preserve the ordinary terrain texture and its levels');
        assert(p.imageNames.every(name=>name.includes('/assets/tiles/dark_')),'The base must use the same ordinary tile images as neutral floors');
        assert.notDeepEqual(p.topPixel,normal.topPixel,'The aura must visibly identify an allied floor');
        assert(p.effects.some(alpha=>alpha>=.4&&alpha<=.5),'The rainbow / night aura must be rendered at 40–50% opacity');
        assert.equal(p.contextAlpha,1,'Floor opacity must not leak into characters, HP bars or facing arrows');
      }
      const dark=await page.evaluate(()=>Board.__floorTest.probe(2,'dull',false));assert.equal(dark.bodyMax,255,'Enemy floors remain distinct');
      const beforeEnd=await page.evaluate(()=>Board.__floorTest.probe(2,'rainbow',false,.999));const completed=await page.evaluate(()=>Board.__floorTest.probe(2,'rainbow',false));
      assert(Math.abs(beforeEnd.effects[0]-completed.effects[0])<=.002,'The aura must fade in smoothly through purification');
      await page.setViewportSize({width:667,height:375});await page.waitForTimeout(100);
      const resized=await page.evaluate(()=>Board.__floorTest.probe(2,'rainbow',false));assert(resized.effects.some(alpha=>alpha>=.4&&alpha<=.5),'The aura must retain its opacity after resizing');
      assert.deepEqual(errors,[]);
    } finally {await browser.close();}
  });
}
