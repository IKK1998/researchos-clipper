// Real MV3 Chromium runtime; synthetic network only. Never contacts owner sites.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

const SITE='https://researchos.cacdb.org';
const URL='https://mp.weixin.qq.com/s/RESEARCHOS_CI_SYNTHETIC';
const URL2='https://mp.weixin.qq.com/s/RESEARCHOS_CI_RESTART';
const ID='12345678-1234-1234-1234-123456789abc';
const ID2='22345678-1234-1234-1234-123456789abc';
const TITLE='合成标题测试（非真实文章）';
const profile=await mkdtemp(path.join(tmpdir(),'researchos-clipper-ci-'));
const out=path.resolve('artifacts/browser-runtime'); await mkdir(out,{recursive:true});
const sources=new Map(); let captures=0; let offline=false;
const requests=[];
const extension=path.resolve('extension');
const evidence={synthetic_network:true,real_chromium_extension:true};

async function attachRoutes(context) {
  await context.route('**/*',async route=>{
    const req=route.request(), u=new globalThis.URL(req.url());
    requests.push({url:req.url(),method:req.method()});
    if(u.protocol==='chrome-extension:') return route.continue();
    if(u.origin===SITE) {
      if(offline) return route.fulfill({status:503,body:'offline fixture'});
      if(u.pathname==='/api/v1/intake') {
        const data=req.postDataJSON(); assert.equal(data.ai_consent,false);
        const id=data.value===URL?ID:ID2;
        const duplicate=sources.has(id);
        if(!duplicate) sources.set(id,{id,original_value:data.value,provenance:{}});
        assert.equal(req.headers().origin,SITE);
        return route.fulfill({json:{saved:true,source_id:id,duplicate}});
      }
      const match=u.pathname.match(/^\/api\/v1\/sources\/([\w-]+)(\/capture)?$/);
      if(match) {
        const source=sources.get(match[1]); assert(source);
        if(match[2]) {
          const data=req.postDataJSON();assert.equal(data.capture_scope,'metadata_only');assert.equal(data.body_text,undefined);
          assert.equal(req.headers().origin,SITE);
          source.provenance.title=data.title;captures++;
          return route.fulfill({json:{source_id:source.id,captured:{title:data.title}}});
        }
        return route.fulfill({json:{source}});
      }
      return route.fulfill({contentType:'text/html',body:'<h1>CI synthetic ResearchOS — not production</h1>'});
    }
    if(req.url()===URL||req.url()===URL2)
      return route.fulfill({contentType:'text/html',body:`<title>${TITLE}</title><h1 id="activity-name">${TITLE}</h1>`});
    // Refuse every unplanned outbound request, including real WeChat articles.
    return route.abort();
  });
}
async function launch() {
  const context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,
    args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,
      '--host-resolver-rules=MAP researchos.cacdb.org ~NOTFOUND, MAP mp.weixin.qq.com ~NOTFOUND']});
  await attachRoutes(context);
  let worker=context.serviceWorkers()[0];
  if(!worker) worker=await context.waitForEvent('serviceworker');
  const extensionId=worker.url().split('/')[2];
  const sitePage=await context.newPage();await sitePage.goto(SITE);
  const popup=await context.newPage();await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  return {context,worker,popup};
}
async function message(popup,data) {
  return popup.evaluate(data=>chrome.runtime.sendMessage(data),data);
}
async function settle(popup,url,context) {
  let fixtureNavigation=false;
  for(let i=0;i<40;i++) {
    await message(popup,{type:'retry'});
    const jobs=await popup.evaluate(async()=> (await chrome.storage.local.get('jobs')).jobs||[]);
    const job=jobs.find(j=>j.url===url);
    if(job?.state==='done') return job;
    // Chrome can start extension-created navigation before Playwright attaches
    // interception. DNS is intentionally blocked, so load only this synthetic
    // page again once the browser target is attached to the test context.
    const article=context.pages().find(p=>p.url()===url);
    if(article&&!fixtureNavigation) {fixtureNavigation=true;await article.goto(url);}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw new Error('Real browser queue did not complete');
}
let run=await launch();
try {
  await run.popup.locator('#url').fill(URL);
  await run.popup.locator('#save').click();
  const job=await settle(run.popup,URL,run.context);
  assert.equal(job.title,TITLE);assert.equal(sources.get(ID).provenance.title,TITLE);assert.equal(captures,1);
  evidence.title_capture_and_readback='passed';
  await run.popup.screenshot({path:path.join(out,'synthetic-title-result.png')});
  await message(run.popup,{type:'collect',url:URL});await message(run.popup,{type:'retry'});
  assert.equal(captures,1);evidence.duplicate_preservation='passed';
  offline=true;
  await message(run.popup,{type:'collect',url:URL2});
  await message(run.popup,{type:'retry'});
  const pending=await run.popup.evaluate(async()=> (await chrome.storage.local.get('jobs')).jobs);
  assert(pending.some(j=>j.url===URL2&&j.state!=='done'));
  await run.context.close();
  offline=false;run=await launch();
  const resumed=await settle(run.popup,URL2,run.context);
  assert.equal(resumed.title,TITLE);assert.equal(sources.get(ID2).provenance.title,TITLE);assert.equal(captures,2);
  evidence.browser_restart_recovery='passed';
  await writeFile(path.join(out,'acceptance.json'),JSON.stringify(evidence,null,2));
  console.log(JSON.stringify(evidence));
} catch(error) {
  const jobs=await run.popup.evaluate(async()=> (await chrome.storage.local.get('jobs')).jobs||[]).catch(()=>[]);
  const state={error:error.message,jobs,requests,pages:run.context.pages().map(p=>p.url()),sources:[...sources.values()],captures};
  await writeFile(path.join(out,'failure.json'),JSON.stringify(state,null,2));
  await run.popup.screenshot({path:path.join(out,'synthetic-failure.png')}).catch(()=>{});
  console.error(JSON.stringify(state)); throw error;
} finally {await run.context.close();}
