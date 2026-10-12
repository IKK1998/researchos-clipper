import { createServer } from 'node:http';
import { openSync, closeSync, readFileSync, writeFileSync, fsyncSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Queue, Rejected, validateConfig, verify, decrypt, callback, processNext } from './wechat-core.js';

export function configFromEnv(env = process.env) {
  const config = validateConfig({token:env.WECHAT_CALLBACK_TOKEN, aesKey:env.WECHAT_ENCODING_AES_KEY,
    appId:env.WECHAT_APP_ID, accountId:env.WECHAT_ACCOUNT_ID,
    allowedUsers:(env.WECHAT_ALLOWED_OPENIDS || '').split(',').map((x) => x.trim()).filter(Boolean),
    apiBase:env.RESEARCHOS_API_BASE,siteBase:env.RESEARCHOS_SITE_BASE,apiToken:env.RESEARCHOS_API_TOKEN});
  if (!env.CLIPPER_QUEUE_DIR || !env.CLIPPER_QUEUE_DIR.startsWith('/')) throw new Rejected('queue-directory');
  return {...config,queueDir:env.CLIPPER_QUEUE_DIR};
}

export function start(config, port = 8791) {
  const queue = new Queue(config.queueDir), lock = join(config.queueDir,'receiver.lock');
  // Single-host PID lock. Only a proven dead owner's lock can be removed.
  // Serialize recovery too: two starters must not remove each other's new lock.
  const startupLock = join(config.queueDir,'receiver-start.lock');
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
    try { await processNext(queue,config); } catch { console.error('queue-unavailable'); }
    finally { busy = false; }
  },1000);
  const server = createServer(async (req,res) => {
    const answer = (status,text,type = 'text/plain; charset=utf-8') => {
      res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}); res.end(text);
    };
    try {
      const url = new URL(req.url,'http://127.0.0.1');
      if (url.pathname === '/health' && req.method === 'GET') return answer(200,'receiver-alive');
      if (url.pathname !== '/wechat/callback') return answer(404,'not-found');
      if ([...url.searchParams.keys()].some((k) => url.searchParams.getAll(k).length !== 1)) throw new Rejected('query');
      if (req.method === 'GET') {
        const echo = url.searchParams.get('echostr') || '';
        if (!echo || echo.length > 4096) throw new Rejected('challenge');
        if (url.searchParams.get('encrypt_type') === 'aes') {
          verify(config,url.searchParams,echo);
          return answer(200,decrypt(config,echo));
        }
        // Official-account initial URL verification can be a signed plaintext GET.
        // This does not enable plaintext message POSTs.
        verify(config,url.searchParams);
        return answer(200,echo);
      }
      if (req.method !== 'POST') return answer(405,'method-not-allowed');
      if (req.headers['content-encoding']) throw new Rejected('encoding');
      const length = Number(req.headers['content-length']);
      if (!Number.isInteger(length) || length < 1 || length > 65536) return answer(413,'body-size');
      let size = 0, parts = [];
      for await (const part of req) {
        size += part.length;
        if (size > 65536) return answer(413,'body-size');
        parts.push(part);
      }
      if (size !== length) throw new Rejected('body-size');
      const raw = new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts));
      return answer(200,callback(config,queue,url.searchParams,raw),'application/xml; charset=utf-8');
    } catch (error) {
      if (!(error instanceof Rejected)) console.error('callback-unavailable');
      // Never print message bodies, URLs, OpenIDs, signatures or secrets.
      return answer(error instanceof Rejected ? 403 : 503,'callback-rejected');
    }
  });
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  server.maxConnections = 32;
  server.listen(port,'127.0.0.1');
  // Binding failures must stop the worker; never leave a half-started receiver.
  server.once('error',() => { clearInterval(timer); console.error('receiver-listener-unavailable'); });
  const stop = async () => {
    clearInterval(timer);
    while (busy) await new Promise((resolve) => setTimeout(resolve,50));
    server.close(() => { unlinkSync(lock); });
  };
  return {server,queue,stop};
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const {stop} = start(configFromEnv());
    process.once('SIGTERM',stop); process.once('SIGINT',stop);
    console.log('WeChat receiver listening on loopback:8791; encrypted messages only');
  } catch { console.error('Receiver not started: configuration or queue lock requires operator review'); process.exitCode = 1; }
}
