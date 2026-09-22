local obj = {name='ResearchClipper', version='0.1.0', license='MIT'}
local dir = debug.getinfo(1,'S').source:sub(2):match('(.*/)')
local logic = dofile(dir .. 'logic.lua')
obj.baseURL='http://127.0.0.1:3010'
obj.aiConsent=false
obj.mods={'ctrl','alt','cmd'}
obj.key='S'

function obj:submit()
  if self.busy then hs.alert.show('上一条尚未返回，请稍候'); return end
  local endpoint=logic.endpoint(self.baseURL)
  if not endpoint then hs.alert.show('只允许配置已授权的 127.0.0.1 私有网关'); return end
  -- Read exactly once, only after a user invokes the command. No watcher or history.
  local url=logic.link(hs.pasteboard.getContents())
  if not url then hs.alert.show('请先在微信文章菜单中复制一条 https 公众号链接'); return end
  self.busy=true
  self.status='保存中'
  hs.alert.show('正在提交公众号链接…')
  local payload=hs.json.encode({value=url,source_kind='wechat',ai_consent=self.aiConsent})
  local headers={['Content-Type']='application/json',['Accept']='application/json',
    ['Origin']=self.baseURL,['Cache-Control']='no-store'}
  -- Timeout is an uncertain result, never proof of failure. No automatic replay.
  local expired=false
  local timer=hs.timer.doAfter(30,function()
    expired=true
    self.status='等待服务器确认'
    hs.alert.show('30 秒未收到确认；可能已保存，请先到网站核对。不会自动重试。',6)
  end)
  hs.http.doAsyncRequest(endpoint,'POST',payload,headers,function(code,body)
    timer:stop()
    self.busy=false
    local ok,message=logic.result(code,body,hs.json.decode)
    self.status=ok and '最近一次已保存' or '最近一次未确认'
    hs.alert.show((expired and '延迟响应：' or '') .. message,5)
  end,false) -- Do not follow redirects to login pages or another host.
end

function obj:start()
  if self.hotkey then return self end
  if not logic.endpoint(self.baseURL) then error('Expected loopback private gateway URL') end
  if not hs.hotkey.assignable(self.mods,self.key) then
    hs.alert.show('收藏快捷键冲突，请修改配置'); return self
  end
  self.hotkey=hs.hotkey.bind(self.mods,self.key,function() self:submit() end)
  if not self.hotkey then hs.alert.show('快捷键未启用，请检查辅助功能权限'); return self end
  self.menu=hs.menubar.new()
  if self.menu then
    self.menu:setTitle('收藏')
    self.menu:setMenu(function() return {
      {title='保存已复制的公众号链接  ⌃⌥⌘S',fn=function() self:submit() end},
      {title=self.status or '就绪（仅手动触发）',disabled=true},
      {title='打开资料库',fn=function() hs.urlevent.openURL(self.baseURL .. '/') end},
      {title='自动总结：' .. (self.aiConsent and '开启' or '关闭'),checked=self.aiConsent,
        fn=function()
          if self.aiConsent then self.aiConsent=false;return end
          local answer=hs.dialog.blockAlert('启用自动总结？','新提交文章在正文可用后可交给网站配置的模型处理，可能调用外部付费 API。已有重复资料不会因此重跑。','启用','取消')
          self.aiConsent=answer=='启用'
        end},
    } end)
  end
  return self
end
function obj:stop()
  if self.hotkey then self.hotkey:delete();self.hotkey=nil end
  if self.menu then self.menu:delete();self.menu=nil end
  return self
end
return obj
