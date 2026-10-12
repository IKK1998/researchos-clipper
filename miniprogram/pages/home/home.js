const config = require('../../config');
const {createClient,STATES} = require('../../client');
const client = createClient(wx,config);
Page({
  data:{paired:false,busy:false,code:'',url:'',items:[],drafts:[],message:'',site:config.siteBase},
  onShow() { this.setData({paired:client.paired(),drafts:client.drafts()}); if (client.paired()) this.refresh(); },
  inputCode(e) { this.setData({code:e.detail.value}); },
  inputUrl(e) { this.setData({url:e.detail.value}); },
  async pair() {
    if (this.data.busy) return; this.setData({busy:true,message:''});
    try { await client.pair(this.data.code); this.setData({paired:true,code:'',message:'已连接你的资料库'}); await this.refresh(); }
    catch (e) { this.setData({message:e.message}); } finally { this.setData({busy:false}); }
  },
  paste() {
    // Read the current clipboard ONLY after this explicit user gesture.
    const read = () => wx.getClipboardData({success:(result) => this.setData({url:result.data || '',message:''}),
      fail:() => this.setData({message:'未获剪贴板读取许可，可手动粘贴链接'})});
    if (wx.requirePrivacyAuthorize) wx.requirePrivacyAuthorize({success:read,
      fail:() => this.setData({message:'未获隐私授权，可手动粘贴链接'})});
    else read();
  },
  async save(e) {
    if (this.data.busy) return; this.setData({busy:true,message:''});
    try {
      const value = e?.currentTarget?.dataset?.url || this.data.url;
      const job = await client.collect(value);
      this.setData({url:'',message:STATES[job.state] || '已提交，等待回读'}); await this.refresh();
    } catch (error) { this.setData({paired:client.paired(),message:error.message}); }
    finally { this.setData({busy:false,drafts:client.drafts()}); }
  },
  async refresh() {
    try { const items = await client.recent(); this.setData({items:items.map((j) => ({...j,label:STATES[j.state] || '状态待核对'}))}); }
    catch (e) { this.setData({paired:client.paired(),message:e.message}); }
  },
  copyArticle(e) { wx.setClipboardData({data:e.currentTarget.dataset.url}); },
  copyWebsite() { wx.setClipboardData({data:config.siteBase,success:()=>wx.showToast({title:'网站地址已复制',icon:'none'})}); },
  disconnect() { client.logout(); this.setData({paired:false,items:[],code:'',message:'本机已退出；服务端撤销设备需管理员处理'}); },
});
