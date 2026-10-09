import {articleURL, validTitle, websiteOrigin} from './core.js';
let running = false;
const DEFAULT_SITE = 'https://researchos.cacdb.org';
async function config() {
  const s = await chrome.storage.local.get(['site', 'jobs']);
  return {site: websiteOrigin(s.site || DEFAULT_SITE), jobs: s.jobs || []};
}
async function store(jobs) {
  // Preserve collections added while a website request was in flight.
  const current = (await chrome.storage.local.get('jobs')).jobs || [];
  const known = new Set(jobs.map(j => j.url));
  await chrome.storage.local.set({jobs: jobs.concat(current.filter(j => !known.has(j.url)))});
}

async function websiteRequest(site, path, method = 'GET', data) {
  // Use the owner's normal signed-in website tab. Never inspect or export cookies.
  const tabs = await chrome.tabs.query({url: site + '/*'});
  const tab = tabs.find(t => t.url && new URL(t.url).origin === site);
  if (!tab) {
    const {loginTabId} = await chrome.storage.local.get('loginTabId');
    let exists = false;
    if (loginTabId) { try { await chrome.tabs.get(loginTabId); exists = true; } catch {} }
    if (!exists) { const opened = await chrome.tabs.create({url: site}); await chrome.storage.local.set({loginTabId: opened.id}); }
    throw new Error('请先在打开的网站页面登录，之后会自动继续');
  }
  const results = await chrome.scripting.executeScript({target: {tabId: tab.id},
    func: async (site, path, method, data) => {
      if (location.origin !== site) return {error: '请先登录 ResearchOS'};
      try {
        const r = await fetch(path, {method, credentials: 'same-origin', redirect: 'error',
          headers: {'Content-Type': 'application/json'}, body: data === undefined ? undefined : JSON.stringify(data),
          signal: AbortSignal.timeout(25000)});
        if (!r.ok) return {error: '网站请求未确认（' + r.status + '）'};
        return {data: await r.json()};
      } catch { return {error: '网站连接未确认，稍后自动继续'}; }
    }, args: [site, path, method, data]});
  const result = results[0]?.result;
  if (!result?.data) throw new Error(result?.error || '请先登录网站');
  return result.data;
}
async function pageTitle(tabId, expected) {
  const tab = await chrome.tabs.get(tabId);
  if (articleURL(tab.url || '') !== expected) return {blocked: true};
  const results = await chrome.scripting.executeScript({target: {tabId}, func: expected => {
    const current = new URL(location.href); current.hash = '';
    if (current.href !== expected) return null;
    return document.querySelector('#activity-name')?.textContent?.trim() ||
      document.querySelector('meta[property="og:title"]')?.content || document.title;
  }, args: [expected]});
  return {title: validTitle(results[0]?.result)};
}
async function processJobs() {
  if (running) return;
  running = true;
  try {
    const {site, jobs} = await config();
    for (const job of jobs) {
      if (job.state === 'done') continue;
      try {
        if (!job.id) {
          const receipt = await websiteRequest(site, '/api/v1/intake', 'POST',
            {value: job.url, source_kind: 'wechat', title: job.title || '', ai_consent: false});
          if (!receipt.saved || !/^[0-9a-f-]{36}$/i.test(receipt.source_id)) throw new Error('未收到保存凭据');
          job.id = receipt.source_id; await store(jobs);
        }
        let detail = await websiteRequest(site, '/api/v1/sources/' + job.id);
        const source = detail.source;
        if (!source || articleURL(source.original_value) !== job.url) throw new Error('资料链接不匹配');
        const existing = validTitle(source.provenance?.title);
        if (existing) { job.title = existing; job.state = 'done'; job.message = '标题已保存'; await store(jobs); continue; }
        if (!job.title) {
          if (job.tabId) {
            try { await chrome.tabs.get(job.tabId); } catch { delete job.tabId; }
          }
          if (!job.tabId) {
            const tab = await chrome.tabs.create({url: job.url, active: false});
            job.tabId = tab.id; job.createdTab = true; await store(jobs); continue;
          }
          const result = await pageTitle(job.tabId, job.url);
          if (result.blocked) {
            job.state = 'verification'; job.message = '请在文章标签页完成微信验证，之后自动继续'; await store(jobs); continue;
          }
          if (!result.title) { job.message = '正在等待文章标题'; await store(jobs); continue; }
          job.title = result.title; await store(jobs);
        }
        // Existing endpoint. No new schema, token or public API is introduced.
        await websiteRequest(site, '/api/v1/sources/' + job.id + '/capture', 'POST',
          {title: job.title, capture_scope: 'metadata_only', captured_by: 'researchos-browser-clipper-v0.6'});
        detail = await websiteRequest(site, '/api/v1/sources/' + job.id);
        if (detail.source?.provenance?.title !== job.title) throw new Error('标题回读不一致');
        job.state = 'done'; job.message = '标题已保存';
        if (job.createdTab && job.tabId) { await chrome.tabs.remove(job.tabId).catch(() => {}); delete job.tabId; }
        await store(jobs);
      } catch (e) {
        job.message = e.message; job.state = 'pending'; await store(jobs);
        if (e.message.includes('登录')) break;
      }
    }
    await chrome.action.setBadgeText({text: String(jobs.filter(j => j.state !== 'done').length || '')});
  } finally { running = false; }
}
async function collect(value, title = '', tabId) {
  const url = articleURL(value);
  if (!url) throw new Error('请粘贴公众号文章链接');
  const {jobs} = await config();
  const existing = jobs.find(j => j.url === url);
  if (!existing) {
    if (jobs.filter(j => j.state !== 'done').length >= 100) throw new Error('待处理队列已满，请先完成现有任务');
    const kept = jobs.filter(j => j.state !== 'done').concat(jobs.filter(j => j.state === 'done').slice(-20));
    kept.push({url, title: validTitle(title), tabId, state: 'pending'}); await store(kept);
  }
  processJobs().catch(() => {}); return {savedToQueue: true};
}
chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return false;
  const task = msg.type === 'collect' ? collect(msg.url) : msg.type === 'retry' ? processJobs() : Promise.reject(new Error('未知操作'));
  task.then(result => respond({ok: true, ...result}), e => respond({ok: false, error: e.message})); return true;
});
chrome.commands.onCommand.addListener(async name => {
  if (name !== 'collect-active') return;
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  if (tab?.url) await collect(tab.url, '', tab.id).catch(() => {});
});
chrome.alarms.onAlarm.addListener(() => processJobs().catch(() => {}));
chrome.tabs.onUpdated.addListener((id, change) => { if (change.status === 'complete') processJobs().catch(() => {}); });
async function startup() {
  await chrome.alarms.create('title-queue', {periodInMinutes: 1});
  await processJobs();
}
chrome.runtime.onInstalled.addListener(() => startup().catch(() => {}));
chrome.runtime.onStartup.addListener(async () => {
  const {jobs = []} = await chrome.storage.local.get('jobs');
  for (const job of jobs) if (job.state !== 'done') { delete job.tabId; delete job.createdTab; }
  await store(jobs);
  await startup().catch(() => {});
});
