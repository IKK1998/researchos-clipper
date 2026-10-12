import {inputFromHash,articleFromText,collect,authorizedAutoInput} from './collect-core.mjs';
const input = document.querySelector('#article'), form = document.querySelector('form');
const button = document.querySelector('#save'), message = document.querySelector('#message');
const result = document.querySelector('#result'), title = document.querySelector('#title');
const detail = document.querySelector('#detail'), source = document.querySelector('#source');
const original = document.querySelector('#original');
const draftKey = 'researchos.phone.collect.draft.v1';
const autoKey = 'researchos.phone.collect.auto.v1';
const incomingHash = location.hash;
let autoInput = '';
let busy = false;
function stash(value) {try {value ? sessionStorage.setItem(draftKey,value) : sessionStorage.removeItem(draftKey);} catch {}}
function status(text,error = false) {message.textContent = text; message.setAttribute('role',error ? 'alert' : 'status');}
try {
  input.value = inputFromHash(location.hash) || sessionStorage.getItem(draftKey) || '';
  try {autoInput = authorizedAutoInput(incomingHash,localStorage.getItem(autoKey));} catch {}
  if (input.value) stash(input.value);
  // Fragments are not sent to the server; remove them from visible history now.
  history.replaceState(null,'',location.pathname);
} catch (e) {status(e.message,true);}
input.addEventListener('input',() => stash(input.value));
document.querySelector('#paste').addEventListener('click',async () => {
  try {input.value = await navigator.clipboard.readText(); stash(input.value);status('链接已填入，请确认后收藏');}
  catch {status('未获剪贴板读取许可，请长按输入框粘贴',true);}
});
async function save() {
  if (busy) return;
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
}
form.addEventListener('submit',event => {event.preventDefault();void save();});
const setupStatus = document.querySelector('#setup-status');
const code = document.querySelector('#auto-code');
function showSetup() {
  try {code.textContent = localStorage.getItem(autoKey) || '';}
  catch {code.textContent = '';}
  setupStatus.textContent = code.textContent ? '连接码已准备好：复制下方连接码，填入新版快捷指令的安装设置。完成后重新复制文章链接，再运行快捷指令。' : '请按顺序点击开启、复制连接码，再下载新版快捷指令。只需设置一次。';
}
document.querySelector('#enable-auto').addEventListener('click',() => {
  try {
    if (!/^[a-f0-9]{32}$/.test(localStorage.getItem(autoKey) || '')) {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      localStorage.setItem(autoKey,Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join(''));
    }
    showSetup();
  } catch {setupStatus.textContent = '浏览器无法保存设置，请检查 Safari 存储权限。';}
});
document.querySelector('#copy-code').addEventListener('click',async () => {
  try {if (!code.textContent) throw new Error();await navigator.clipboard.writeText(code.textContent);setupStatus.textContent = '已复制，请下载新版快捷指令，在首次设置问题中粘贴此码。';}
  catch {setupStatus.textContent = '请先开启，再长按下面的码复制。';}
});
document.querySelector('#disable-auto').addEventListener('click',() => {
  try {localStorage.removeItem(autoKey);showSetup();} catch {}
});
showSetup();
if (autoInput) {input.value = autoInput;void save();}
else if (new URLSearchParams(incomingHash.replace(/^#/,'')).has('key')) {
  document.querySelector('#setup').open = true;
  status(input.value ? '链接已收到。请完成下面的一次性连接；本次也可直接点确认收藏。' : '快捷指令没有传来文章链接。请更新下方的新版快捷指令、完成连接，再回微信复制文章链接后运行。',true);
}
