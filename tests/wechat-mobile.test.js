import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { Queue, signature, verify, xml, parseXML, encrypt, decrypt, articleURL, message,
  validateConfig, callback, processNext, apiRequest } from '../mobile/wechat-core.js';
import { start, configFromEnv } from '../mobile/wechat-server.js';

const now = 1800000000;
const config = {token:'fixtureTokenNotASecret',aesKey:Buffer.alloc(32,7).toString('base64').slice(0,-1),
  appId:'wxfixture',accountId:'gh_fixture',allowedUsers:['fixture-user'],apiBase:'http://127.0.0.1:8010',
  siteBase:'https://researchos.example.org/',apiToken:'fixture-api-not-a-secret'};
const fields = {ToUserName:config.accountId,FromUserName:'fixture-user',CreateTime:now,MsgType:'link',
  MsgId:'12345',Title:'人体组织衰老：原始标题 & 方法',Url:'https://mp.weixin.qq.com/s/fixture_article'};
function envelope(values = fields, cfg = config, time = now) {
  const outer = encrypt(cfg,xml(values),String(time),'fixture-nonce');
  const encrypted = parseXML(outer).Encrypt;
  return {raw:xml({ToUserName:cfg.accountId,Encrypt:encrypted}),query:new URLSearchParams({encrypt_type:'aes',
    timestamp:String(time),nonce:'fixture-nonce',msg_signature:signature(cfg.token,String(time),'fixture-nonce',encrypted)})};
}
function withQueue(fn) {
  const dir = mkdtempSync(join(tmpdir(),'clipper-mobile-test-'));
  try { return fn(new Queue(dir),dir); } finally { rmSync(dir,{recursive:true,force:true}); }
}
test('encrypted UTF-8 message and encrypted reply preserve title; no false saved acknowledgement', () => withQueue((queue) => {
  const input = envelope();
  const reply = parseXML(callback(config,queue,input.query,input.raw,now));
  verify(config,new URLSearchParams({timestamp:reply.TimeStamp,nonce:reply.Nonce,msg_signature:reply.MsgSignature}),reply.Encrypt,now);
  const plain = parseXML(decrypt(config,reply.Encrypt));
  assert.match(plain.Content,/已接收，等待网站入库/);
  assert.match(plain.Content,/人体组织衰老/);
  assert.equal(queue.jobs()[0].title,fields.Title);
}));
test('reject wrong signature, stale request, changed cipher and wrong application', () => {
  const {raw,query} = envelope();
  const cipher = parseXML(raw).Encrypt;
  assert.throws(() => verify(config,query,cipher,now + 301));
  const bad = new URLSearchParams(query); bad.set('msg_signature','0'.repeat(40));
  assert.throws(() => verify(config,bad,cipher,now));
  assert.throws(() => verify(config,query,'A' + cipher.slice(1),now));
  assert.throws(() => decrypt({...config,appId:'wxother'},cipher));
});
test('reject plaintext POST even with valid signature', () => withQueue((queue) => {
  const query = new URLSearchParams({timestamp:String(now),nonce:'x',signature:signature(config.token,String(now),'x')});
  assert.throws(() => callback(config,queue,query,xml(fields),now),/encrypted-only/);
}));
test('decrypt an independent public wechatpy AES framing/signature fixture', () => {
  // Public test vector, NOT user credentials. wechatpy tests/test_crypto.py.
  // Enterprise AES framing is shared; this is not live official-account acceptance.
  const reference = {token:'123456',aesKey:'kWxPEV2UEDyxWpmPdKC3F4dgPDmOvfKX1HGnEUDS1aR',appId:'wx49f0ab532d5d035a'};
  const ciphertext = 'RgqEoJj5A4EMYlLvWO1F86ioRjZfaex/gePD0gOXTxpsq5Yj4GNglrBb8I2BAJVODGajiFnXBu7mCPatfjsu6IHCrsTyeDXzF6Bv283dGymzxh6ydJRvZsryDyZbLTE7rhnus50qGPMfp2wASFlzEgMW9z1ef/RD8XzaFYgm7iTdaXpXaG4+BiYyolBug/gYNx410cvkKR2/nPwBiT+P4hIiOAQqGp/TywZBtDh1yCF2KOd0gpiMZ5jSw3e29mTvmUHzkVQiMS6td7vXUaWOMZnYZlF3So2SjHnwh4jYFxdgpkHHqIrH/54SNdshoQgWYEvccTKe7FS709/5t6NMxuGhcUGAPOQipvWTT4dShyqio7mlsl5noTrb++x6En749zCpQVhDpbV6GDnTbcX2e8K9QaNWHp91eBdCRxthuL0=';
  const q = new URLSearchParams({timestamp:'1411525903',nonce:'461056294',msg_signature:'74d92dfeb87ba7c714f89d98870ae5eb62dff26d'});
  verify(reference,q,ciphertext,1411525903);
  const values = parseXML(decrypt(reference,ciphertext));
  assert.equal(values.Content,'test'); assert.equal(values.FromUserName,'messense');
});
test('fail closed for unbound sender, wrong receiver, stale message and multi-link text', () => {
  for (const patch of [{FromUserName:'stranger'},{ToUserName:'gh_other'},{CreateTime:now-601},
    {MsgType:'image'},{MsgId:'x'},{MsgType:'text',Content:fields.Url+' '+fields.Url}]) {
    assert.throws(() => message(config,{...fields,...patch},now));
  }
});
test('only exact WeChat article host/path; no URL-based SSRF or redirect fetching', () => {
  for (const url of ['http://127.0.0.1/a','https://mp.weixin.qq.com.evil/s/x','https://a@mp.weixin.qq.com/s/x',
    'https://mp.weixin.qq.com:4430/s/x','https://mp.weixin.qq.com/a','https://mp.weixin.qq.com\\@evil/s/x']) assert.throws(() => articleURL(url));
  assert.equal(articleURL('http://mp.weixin.qq.com/s/x#top'),'https://mp.weixin.qq.com/s/x');
  assert.equal(message(config,{...fields,MsgType:'text',Content:fields.Url},now).title,'');
});
test('flat XML rejects entity injection, nested content and duplicate fields', () => {
  for (const value of ['<!DOCTYPE xml><xml></xml>','<xml><a>&xxe;</a></xml>','<xml><a><b>x</b></a></xml>',
    '<xml><a>x</a><a>y</a></xml>','<xml bad="x"></xml>']) assert.throws(() => parseXML(value));
  assert.equal(parseXML('<xml><a><![CDATA[甲 & 乙]]></a><b>&#65;&amp;</b></xml>').b,'A&');
});
test('message redelivery is idempotent and queue survives restart; collisions rejected', () => withQueue((queue,dir) => {
  const input = envelope();
  callback(config,queue,input.query,input.raw,now);
  callback(config,queue,input.query,input.raw,now);
  const restarted = new Queue(dir);
  assert.equal(restarted.jobs().length,1);
  assert.equal(restarted.jobs()[0].state,'queued');
  const altered = envelope({...fields,Title:'another title'});
  assert.throws(() => callback(config,restarted,altered.query,altered.raw,now),/message-collision/);
}));
test('queue has a finite total record cap, preserving existing receipts', () => withQueue((queue) => {
  queue.limit = 1;
  queue.enqueue(message(config,fields,now));
  assert.throws(() => queue.enqueue(message(config,{...fields,MsgId:'54321'},now)),/queue-full/);
}));
test('invalid or empty auth configuration cannot start; redirect upstream not permitted', async () => {
  assert.equal(validateConfig(config),config);
  for (const patch of [{allowedUsers:[]},{apiToken:''},{aesKey:'bad'},{apiBase:'http://example.org'},
    {apiBase:'https://user:secret@example.org/'},{siteBase:'http://example.org'}]) assert.throws(() => validateConfig({...config,...patch}));
  assert.throws(() => configFromEnv({}));
  let init;
  await assert.rejects(apiRequest(config,'GET','/api/v1/sources/x',null,async (url,options) => {
    init = options; throw new Error('redirect');
  }),/transport/);
  assert.equal(init.redirect,'error');
});

test('HTTP intake → source/title readback → persistent receipt; AI disabled; existing title retained', async () => {
  const dir = mkdtempSync(join(tmpdir(),'clipper-mobile-http-'));
  const sourceId = '12345678-1234-1234-1234-123456789abc';
  let posts = 0, stored = '';
  const upstream = createServer(async (req,res) => {
    assert.equal(req.headers.authorization,'Bearer '+config.apiToken);
    res.setHeader('Content-Type','application/json');
    if (req.method === 'POST') {
      const pieces = []; for await (const p of req) pieces.push(p);
      const body = JSON.parse(Buffer.concat(pieces));
      assert.equal(body.ai_consent,false); assert.equal(body.fill_missing_title,true);
      if (!stored) stored = body.title;
      posts++;
      return res.end(JSON.stringify({saved:true,duplicate:posts>1,source_id:sourceId}));
    }
    res.end(JSON.stringify({source:{id:sourceId,original_value:fields.Url,provenance:{title:stored}}}));
  });
  await new Promise((resolve) => upstream.listen(0,'127.0.0.1',resolve));
  const cfg = {...config,apiBase:'http://127.0.0.1:'+upstream.address().port};
  try {
    const queue = new Queue(dir), input = envelope();
    callback(cfg,queue,input.query,input.raw,now);
    let job = await processNext(queue,cfg,fetch,now*1000);
    assert.equal(job.state,'saved'); assert.equal(job.titleMatches,true);
    const receipt = parseXML(callback(cfg,queue,input.query,input.raw,now));
    assert.match(parseXML(decrypt(cfg,receipt.Encrypt)).Content,/已入库/);
    assert.equal(await processNext(queue,cfg,fetch,now*1000),null);
    assert.equal(posts,1);
    const other = envelope({...fields,MsgId:'12346',Title:'new forwarded title'});
    callback(cfg,queue,other.query,other.raw,now);
    job = await processNext(queue,cfg,fetch,now*1000);
    assert.equal(job.savedTitle,fields.Title); assert.equal(job.titleMatches,false);
  } finally { upstream.closeAllConnections(); await new Promise((resolve) => upstream.close(resolve)); rmSync(dir,{recursive:true,force:true}); }
});
test('bounded transient retries preserve source ID and do not replay confirmed intake', async () => {
  const dir = mkdtempSync(join(tmpdir(),'clipper-mobile-retry-'));
  try {
    const queue = new Queue(dir); queue.enqueue(message(config,fields,now),now*1000);
    let posts = 0;
    const mock = async (url,init) => {
      if (init.method === 'POST') { posts++; return Response.json({saved:true,source_id:'12345678-1234-1234-1234-123456789abc'}); }
      return new Response('unavailable',{status:503});
    };
    const a = await processNext(queue,config,mock,now*1000);
    assert.equal(a.state,'retry'); assert.ok(a.sourceId);
    assert.equal(await processNext(queue,config,mock,now*1000),null);
    const b = await processNext(new Queue(dir),config,mock,now*1000+31000);
    const c = await processNext(queue,config,mock,now*1000+100000);
    assert.equal(b.state,'retry'); assert.equal(c.state,'failed'); assert.equal(posts,1);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});
test('plain link is saved_title_pending; mismatched readback never reports saved', async () => {
  const dir = mkdtempSync(join(tmpdir(),'clipper-mobile-title-'));
  try {
    const queue = new Queue(dir), item = message(config,{...fields,MsgType:'text',Content:fields.Url},now);
    queue.enqueue(item,now*1000);
    const sourceId = '12345678-1234-1234-1234-123456789abc';
    const mock = async (u,i) => Response.json(i.method === 'POST' ? {saved:true,source_id:sourceId} :
      {source:{id:sourceId,original_value:fields.Url,provenance:{}}});
    assert.equal((await processNext(queue,config,mock,now*1000)).state,'saved_title_pending');
    queue.enqueue(message(config,{...fields,MsgId:'999'},now),now*1000);
    const wrong = async (u,i) => Response.json(i.method === 'POST' ? {saved:true,source_id:sourceId} :
      {source:{id:sourceId,original_value:'https://mp.weixin.qq.com/s/other',provenance:{title:'wrong'}}});
    assert.equal((await processNext(queue,config,wrong,now*1000)).state,'failed');
  } finally { rmSync(dir,{recursive:true,force:true}); }
});
test('real HTTP callback challenge, encrypted POST and rejected plaintext; no public listener', async () => {
  const dir = mkdtempSync(join(tmpdir(),'clipper-mobile-server-'));
  const receiver = start({...config,queueDir:dir},0);
  await new Promise((resolve) => receiver.server.once('listening',resolve));
  const base = 'http://127.0.0.1:'+receiver.server.address().port;
  try {
    assert.equal(receiver.server.address().address,'127.0.0.1');
    const ts = String(Math.floor(Date.now()/1000));
    const q = new URLSearchParams({timestamp:ts,nonce:'x',signature:signature(config.token,ts,'x'),echostr:'challenge'});
    assert.equal(await (await fetch(base+'/wechat/callback?'+q)).text(),'challenge');
    const input = envelope({...fields,CreateTime:Number(ts)},config,Number(ts));
    const result = await fetch(base+'/wechat/callback?'+input.query,{method:'POST',body:input.raw});
    assert.equal(result.status,200); assert.ok(parseXML(await result.text()).Encrypt);
    const rejected = await fetch(base+'/wechat/callback?'+q,{method:'POST',body:xml(fields)});
    assert.equal(rejected.status,403);
    assert.equal((await fetch(base+'/wechat/callback?'+q+'&nonce=duplicate')).status,403);
  } finally {
    receiver.server.closeAllConnections(); await receiver.stop();
    await new Promise((resolve) => receiver.server.once('close',resolve));
    rmSync(dir,{recursive:true,force:true});
  }
});
test('actual child-process crash/restart retains queue and rejects a second live receiver', async () => {
  const dir = mkdtempSync(join(tmpdir(),'clipper-mobile-process-'));
  const script = fileURLToPath(new URL('../mobile/wechat-server.js',import.meta.url));
  // Child start() uses the system-assigned test port, never the production port.
  const entry = `import {start} from ${JSON.stringify(new URL('../mobile/wechat-server.js',import.meta.url).href)};
    const receiver=start(JSON.parse(process.env.TEST_CONFIG),0);
    receiver.server.once('listening',()=>console.log(receiver.server.address().port));
    process.once('SIGTERM',receiver.stop);`;
  const cfg = {...config,queueDir:dir};
  let first, second;
  const launch = async () => {
    const child = spawn(process.execPath,['--input-type=module','-e',entry],{
      cwd:join(script,'..'),env:{...process.env,TEST_CONFIG:JSON.stringify(cfg)},stdio:['ignore','pipe','pipe'],
    });
    const [data] = await once(child.stdout,'data');
    return {child,port:Number(data.toString().trim())};
  };
  try {
    first = await launch();
    const ts = Math.floor(Date.now()/1000), input = envelope({...fields,CreateTime:ts},config,ts);
    const result = await fetch(`http://127.0.0.1:${first.port}/wechat/callback?`+input.query,{method:'POST',body:input.raw});
    assert.equal(result.status,200);
    assert.throws(() => start(cfg,0),/receiver-already-running/);
    const exit = once(first.child,'exit'); first.child.kill('SIGKILL'); await exit;
    second = await launch();
    const replay = await fetch(`http://127.0.0.1:${second.port}/wechat/callback?`+input.query,{method:'POST',body:input.raw});
    assert.equal(replay.status,200);
    assert.equal(new Queue(dir).jobs().length,1);
    assert.equal(new Queue(dir).jobs()[0].title,fields.Title);
    const stop = once(second.child,'exit'); second.child.kill('SIGTERM'); await stop;
  } finally {
    for (const running of [first,second]) if (running && running.child.exitCode === null && running.child.signalCode === null) {
      const exit = once(running.child,'exit'); running.child.kill('SIGKILL'); await exit;
    }
    rmSync(dir,{recursive:true,force:true});
  }
});
