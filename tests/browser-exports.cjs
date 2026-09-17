const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const fs=require('fs');
(async()=>{
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}); const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:4327');
await page.getByRole('button',{name:'Generate Booth',exact:true}).click();
await page.getByText('AI generation is not configured.',{exact:false}).waitFor();console.log('Missing provider error shown PASS');
await page.route('**/api/generate',route=>route.fulfill({contentType:'application/json',body:fs.readFileSync('/tmp/booth-delivery-fixture.json','utf8')}));
await page.getByRole('button',{name:'Generate Booth',exact:true}).click();
await page.locator('canvas').waitFor();await page.waitForTimeout(1000);
for(const ext of ['rb','glb','usdz']) {
const wait=page.waitForEvent('download');await page.getByRole('button',{name:'.'+ext,exact:true}).click();const download=await wait;const path='/tmp/booth-fixture.'+ext;await download.saveAs(path);const bytes=fs.readFileSync(path);if(bytes.length<50)throw Error('Empty '+ext);if(ext==='glb'&&bytes.toString('ascii',0,4)!=='glTF')throw Error('Invalid glb');if(ext==='usdz'&&bytes.toString('ascii',0,2)!=='PK')throw Error('Invalid usdz');console.log(ext,bytes.length,'bytes PASS');
}
await page.getByRole('button',{name:'Floor Plan',exact:true}).click();await page.locator('svg[viewBox="0 0 440 320"]').waitFor();console.log('Floor plan displayed PASS');
if(errors.length)throw Error(errors.join('\n'));console.log('No browser page errors PASS');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
