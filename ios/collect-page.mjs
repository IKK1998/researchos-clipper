import {inputFromHash,articleFromText,collect} from './collect-core.mjs';
const input = document.querySelector('#article'), form = document.querySelector('form');
const button = document.querySelector('#save'), message = document.querySelector('#message');
const result = document.querySelector('#result'), title = document.querySelector('#title');
const detail = document.querySelector('#detail'), source = document.querySelector('#source');
const original = document.querySelector('#original');
const draftKey = 'researchos.phone.collect.draft.v1';
let busy = false;
function stash(value) {try {value ? sessionStorage.setItem(draftKey,value) : sessionStorage.removeItem(draftKey);} catch {}}
function status(text,error = false) {message.textContent = text; message.setAttribute('role',error ? 'alert' : 'status');}
try {
  input.value = inputFromHash(location.hash) || sessionStorage.getItem(draftKey) || '';
  if (input.value) stash(input.value);
  // Fragments are not sent to the server; remove them from visible history now.
  history.replaceState(null,'',location.pathname);
} catch (e) {status(e.message,true);}
input.addEventListener('input',() => stash(input.value));
document.querySelector('#paste').addEventListener('click',async () => {
  try {input.value = await navigator.clipboard.readText(); stash(input.value);status('链接已填入，请确认后收藏');}
  catch {status('未获剪贴板读取许可，请长按输入框粘贴',true);}
});
form.addEventListener('submit',async (event) => {
  event.preventDefault(); if (busy) return;
  try {articleFromText(input.value);} catch (e) {status(e.message,true);return;}
  busy = true;button.disabled = true;button.textContent = '正在保存';result.hidden = true;
  stash(input.value);status('正在保存并核对入库回执…');
  try {
    const saved = await collect(input.value);
    title.textContent = saved.title || '公众号文章（标题待获取）';
    detail.textContent = saved.verified ? (saved.duplicate ? '资料库已有这篇文章，已核对原记录。' : '已核对来源记录，文章链接已入库。') : '已收到保存回执，但来源回读暂未完成。请到网站核对，不必重复提交。';
    source.href = '/help?source='+saved.id; original.href = saved.url;
    result.hidden = false;input.value = '';stash('');status('链接已保存；正文与标题状态以网站记录为准。');
  } catch (e) {status(e.message,true);}
  finally {busy = false;button.disabled = false;button.textContent = '确认收藏';}
});
