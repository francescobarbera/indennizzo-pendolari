// Optional browser regression: serve _site locally, set BASE_URL if not port 8781.
// PLAYWRIGHT_MODULE may point to an existing playwright-core installation.
const playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const { chromium } = playwright.default || playwright;
import assert from 'node:assert/strict';
const browser = await chromium.launch({executablePath:'/usr/bin/google-chrome'});
const base=process.env.BASE_URL || 'http://127.0.0.1:8781/';
const before=process.env.BEFORE==='1';
try {
for (const width of [390,1280]) {
 const ctx=await browser.newContext({viewport:{width,height:844}}); const p=await ctx.newPage();
 await p.goto(base); await p.click('#next'); assert.match(await p.locator('#step-error').innerText(),/Scegli/);
 await p.fill('#station','Morbeg'); await p.click('#station-results button');
 console.log(width,'suggestion error:',JSON.stringify(await p.locator('#step-error').innerText()));
 if(!before) assert.equal(await p.locator('#step-error').innerText(),'');
 await p.click('#next'); await p.click('#next'); await p.fill('#price','61'); await p.click('#next'); await p.waitForSelector('.ticket');
 let unblock; const gate=new Promise(resolve=>{unblock=resolve});
 let hit; const hitGate=new Promise(resolve=>{hit=resolve});
 await p.route('**/js/app.mjs',async route=>{hit();await gate;await route.continue()});
 const reload=p.reload({waitUntil:'load'}); await hitGate; await p.waitForSelector('#check',{state:'attached'});
 console.log(width,'form visible before script:',await p.locator('#check').isVisible());
 if(!before) { assert.equal(await p.locator('#check').isVisible(),false);assert.equal(await p.locator('#wizard-loading').isVisible(),true); }
 unblock(); await reload; await p.waitForSelector('.ticket');
 if(!before) {
 assert.equal(await p.locator('#check').isVisible(),false);
 await p.click('#edit'); await p.fill('#station',''); await p.click('#next');
 await p.click('#line-more summary'); await p.selectOption('#line','07'); assert.equal(await p.locator('#step-error').innerText(),'');
 await p.selectOption('#line',''); await p.click('#line-more summary'); await p.fill('#station','Lecco'); await p.click('#next'); await p.click('#next');
 assert.match(await p.locator('#step-error').innerText(),/Scegli/); await p.locator('#line-cards label').first().click(); assert.equal(await p.locator('#step-error').innerText(),'');
 }
 await ctx.close();
}
if(!before) {
 const ctx=await browser.newContext({javaScriptEnabled:false}); const p=await ctx.newPage(); await p.goto(base);
 assert.equal(await p.locator('#wizard-loading').isVisible(),true);assert.ok(await p.locator('noscript').innerText());assert.equal(await p.locator('#wizard-loading a').count(),2);await ctx.close();
 const ctx2=await browser.newContext(); const p2=await ctx2.newPage();await p2.route('**/js/app.mjs',r=>r.abort());await p2.goto(base);assert.equal(await p2.locator('#wizard-loading').isVisible(),true);await ctx2.close();
 const ctx3=await browser.newContext();const p3=await ctx3.newPage();await p3.addInitScript(()=>localStorage.setItem('indennizzo-pendolari:prefs:v1',JSON.stringify({station:'Morbegno',line:'07',pass:'mensile',price:'61'})));await p3.route('**/data/indennizzi.json',r=>r.abort());await p3.goto(base);await p3.waitForSelector('.state.err');assert.equal(await p3.locator('#edit').isVisible(),true);await ctx3.close();
}
} finally {await browser.close()}
