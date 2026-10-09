import {websiteOrigin} from './core.js';
const site = document.getElementById('site'), status = document.getElementById('status');
chrome.storage.local.get('site').then(s => { if (s.site) site.value = s.site; });
document.getElementById('save').onclick = async () => {
  try {
    const origin = websiteOrigin(site.value);
    const granted = await chrome.permissions.request({origins: [origin + '/*']});
    if (!granted) throw new Error('未取得这个网站的扩展权限');
    await chrome.storage.local.set({site: origin}); status.textContent = '已保存，请在这个网站登录';
  } catch (e) { status.textContent = e.message; }
};
