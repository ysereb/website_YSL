import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const base = (process.env.BASE_PATH || '').replace(/\/$/, '');
const route = (path: string) => `${base}/${path}`;
const routes = ['', 'research/', 'team/', 'photos/', 'publications/', 'support/', 'contact/'];

for (const viewport of [{name:'mobile',width:390,height:844},{name:'tablet',width:768,height:1024},{name:'desktop',width:1440,height:1000}]) {
  test(`${viewport.name}: pages, images, navigation and accessibility`, async ({page}) => {
    test.setTimeout(150_000);
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    for (const path of routes) {
      const response = await page.goto(route(path));
      expect(response?.status(), path).toBe(200);
      await expect(page.locator('h1')).toHaveCount(1);
      await page.locator('footer').scrollIntoViewIfNeeded();
      await page.evaluate(async () => { Array.from(document.images).forEach(img=>img.loading='eager'); await Promise.all(Array.from(document.images).map(img => img.decode().catch(() => {}))); });
      expect(await page.locator('img').evaluateAll(images => images.filter(i => !i.complete || i.naturalWidth === 0).map(i=>i.src)),path).toEqual([]);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth+1),path).toBe(true);
      const accessibility = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
      expect(accessibility.violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target).join(', ')}`),path).toEqual([]);
    }
    expect(errors).toEqual([]);
  });
}

test('mobile keyboard menu, dismissal and preserved welcome alias', async ({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(route(''));
  const menu=page.getByRole('button',{name:'Menu'});
  await expect(page.getByRole('navigation',{name:'Main navigation'})).toBeHidden();
  await menu.focus(); await page.keyboard.press('Enter');
  await expect(menu).toHaveAttribute('aria-expanded','true');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Research',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await expect(menu).toHaveAttribute('aria-expanded','false');
  await menu.click();
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Team',exact:true}).click();
  await expect(page).toHaveURL(new RegExp(`${base}/team/`));
  await expect(page.getByRole('heading',{level:1})).toContainText('Our team');
  await page.goto(route('welcome/'));
  await expect(page).toHaveURL(new RegExp(`${base}/$`));
});

test('molecular hero keeps real text clear across screen sizes', async ({page})=>{
  await mkdir('docs/screenshots',{recursive:true});
  for(const width of [320,390,768,1024,1440]){
    await page.setViewportSize({width,height:900});
    await page.goto(route(''));
    await expect(page.locator('.hero h1')).toHaveText('Serebrenik Lab');
    await expect(page.locator('.hero-subtitle')).toHaveText('Protein Control and Organization');
    await expect(page.locator('.brand').first()).toHaveText('Serebrenik Lab');
    const result=await page.evaluate(async()=>{
      const image=document.querySelector<HTMLImageElement>('.hero-art img')!;
      await image.decode();
      const picture=image.getBoundingClientRect();
      const canvas=document.createElement('canvas');
      canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
      const context=canvas.getContext('2d')!;context.drawImage(image,0,0);
      const scale=Math.min(picture.width/image.naturalWidth,picture.height/image.naturalHeight);
      const left=picture.left+(picture.width-image.naturalWidth*scale)/2;
      const top=picture.top+(picture.height-image.naturalHeight*scale)/2;
      let overlap=0,total=0;
      for(const element of document.querySelectorAll('.hero-identity .eyebrow, .hero h1, .hero-subtitle')){
        const range=document.createRange();range.selectNodeContents(element);
        for(const rect of range.getClientRects()){
          const x=Math.max(0,Math.floor((rect.left-left)/scale));
          const y=Math.max(0,Math.floor((rect.top-top)/scale));
          const w=Math.min(canvas.width-x,Math.ceil(rect.width/scale));
          const h=Math.min(canvas.height-y,Math.ceil(rect.height/scale));
          if(w>0&&h>0){const pixels=context.getImageData(x,y,w,h).data;for(let i=3;i<pixels.length;i+=4){total++;if(pixels[i]>20)overlap++;}}
        }
      }
      const heading=document.querySelector('.hero h1')!;
      const range=document.createRange();range.selectNodeContents(heading);
      const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range);
      const selectable=selection.toString();selection.removeAllRanges();
      return {selectable,overlap:total?overlap/total:0,src:image.currentSrc,overflow:document.documentElement.scrollWidth>innerWidth+1};
    });
    expect(result.selectable).toBe('Serebrenik Lab');
    expect(result.src).toContain(width<=760?'hero-proximity-mobile.webp':'hero-proximity-desktop.webp');
    expect(result.overflow,`${width}px overflow`).toBe(false);
    expect(result.overlap,`${width}px molecular artwork intersects text`).toBeLessThan(.005);
    await page.locator('.hero').screenshot({path:`docs/screenshots/hero-${width}.png`});
  }
});

test('works without JavaScript and at narrow widths', async ({browser})=>{
  const context = await browser.newContext({javaScriptEnabled:false, viewport:{width:320,height:740}});
  const page=await context.newPage();
  await page.goto(`http://127.0.0.1:4321${route('')}`);
  await expect(page.getByRole('navigation',{name:'Main navigation'})).toBeVisible();
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Publications'}).click();
  await expect(page.locator('.publication')).toHaveCount(9);
  for(const path of routes){await page.goto(`http://127.0.0.1:4321${route(path)}`);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),path).toBe(true);}
  await context.close();
});

test('homepage stays lightweight on a simulated mobile connection', async ({page})=>{
  await page.setViewportSize({width:390,height:844});
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200_000,uploadThroughput:100_000});
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await page.addInitScript(()=>{
    (window as any).labVitals={lcp:0,cls:0};
    new PerformanceObserver(list=>{for(const e of list.getEntries()) (window as any).labVitals.lcp=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true});
    new PerformanceObserver(list=>{for(const e of list.getEntries() as any)if(!e.hadRecentInput)(window as any).labVitals.cls+=e.value;}).observe({type:'layout-shift',buffered:true});
  });
  await page.goto(route(''));
  await page.waitForFunction(()=>document.images[1]?.complete && (window as any).labVitals.lcp>0);
  const metrics=await page.evaluate(()=>{
    const resources=performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const navigation=performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    return {...(window as any).labVitals,loadMs:navigation.loadEventEnd,totalTransferBytes:navigation.transferSize+resources.reduce((sum,r)=>sum+r.transferSize,0),externalResources:resources.filter(r=>new URL(r.name).origin!==location.origin).map(r=>r.name)};
  });
  await mkdir('docs/audit',{recursive:true});
  await writeFile('docs/audit/performance.json',JSON.stringify({conditions:'Local production preview; 390×844; 150ms latency; 1.6Mbps download; 4× CPU slowdown. Synthetic, not field data.',...metrics},null,2)+'\n');
  expect(metrics.externalResources).toEqual([]);
  expect(metrics.totalTransferBytes).toBeLessThan(500_000);
  expect(metrics.cls).toBeLessThan(0.1);
});

test('save desktop and phone previews',async({page})=>{
  await mkdir('docs/screenshots',{recursive:true});
  for(const viewport of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844}]){
    await page.setViewportSize(viewport);
    for(const path of routes){
      await page.goto(route(path));
      await page.locator('footer').scrollIntoViewIfNeeded();await page.evaluate(async()=>{Array.from(document.images).forEach(img=>img.loading='eager');await Promise.all(Array.from(document.images).map(i=>i.decode().catch(()=>{})));window.scrollTo({top:0,behavior:'instant'})});
      await page.screenshot({path:`docs/screenshots/${path.replace('/','')||'home'}-${viewport.name}.png`,fullPage:true});
    }
  }
});
