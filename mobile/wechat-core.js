// Official-account callback adapter. No personal-WeChat automation or article fetches.
import { createHash, createCipheriv, createDecipheriv, timingSafeEqual, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, renameSync, readdirSync, openSync, fsyncSync, closeSync } from 'node:fs';
import { join } from 'node:path';

export class Rejected extends Error {}
export const digest = (value) => createHash('sha256').update(value).digest('hex');
export const signature = (...parts) => createHash('sha1').update(parts.sort().join('')).digest('hex');
const equal = (a, b) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
export function verify(config, query, encrypted = '', now = Date.now() / 1000) {
  const ts = query.get('timestamp') || '', nonce = query.get('nonce') || '';
  const sig = query.get(encrypted ? 'msg_signature' : 'signature') || '';
  if (!/^\d{1,12}$/.test(ts) || Math.abs(Number(ts) - now) > 300 || !nonce || nonce.length > 128
      || !/^[a-f0-9]{40}$/.test(sig)) throw new Rejected('signature');
  const expected = encrypted ? signature(config.token, ts, nonce, encrypted) : signature(config.token, ts, nonce);
  if (!equal(expected, sig)) throw new Rejected('signature');
}

// Deliberately accepts only the flat text/CDATA XML schema used by callbacks.
// No attributes, nesting, comments, DTD, external entities or duplicate fields.
export function parseXML(input) {
  if (Buffer.byteLength(input) > 65536 || /<!DOCTYPE|<!ENTITY/i.test(input)) throw new Rejected('xml');
  const root = input.trim().match(/^<xml>([\s\S]*)<\/xml>$/);
  if (!root) throw new Rejected('xml');
  const result = {}, fields = /\s*<([A-Za-z][A-Za-z0-9_]*)>(<!\[CDATA\[[\s\S]*?\]\]>|[^<]*)<\/\1>\s*/gy;
  let offset = 0;
  while (offset < root[1].length) {
    fields.lastIndex = offset;
    const m = fields.exec(root[1]);
    if (!m || Object.hasOwn(result, m[1]) || Object.keys(result).length >= 32) throw new Rejected('xml');
    let value = m[2];
    if (value.startsWith('<![CDATA[')) value = value.slice(9, -3);
    else {
      if (/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/.test(value)) throw new Rejected('xml');
      value = value.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, (_, entity) => {
        if (!entity.startsWith('#')) return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[entity];
        const n = entity.startsWith('#x') ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
        if (!n || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) throw new Rejected('xml');
        return String.fromCodePoint(n);
      });
    }
    result[m[1]] = value;
    offset = fields.lastIndex;
  }
  return result;
}
const xmlEscape = (s) => String(s).replace(/[<>&"']/g, (c) => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
export const xml = (fields) => '<xml>' + Object.entries(fields).map(([k,v]) => `<${k}>${xmlEscape(v)}</${k}>`).join('') + '</xml>';

function keyFor(config) {
  if (!/^[A-Za-z0-9+/]{43}$/.test(config.aesKey || '')) throw new Rejected('key');
  const key = Buffer.from(config.aesKey + '=', 'base64');
  if (key.length !== 32) throw new Rejected('key');
  return key;
}
export function decrypt(config, encrypted) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encrypted) || encrypted.length % 4) throw new Rejected('envelope');
  const key = keyFor(config), input = Buffer.from(encrypted, 'base64');
  if (!input.length || input.length % 16) throw new Rejected('envelope');
  const cipher = createDecipheriv('aes-256-cbc', key, key.subarray(0,16));
  cipher.setAutoPadding(false);
  let plain = Buffer.concat([cipher.update(input), cipher.final()]);
  const pad = plain.at(-1);
  if (!pad || pad > 32 || plain.length < pad || !plain.subarray(-pad).every((b) => b === pad)) throw new Rejected('padding');
  plain = plain.subarray(0, -pad);
  if (plain.length < 20) throw new Rejected('envelope');
  const length = plain.readUInt32BE(16);
  if (length > plain.length - 20 || !equal(plain.subarray(20 + length).toString(), config.appId)) throw new Rejected('appid');
  return new TextDecoder('utf-8', {fatal:true}).decode(plain.subarray(20,20 + length));
}
export function encrypt(config, plain, ts, nonce) {
  const key = keyFor(config), payload = Buffer.from(plain), size = Buffer.alloc(4);
  size.writeUInt32BE(payload.length);
  const body = Buffer.concat([randomBytes(16), size, payload, Buffer.from(config.appId)]);
  const pad = 32 - body.length % 32;
  const cipher = createCipheriv('aes-256-cbc', key, key.subarray(0,16));
  cipher.setAutoPadding(false);
  const data = Buffer.concat([cipher.update(Buffer.concat([body,Buffer.alloc(pad,pad)])),cipher.final()]).toString('base64');
  return xml({Encrypt:data,MsgSignature:signature(config.token,ts,nonce,data),TimeStamp:ts,Nonce:nonce});
}

export function articleURL(value) {
  if (typeof value !== 'string' || value.length > 4096 || /[\s\\\u0000-\u001f]/.test(value)) throw new Rejected('url');
  let url;
  try { url = new URL(value); } catch { throw new Rejected('url'); }
  if (!['http:','https:'].includes(url.protocol) || url.hostname !== 'mp.weixin.qq.com' || url.username || url.password || url.port
      || !(/^\/s\/[A-Za-z0-9_-]+$/.test(url.pathname) || (url.pathname === '/s' && ['__biz','mid','idx','sn'].every((k) => url.searchParams.get(k))))) throw new Rejected('url');
  url.protocol = 'https:';
  url.hash = '';
  return url.href;
}
export function realTitle(value = '') {
  const title = value.replace(/[\u0000-\u001f]/g,' ').trim();
  if (!title || title.length > 1000 || /^(https?:\/\/|微信$|WeChat$|微信公众平台$|微信公众号文章$|公众号链接（标题待获取）$|访问验证$|环境异常$)/i.test(title)) return '';
  return title;
}
export function message(config, fields, now = Date.now() / 1000) {
  if (fields.ToUserName !== config.accountId || !config.allowedUsers.includes(fields.FromUserName)) throw new Rejected('sender');
  if (!/^\d+$/.test(fields.CreateTime || '') || Math.abs(Number(fields.CreateTime) - now) > 600) throw new Rejected('age');
  if (fields.MsgType === 'event') return null;
  if (!/^\d{1,30}$/.test(fields.MsgId || '')) throw new Rejected('msgid');
  let url, title = '';
  if (fields.MsgType === 'link') {
    url = articleURL(fields.Url);
    title = realTitle(fields.Title);
  } else if (fields.MsgType === 'text') {
    const links = (fields.Content || '').match(/https?:\/\/[^\s<>"']+/g) || [];
    if (links.length !== 1) throw new Rejected('one-link-required');
    url = articleURL(links[0]);
  } else throw new Rejected('unsupported');
  return {key:digest([config.appId, fields.FromUserName, fields.MsgId].join('\n')),url,title};
}

export class Queue {
  constructor(directory, limit = 1000) {
    this.directory = directory;
    this.limit = limit;
    mkdirSync(directory, {recursive:true, mode:0o700});
  }
  read(key) { return JSON.parse(readFileSync(join(this.directory, key + '.json'),'utf8')); }
  save(job) {
    if (!/^[a-f0-9]{64}$/.test(job.key)) throw new Rejected('jobkey');
    const tmp = join(this.directory, job.key + '.' + randomBytes(6).toString('hex') + '.tmp');
    const fd = openSync(tmp,'wx',0o600);
    try { writeFileSync(fd, JSON.stringify(job)); fsyncSync(fd); } finally { closeSync(fd); }
    renameSync(tmp,join(this.directory,job.key + '.json'));
    const dir = openSync(this.directory,'r');
    try { fsyncSync(dir); } finally { closeSync(dir); }
  }
  jobs() { return readdirSync(this.directory).filter((n) => /^[a-f0-9]{64}\.json$/.test(n)).map((n) => this.read(n.slice(0,-5))); }
  enqueue(item, now = Date.now()) {
    const jobs = this.jobs(), old = jobs.find((j) => j.key === item.key);
    if (old) {
      if (old.url !== item.url || old.title !== item.title) throw new Rejected('message-collision');
      return old;
    }
    // Bounded total spool size. Completed receipts are never silently deleted.
    if (jobs.length >= this.limit) throw new Rejected('queue-full');
    const job = {...item,state:'queued',attempts:0,nextAt:now,createdAt:now};
    this.save(job);
    return job;
  }
}

export function validateAPIConfig(c) {
  if (!c.apiToken) throw new Rejected('configuration');
  const u = new URL(c.apiBase), page = new URL(c.siteBase);
  if (u.username || u.password || u.search || u.hash || (u.pathname !== '/' && u.pathname !== '')
      || !(u.protocol === 'https:' || (u.protocol === 'http:' && u.hostname === '127.0.0.1'))
      || page.protocol !== 'https:' || page.username || page.password || page.search || page.hash || page.pathname !== '/') throw new Rejected('endpoint');
  return c;
}
export function validateConfig(c) {
  if (!/^[A-Za-z0-9]{3,32}$/.test(c.token || '') || !/^wx[A-Za-z0-9]+$/.test(c.appId || '') || !c.accountId
      || !c.allowedUsers?.length || c.allowedUsers.some((u) => !u)) throw new Rejected('configuration');
  keyFor(c);
  return validateAPIConfig(c);
}

export class UpstreamError extends Error {
  constructor(code, retryable = false) { super(code); this.retryable = retryable; }
}
export async function apiRequest(config, method, path, payload, fetcher = fetch) {
  let response;
  try {
    response = await fetcher(config.apiBase.replace(/\/$/, '') + path, {
      method, redirect:'error', signal:AbortSignal.timeout(10000),
      headers:{Authorization:'Bearer ' + config.apiToken,'Content-Type':'application/json'},
      ...(payload ? {body:JSON.stringify(payload)} : {}),
    });
  } catch { throw new UpstreamError('transport',true); }
  if (!response.ok) throw new UpstreamError('http_' + response.status,[429,502,503,504].includes(response.status));
  const reader = response.body.getReader();
  let length = 0, chunks = [];
  while (true) {
    const {done,value} = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 262144) { await reader.cancel(); throw new UpstreamError('response-too-large'); }
    chunks.push(Buffer.from(value));
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new UpstreamError('invalid-json'); }
}
export async function processNext(queue, config, fetcher = fetch, now = Date.now()) {
  const job = queue.jobs().find((j) => ['queued','retry'].includes(j.state) && j.nextAt <= now);
  if (!job) return null;
  job.attempts += 1;
  queue.save(job);
  try {
    if (!job.sourceId) {
      const receipt = await apiRequest(config,'POST','/api/v1/intake',{
        value:job.url,source_kind:'wechat',title:job.title,fill_missing_title:true,ai_consent:false,
      },fetcher);
      if (receipt.saved !== true || !/^[a-f0-9-]{36}$/i.test(receipt.source_id || '')) throw new UpstreamError('invalid-receipt');
      job.sourceId = receipt.source_id;
      queue.save(job);
    }
    const detail = await apiRequest(config,'GET','/api/v1/sources/' + job.sourceId,null,fetcher);
    const source = detail.source;
    if (!source || source.id !== job.sourceId) throw new UpstreamError('source-mismatch');
    let sameURL = false;
    try { sameURL = articleURL(source.original_value) === job.url; } catch {}
    if (!sameURL) throw new UpstreamError('source-mismatch');
    let provenance = source.provenance;
    if (typeof provenance === 'string') { try { provenance = JSON.parse(provenance); } catch { provenance = {}; } }
    job.savedTitle = realTitle(provenance?.title || '');
    job.state = job.savedTitle ? 'saved' : 'saved_title_pending';
    job.titleMatches = Boolean(job.title && job.title === job.savedTitle);
    job.completedAt = now;
    delete job.error;
  } catch (error) {
    job.error = error instanceof UpstreamError ? error.message : 'internal';
    job.state = error.retryable && job.attempts < 3 ? 'retry' : 'failed';
    job.nextAt = now + 30000 * 2 ** (job.attempts - 1);
  }
  queue.save(job);
  return job;
}

export function callback(config, queue, query, raw, now = Date.now() / 1000) {
  const outer = parseXML(raw);
  if (!outer.Encrypt || query.get('encrypt_type') !== 'aes') throw new Rejected('encrypted-only');
  verify(config,query,outer.Encrypt,now);
  const fields = parseXML(decrypt(config,outer.Encrypt));
  const item = message(config,fields,now);
  if (!item) return 'success';
  const job = queue.enqueue(item,now * 1000);
  const saved = ['saved','saved_title_pending'].includes(job.state);
  const label = saved ? '已入库' : job.state === 'failed' ? '提交未完成，请在网站核对，不要视为保存成功' : '已接收，等待网站入库';
  const title = job.savedTitle || job.title || '标题待获取';
  const content = `${label}：${title}\n在“我的资料”按标题或原链接搜索。\n${config.siteBase}\n收到链接不代表正文已保存。`;
  const reply = xml({ToUserName:fields.FromUserName,FromUserName:fields.ToUserName,CreateTime:Math.floor(now),MsgType:'text',Content:content});
  return encrypt(config,reply,String(Math.floor(now)),query.get('nonce'));
}
