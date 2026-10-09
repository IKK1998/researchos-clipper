import {articleURL} from './core.js';
const $ = id => document.getElementById(id);
async function save() {
  const url = articleURL($('url').value);
  if (!url) { $('status').textContent = '请粘贴完整的公众号文章链接'; return; }
  const r = await chrome.runtime.sendMessage({type: 'collect', url});
  $('status').textContent = r.ok ? '已加入自动收藏队列；可关闭这个窗口' : r.error;
  await render();
}
async function render() {
  const {jobs = []} = await chrome.storage.local.get('jobs');
  $('jobs').replaceChildren(...jobs.slice(-5).reverse().map(j => {
    const p = document.createElement('p'); p.textContent = (j.title || '标题获取中') + ' · ' + (j.message || '排队中'); return p;
  }));
}
$('save').onclick = save;
$('url').addEventListener('paste', () => setTimeout(() => { if (articleURL($('url').value)) save(); }, 0));
$('retry').onclick = async () => { await chrome.runtime.sendMessage({type: 'retry'}); await render(); };
chrome.storage.onChanged.addListener(render); render();
