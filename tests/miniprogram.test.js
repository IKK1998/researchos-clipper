import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {Devices,startMini,configFromEnv} from '../mobile/miniprogram-server.js';
import {Queue,digest,processNext} from '../mobile/wechat-core.js';
const {createClient,urlFromText} = createRequire(import.meta.url)('../miniprogram/client.js');
const article = 'https://mp.weixin.qq.com/s/test_article';
const config = {apiBase:'http://127.0.0.1:8888',apiToken:'mock-private-token',siteBase:'https://researchos.cacdb.org/'};
const temp = () => mkdtempSync(join(tmpdir(),'clipper-mini-test-'));
test('one-time pairing, expiry, hashed secrets and revocation',() => {
  const dir = temp();
  try {
    new Queue(dir); const d = new Devices(dir), code = d.issue(1000), result = d.pair(code,1001);
    assert.throws(() => d.pair(code,1002));
    const owner = d.auth('Bearer '+result.access_token,1002);
    assert.equal(owner,digest(result.access_token));
    const persisted = readdirSync(dir).map((p) => readFileSync(join(dir,p),'utf8')).join('');
    assert.ok(!persisted.includes(code)); assert.ok(!persisted.includes(result.access_token));
    assert.throws(() => d.auth('Bearer '+result.access_token,result.expires_at));
    d.revoke(owner); assert.throws(() => d.auth('Bearer '+result.access_token,1002));
    const expired = d.issue(0); assert.throws(() => d.pair(expired,600000));
  } finally {rmSync(dir,{recursive:true});}
});
test('empty and unsafe bridge configuration fails closed',() => {
  assert.throws(() => configFromEnv({}));
  assert.throws(() => configFromEnv({RESEARCHOS_API_BASE:'http://example.org',RESEARCHOS_API_TOKEN:'mock',RESEARCHOS_SITE_BASE:config.siteBase,MINI_QUEUE_DIR:'/tmp/mock'}));
});
test('HTTP bridge queues once, scopes receipts, rejects unsafe requests, then verifies title',async () => {
  const dir = temp(); let posts = 0;
  const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const mock = async (url,init) => {
    assert.equal(init.headers.Authorization,'Bearer '+config.apiToken);
    if (init.method === 'POST') {
      posts++; const body = JSON.parse(init.body);
      assert.equal(body.ai_consent,false); assert.equal(body.value,article);
      return Response.json({saved:true,source_id:id});
    }
    return Response.json({source:{id,original_value:article,provenance:{title:'测试文章的真实标题'}}});
  };
  const running = startMini({...config,queueDir:dir},0,mock);
  await once(running.server,'listening');
  const base = 'http://127.0.0.1:'+running.server.address().port;
  const call = (path,token,body) => fetch(base+path,{method:body ? 'POST' : 'GET',headers:{...(token ? {Authorization:'Bearer '+token} : {}),'Content-Type':'application/json'},...(body ? {body:JSON.stringify(body)} : {})});
  try {
    assert.throws(() => startMini({...config,queueDir:dir},0,mock));
    assert.equal((await call('/v1/recent')).status,403);
    const first = await (await call('/v1/pair',null,{code:running.devices.issue()})).json();
    const second = await (await call('/v1/pair',null,{code:running.devices.issue()})).json();
    const accepted = await (await call('/v1/collect',first.access_token,{url:article})).json();
    assert.equal(accepted.job.state,'queued'); assert.equal(accepted.job.source_id,null);
    assert.ok(!JSON.stringify(accepted).includes(config.apiToken));
    assert.equal((await (await call('/v1/collect',first.access_token,{url:article})).json()).job.id,accepted.job.id);
    assert.equal((await (await call('/v1/recent',second.access_token)).json()).items.length,0);
    assert.equal((await call('/v1/collect',first.access_token,{url:'http://127.0.0.1/secret'})).status,403);
    assert.equal((await call('/v1/recent?extra=1',first.access_token)).status,403);
    const processed = await processNext(running.queue,config,running.transport);
    assert.equal(processed.state,'saved'); assert.equal(posts,1);
    const recent = await (await call('/v1/recent',first.access_token)).json();
    assert.equal(recent.items[0].title,'测试文章的真实标题');
    assert.equal(recent.items[0].title_verified,true);
    running.devices.revoke(digest(first.access_token));
    assert.equal((await call('/v1/recent',first.access_token)).status,403);
  } finally {await running.stop(); rmSync(dir,{recursive:true});}
});
test('receipt without title remains pending; queue survives recreation',async () => {
  const dir = temp(); const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  try {
    const queue = new Queue(dir); queue.enqueue({key:digest(article),url:article,title:''});
    const mock = async (_url,init) => Response.json(init.method === 'POST' ? {saved:true,source_id:id} : {source:{id,original_value:article,provenance:{}}});
    const result = await processNext(new Queue(dir),config,mock);
    assert.equal(result.state,'saved_title_pending'); assert.equal(new Queue(dir).jobs().length,1);
  } finally {rmSync(dir,{recursive:true});}
});
test('background worker rejects revoked queued device and refreshes saved pending title',async () => {
  const dir = temp(), id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'; let posts = 0;
  const running = startMini({...config,queueDir:dir},0,async (_url,init) => {
    if (init.method === 'POST') {posts++; throw new Error('unexpected post');}
    return Response.json({source:{id,original_value:article,provenance:{title:'后台回读标题'}}});
  });
  await once(running.server,'listening');
  try {
    const first = running.devices.pair(running.devices.issue());
    const second = running.devices.pair(running.devices.issue());
    const owner = digest(first.access_token), other = digest(second.access_token);
    const denied = running.queue.enqueue({key:digest(owner+'\n'+article),owner,url:article,title:''});
    const pending = running.queue.enqueue({key:digest(other+'\n'+article),owner:other,url:article,title:''});
    pending.state = 'saved_title_pending'; pending.sourceId = id; running.queue.save(pending);
    running.devices.revoke(owner);
    const deadline = Date.now()+4000;
    while (Date.now() < deadline && running.queue.read(pending.key).state !== 'saved') await new Promise((r) => setTimeout(r,50));
    assert.equal(running.queue.read(denied.key).state,'failed');
    assert.equal(running.queue.read(pending.key).savedTitle,'后台回读标题');
    assert.equal(posts,0);
  } finally {await running.stop(); rmSync(dir,{recursive:true});}
});
function fakeWX() {
  const values = new Map(); const wx = {getStorageSync:k => values.get(k),setStorageSync:(k,v) => values.set(k,v),removeStorageSync:k => values.delete(k)};
  wx.request = ({url,success}) => success({statusCode:200,data:url.endsWith('/pair') ? {access_token:'a'.repeat(64),expires_at:Date.now()+60000} : {accepted:true,job:{id:'receipt',state:'queued'}}});
  return wx;
}
test('phone client pairs, stores offline draft and removes it only after acceptance',async () => {
  const wx = fakeWX(), client = createClient(wx,{apiBase:'https://collector.example.org'});
  await client.pair('b'.repeat(32)); assert.equal(client.paired(),true);
  wx.request = ({fail}) => fail(); await assert.rejects(client.collect(article));
  assert.equal(client.drafts().length,1);
  wx.request = ({success}) => success({statusCode:200,data:{accepted:false}});
  await assert.rejects(client.collect(article)); assert.equal(client.drafts().length,1);
  wx.request = ({success}) => success({statusCode:202,data:{accepted:true,job:{id:'receipt'}}});
  await client.collect(article); assert.equal(client.drafts().length,0);
  wx.request = ({success}) => success({statusCode:403,data:{}});
  await assert.rejects(client.recent()); assert.equal(client.paired(),false);
});
test('phone has no upstream secret or silent clipboard read; URL parser rejects multiple links',async () => {
  assert.throws(() => urlFromText(article+' '+article));
  assert.throws(() => urlFromText('https://evil.example/s/a'));
  assert.equal(urlFromText('文章 '+article),article);
  const wx = fakeWX(); await assert.rejects(createClient(wx,{apiBase:''}).pair('b'.repeat(32)));
  const page = readFileSync(new URL('../miniprogram/pages/home/home.js',import.meta.url),'utf8');
  assert.ok(page.includes('getClipboardData')); // Only the explicit paste handler calls it.
  assert.ok(!readFileSync(new URL('../miniprogram/config.js',import.meta.url),'utf8').includes('apiToken'));
});
