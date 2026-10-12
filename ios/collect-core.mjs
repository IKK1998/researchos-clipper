// No credentials, remote article fetching or model calls in the phone client.
export function articleFromText(value) {
  const text = String(value || '').trim();
  if (text.length > 8192) throw new Error('链接内容过长，请只粘贴文章链接');
  const matches = text.match(/https?:\/\/[^\s<>"']+/g) || [];
  if (matches.length !== 1) throw new Error('请提供一个公众号文章链接');
  const url = new URL(matches[0]);
  if (url.username || url.password || url.port || url.hostname !== 'mp.weixin.qq.com'
      || !/^\/s(?:\/[A-Za-z0-9_-]+)?$/.test(url.pathname)) throw new Error('当前手机入口仅支持公众号文章链接');
  if (url.pathname === '/s' && ['__biz','mid','idx','sn'].some((k) => !url.searchParams.get(k))) throw new Error('公众号长链接不完整，请重新复制');
  url.protocol = 'https:'; url.hash = '';
  return url.href;
}
export function inputFromHash(hash) {
  if (hash.length > 32768) throw new Error('分享内容过长');
  const params = new URLSearchParams(hash.replace(/^#/,''));
  if (params.getAll('url').length > 1) throw new Error('请一次分享一篇文章');
  return params.get('url') || '';
}
// Browser-local intent guard, NOT an API credential or a substitute for login.
export function authorizedAutoInput(hash, localKey) {
  const value = inputFromHash(hash);
  const params = new URLSearchParams(hash.replace(/^#/,''));
  if (params.getAll('key').length !== 1 || !/^[a-f0-9]{32}$/.test(localKey || '')
      || params.get('key') !== localKey || !value) return '';
  return articleFromText(value);
}
export function titleFromSource(source) {
  let p = source.provenance;
  if (typeof p === 'string') {try {p = JSON.parse(p);} catch {p = {};}}
  const title = typeof p?.title === 'string' ? p.title.trim() : '';
  return title && !/^https?:\/\//i.test(title) && !/^(?:微信公众号文章|公众号链接|微信公众平台|标题待获取)$/.test(title) ? title : '';
}
export async function collect(value,fetcher = fetch) {
  const url = articleFromText(value);
  async function request(path,init = {}) {
    let response;
    try {response = await fetcher(path,{...init,credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});}
    catch {throw new Error('网络或登录状态异常；请先登录网站，再手动重试。不要把本次视为已保存。');}
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('未收到有效保存回执，请检查网站登录与连接后重试');
    return response.json();
  }
  const receipt = await request('/api/v1/intake',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({value:url,source_kind:'wechat',fill_missing_title:true,ai_consent:false})});
  if (receipt.saved !== true || !/^[a-f0-9-]{36}$/i.test(receipt.source_id || '')) throw new Error('未取得入库确认，输入已保留；重试时会按链接去重');
  try {
    const detail = await request('/api/v1/sources/'+receipt.source_id);
    if (detail.source?.id !== receipt.source_id || articleFromText(detail.source.original_value) !== url) throw new Error('来源回读不一致');
    return {id:receipt.source_id,url,duplicate:Boolean(receipt.duplicate),verified:true,title:titleFromSource(detail.source)};
  } catch {
    // Receipt is real, but readback is not confirmed. Do not blindly replay POST.
    return {id:receipt.source_id,url,duplicate:Boolean(receipt.duplicate),verified:false,title:''};
  }
}
