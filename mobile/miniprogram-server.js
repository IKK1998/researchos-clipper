// Independent scoped collector bridge. Does not change ResearchOS auth or schema.
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, openSync, closeSync, fsyncSync, renameSync, unlinkSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Queue, digest, articleURL, realTitle, validateAPIConfig, Rejected, processNext, apiRequest } from './wechat-core.js';

function atomicJSON(file, value) {
  const tmp = file + '.' + randomBytes(6).toString('hex') + '.tmp';
  const fd = openSync(tmp,'wx',0o600);
  try { writeFileSync(fd,JSON.stringify(value)); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(tmp,file);
}
export class Devices {
  constructor(directory) { this.directory = directory; }
  path(prefix,id) { if (!/^[a-f0-9]{64}$/.test(id)) throw new Rejected('identifier'); return join(this.directory,prefix+'-'+id+'.json'); }
  read() {
    const data = {codes:{},devices:{}};
    for (const file of readdirSync(this.directory)) {
      const m = file.match(/^(code|device)-([a-f0-9]{64})\.json$/);
      if (m) data[m[1] === 'code' ? 'codes' : 'devices'][m[2]] = JSON.parse(readFileSync(join(this.directory,file),'utf8'));
    }
    return data;
  }
  issue(now = Date.now()) {
    const data = this.read(), code = randomBytes(16).toString('hex');
    if (readdirSync(this.directory).filter((n) => /^(?:code|spent-code|device)-/.test(n)).length >= 2000) throw new Rejected('device-store-full');
    if (Object.values(data.codes).filter((v) => !v.used && v.expiresAt > now).length >= 10) throw new Rejected('pairing-limit');
    atomicJSON(this.path('code',digest(code)),{expiresAt:now+600000,used:false});
    return code;
  }
  pair(code,now = Date.now()) {
    if (!/^[a-f0-9]{32}$/.test(code || '')) throw new Rejected('pairing');
    const data = this.read(), entry = data.codes[digest(code)];
    if (!entry || entry.used || entry.expiresAt <= now) throw new Rejected('pairing');
    const live = Object.values(data.devices).filter((v) => !v.revoked && v.expiresAt > now);
    if (live.length >= 20) throw new Rejected('device-limit');
    const token = randomBytes(32).toString('hex'), id = digest(token);
    const original = this.path('code',digest(code));
    // Claim once before creating the device. A crash may consume a code, never
    // resurrect it; the operator can issue a new one without widening permissions.
    renameSync(original,this.path('spent-code',digest(code)));
    entry.used = true;
    const device = {createdAt:now,expiresAt:now+30*86400000,revoked:false};
    atomicJSON(this.path('device',id),device);
    return {access_token:token,expires_at:device.expiresAt};
  }
  auth(header,now = Date.now()) {
    const match = (header || '').match(/^Bearer ([a-f0-9]{64})$/);
    if (!match) throw new Rejected('device-auth');
    const id = digest(match[1]), entry = this.read().devices[id];
    if (!entry || entry.revoked || entry.expiresAt <= now) throw new Rejected('device-auth');
    return id;
  }
  revoke(id) {
    const data = this.read();
    if (!/^[a-f0-9]{64}$/.test(id) || !data.devices[id]) throw new Rejected('device');
    data.devices[id].revoked = true; atomicJSON(this.path('device',id),data.devices[id]);
  }
}
const publicJob = (job) => ({id:job.key,url:job.url,title:job.savedTitle || job.title || '',state:job.state,
  source_id:job.sourceId || null,created_at:job.createdAt,title_verified:Boolean(job.savedTitle),
  ...(job.error ? {error:'处理未完成，请稍后在网站核对'} : {})});
export function configFromEnv(env = process.env) {
  const c = validateAPIConfig({apiBase:env.RESEARCHOS_API_BASE,apiToken:env.RESEARCHOS_API_TOKEN,siteBase:env.RESEARCHOS_SITE_BASE});
  if (!env.MINI_QUEUE_DIR?.startsWith('/')) throw new Rejected('queue-directory');
  return {...c,queueDir:env.MINI_QUEUE_DIR};
}
export function startMini(config,port = 8792,fetcher = fetch) {
  const queue = new Queue(config.queueDir), devices = new Devices(config.queueDir);
  const lock = join(config.queueDir,'mini-receiver.lock');
  const startupLock = join(config.queueDir,'mini-start.lock');
  const startup = openSync(startupLock,'wx',0o600);
  try {
    try {
      const previous = JSON.parse(readFileSync(lock,'utf8'));
      if (!Number.isSafeInteger(previous.pid) || previous.pid < 1) throw new Rejected('lock');
      try { process.kill(previous.pid,0); throw new Rejected('receiver-already-running'); }
      catch (error) { if (error.code !== 'ESRCH') throw error; }
      unlinkSync(lock);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const fd = openSync(lock,'wx',0o600);
    try { writeFileSync(fd,JSON.stringify({pid:process.pid})); fsyncSync(fd); } finally { closeSync(fd); }
  } finally { closeSync(startup); unlinkSync(startupLock); }
  let busy = false;
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      for (const job of queue.jobs()) if (['queued','retry'].includes(job.state) && !activeOwner(job.owner)) {
        job.state = 'failed'; job.error = 'device-revoked'; queue.save(job);
      }
      const job = await processNext(queue,config,transport);
      if (!job) {
        const pending = queue.jobs().find((j) => j.state === 'saved_title_pending' && (!j.refreshedAt || Date.now()-j.refreshedAt > 60000));
        if (pending && activeOwner(pending.owner)) {
          pending.refreshedAt = Date.now(); queue.save(pending);
          try {
            const detail = await apiRequest(config,'GET','/api/v1/sources/'+pending.sourceId,null,fetcher);
            let provenance = detail.source?.provenance;
            if (typeof provenance === 'string') provenance = JSON.parse(provenance);
            if (detail.source?.id === pending.sourceId && articleURL(detail.source.original_value) === pending.url && realTitle(provenance?.title)) {
              pending.savedTitle = realTitle(provenance.title); pending.state = 'saved'; queue.save(pending);
            }
          } catch { /* Keep saved link and pending title; never claim fetched text. */ }
        }
      }
    } catch { console.error('mini-queue-unavailable'); }
    finally { busy = false; }
  },1000);
  function activeOwner(owner) {
    const device = devices.read().devices[owner];
    return device && !device.revoked && device.expiresAt > Date.now();
  }
  const scopedFetch = async (url,init) => {
    if (init.method === 'POST') {
      const body = JSON.parse(init.body), eligible = queue.jobs().find((j) => ['queued','retry'].includes(j.state) && j.nextAt <= Date.now() && j.url === body.value);
      if (!eligible || !activeOwner(eligible.owner)) throw new Rejected('device-revoked');
    }
    return fetcher(url,init);
  };
  // Replace the worker's transport with owner-scoped dispatch.
  const transport = scopedFetch;
  let windowStart = Date.now(), requestCount = 0, pairCount = 0;
  const server = createServer(async (req,res) => {
    const respond = (status,data) => { res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',
      'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}); res.end(JSON.stringify(data)); };
    try {
      const url = new URL(req.url,'http://127.0.0.1');
      if (Date.now()-windowStart >= 60000) { windowStart = Date.now(); requestCount = 0; pairCount = 0; }
      if (++requestCount > 240 || (url.pathname === '/v1/pair' && ++pairCount > 30)) return respond(429,{error:'请稍后重试'});
      if (url.search || req.headers['content-encoding'] || req.headers.origin) throw new Rejected('request');
      if (url.pathname === '/health' && req.method === 'GET') return respond(200,{status:'receiver-alive'});
      let payload;
      if (req.method === 'POST') {
        const n = Number(req.headers['content-length']);
        if (!Number.isInteger(n) || n < 1 || n > 8192) return respond(413,{error:'body-size'});
        const chunks = []; let size = 0;
        for await (const chunk of req) { size += chunk.length; if (size > 8192) return respond(413,{error:'body-size'}); chunks.push(chunk); }
        if (size !== n) throw new Rejected('body-size');
        try { payload = JSON.parse(Buffer.concat(chunks).toString()); } catch { throw new Rejected('json'); }
      }
      if (url.pathname === '/v1/pair' && req.method === 'POST') return respond(200,devices.pair(payload?.code));
      const owner = devices.auth(req.headers.authorization);
      if (url.pathname === '/v1/collect' && req.method === 'POST') {
        const article = articleURL(payload?.url), title = realTitle(payload?.title || '');
        const job = queue.enqueue({key:digest(owner+'\n'+article),owner,url:article,title});
        return respond(202,{accepted:true,job:publicJob(job)});
      }
      if (url.pathname === '/v1/recent' && req.method === 'GET') {
        return respond(200,{items:queue.jobs().filter((j) => j.owner === owner).sort((a,b) => b.createdAt-a.createdAt).slice(0,10).map(publicJob)});
      }
      return respond(404,{error:'not-found'});
    } catch (e) {
      if (!(e instanceof Rejected)) console.error('mini-request-unavailable');
      return respond(e instanceof Rejected ? 403 : 503,{error:'请求未完成，请检查配对或稍后重试'});
    }
  });
  server.requestTimeout = 5000; server.headersTimeout = 5000; server.maxConnections = 32;
  server.once('error',() => { clearInterval(timer); console.error('mini-listener-unavailable'); });
  server.listen(port,'127.0.0.1');
  const stop = async () => { clearInterval(timer); while (busy) await new Promise((r) => setTimeout(r,50)); await new Promise((resolve) => server.close(resolve)); unlinkSync(lock); };
  return {server,queue,devices,stop,transport};
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const config = configFromEnv(), queue = new Queue(config.queueDir), devices = new Devices(config.queueDir);
    if (process.argv[2] === 'issue-code') {
      console.log(devices.issue()); // Operator-only terminal, not chat/logging automation.
    } else if (process.argv[2] === 'revoke') devices.revoke(process.argv[3]);
    else {
      const {stop} = startMini(config); process.once('SIGTERM',stop); process.once('SIGINT',stop);
      console.log('Mini collector listening on loopback:8792');
    }
  } catch { console.error('Mini collector requires private configuration or lock review'); process.exitCode = 1; }
}
