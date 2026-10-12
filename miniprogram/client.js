const TOKEN = 'researchos-mini-device';
const DRAFTS = 'researchos-mini-drafts';
const STATES = {
  queued: '已接收，等待入库', retry: '连接暂缓，后台会有限重试',
  saved: '已入库，标题已回读', saved_title_pending: '链接已入库，标题待获取',
  failed: '处理未完成，请在网站核对', local_pending: '尚未提交，点击重试',
};
function urlFromText(text) {
  const matches = String(text || '').trim().match(/https?:\/\/[^\s<>"']+/g) || [];
  if (matches.length !== 1 || !/^https?:\/\/mp\.weixin\.qq\.com\/s(?:\/[A-Za-z0-9_-]+(?:[?#][^\s]*)?|\?[^\s]+)$/.test(matches[0])) throw new Error('请提供一个公众号文章链接');
  return matches[0];
}
function createClient(wx,config) {
  function credentials() { const c = wx.getStorageSync(TOKEN); return c && c.expires_at > Date.now() ? c : null; }
  function request(path,method,data,auth) {
    if (!/^https:\/\/[^/?#]+$/.test(config.apiBase || '')) return Promise.reject(new Error('手机收藏服务尚未配置，请先完成部署'));
    const c = credentials();
    if (auth && !c) return Promise.reject(new Error('请先使用一次性配对码连接资料库'));
    return new Promise((resolve,reject) => wx.request({
      url:config.apiBase+path,method,data,timeout:15000,
      header:{'content-type':'application/json',...(auth ? {Authorization:'Bearer '+c.access_token} : {})},
      success(result) {
        if (result.statusCode >= 200 && result.statusCode < 300) resolve(result.data);
        else {
          if (result.statusCode === 403 && auth) wx.removeStorageSync(TOKEN);
          reject(new Error(result.statusCode === 403 ? '配对失效或请求被拒绝，请检查配置' : '提交未完成，请稍后重试'));
        }
      },
      fail() { reject(new Error('网络不可用；未提交的链接保留在本机，可稍后重试')); },
    }));
  }
  return {
    paired: () => Boolean(credentials()),
    async pair(code) {
      const cleaned = String(code || '').trim();
      if (!/^[a-f0-9]{32}$/.test(cleaned)) throw new Error('请输入完整的一次性配对码');
      const result = await request('/v1/pair','POST',{code:cleaned},false);
      if (!/^[a-f0-9]{64}$/.test(result.access_token || '') || !Number.isFinite(result.expires_at)) throw new Error('服务返回无效配对结果');
      wx.setStorageSync(TOKEN,result);
    },
    drafts: () => wx.getStorageSync(DRAFTS) || [],
    async collect(value) {
      const url = urlFromText(value);
      if (!credentials()) throw new Error('请先配对资料库');
      let drafts = wx.getStorageSync(DRAFTS) || [];
      if (!drafts.some((d) => d.url === url)) {
        if (drafts.length >= 20) throw new Error('本机待提交链接已满，请先重试已有链接');
        drafts.push({url,state:'local_pending',created_at:Date.now()}); wx.setStorageSync(DRAFTS,drafts);
      }
      const result = await request('/v1/collect','POST',{url},true);
      if (result.accepted !== true || !result.job?.id) throw new Error('未取得提交凭据，不能视为已保存');
      drafts = (wx.getStorageSync(DRAFTS) || []).filter((d) => d.url !== url); wx.setStorageSync(DRAFTS,drafts);
      return result.job;
    },
    async recent() { const data = await request('/v1/recent','GET',undefined,true); return data.items || []; },
    logout() { wx.removeStorageSync(TOKEN); },
  };
}
module.exports = {createClient,urlFromText,STATES};
