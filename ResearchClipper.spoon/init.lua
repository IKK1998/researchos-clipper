local obj = {name='ResearchClipper', version='0.6.0', license='MIT'}
local dir = debug.getinfo(1,'S').source:sub(2):match('(.*/)')
local logic = dofile(dir .. 'logic.lua')
obj.baseURL='http://127.0.0.1:3010'
obj.aiConsent=false
obj.mods={'ctrl','alt','cmd'}
obj.key='S'
obj.autoTitle=true

-- Text is supplied by the owner through an explicit clipboard action. Never
-- monitor the clipboard or silently attach it to an old collection.
function obj:attachText(text)
  if not self.lastSource or os.time()-self.lastSource.at>1800 then
    hs.alert.show('请先复制这篇文章的链接并按收藏快捷键，再复制正文。',6);return
  end
  local count=utf8.len(text or '')
  if not count or count<80 or count>100000 then
    hs.alert.show('正文需为80至100000字的文本；请勿提交聊天、密码或敏感资料。',6);return
  end
  self.busy=true
  local source=self.lastSource
  local candidate=logic.title(text:match('([^\r\n]+)'))
  if utf8.len(candidate)>120 then candidate='' end
  local answer=hs.dialog.blockAlert('把复制的正文补入这篇收藏？',
    source.url .. '\n\n正文预览：' .. text:sub(1,utf8.offset(text,math.min(count,90)+1) and utf8.offset(text,math.min(count,90)+1)-1 or #text)
    .. (source.title=='' and candidate~='' and '\n首行将用作收藏标题：' .. candidate or '')
    .. '\n\n请确认内容对应上面的链接。仅提交你有权处理的文章内容，不含聊天、患者信息或受控数据。'
    .. (self.aiConsent and '\n保存后交给已配置的 Kimi 整理，必要文字会发送至外部模型服务。' or '\n本次只保存正文，不调用模型。'),
    '保存正文','取消')
  if answer~='保存正文' then self.busy=false;return end
  local endpoint=self.baseURL .. '/api/v1/sources/' .. source.id
  local headers={['Content-Type']='application/json',['Accept']='application/json',['Origin']=self.baseURL}
  -- Only use a short standalone first line, not an arbitrary opening paragraph.
  local payload={body_text=text,capture_scope='selected_excerpts',captured_by='owner-clipboard-clipper-v0.4'}
  if source.title=='' and candidate~='' then payload.title=candidate end
  local timer=hs.timer.doAfter(30,function()
    hs.alert.show('正文保存尚未确认，请到网站核对；不会自动重试。',6)
  end)
  hs.http.doAsyncRequest(endpoint .. '/capture','POST',hs.json.encode(payload),headers,function(code,body)
    timer:stop();self.busy=false
    local decoded,data=pcall(hs.json.decode,body)
    if code<200 or code>=300 or not decoded or type(data)~='table' or data.source_id~=source.id or not data.document_id then
      hs.alert.show('正文保存未确认，保留复制内容并到网站核对；不会调用模型。',6);return
    end
    self.status='正文已保存'
    -- Consume the target to prevent accidental repeated capture/model calls.
    self.lastSource=nil
    if not self.aiConsent then hs.alert.show('正文已保存，可在网站阅读和检索。',6);return end
    self.busy=true
    hs.http.doAsyncRequest(endpoint .. '/summarize','POST',hs.json.encode({ai_consent=true}),headers,function(status,response)
      self.busy=false
      local parsed,result=pcall(hs.json.decode,response)
      if status>=200 and status<300 and parsed and type(result)=='table' and result.task_id then
        self.status='正文已保存，摘要已排队'
        hs.alert.show('正文已保存，Kimi 整理任务已提交；完成结果请在网站查看。',6)
      else
        hs.alert.show('正文已保存，但模型任务未确认；请在网站查看，不会自动重复调用。',6)
      end
    end,false)
  end,false)
end

function obj:submit()
  if self.busy then hs.alert.show('上一条尚未返回，请稍候'); return end
  local endpoint=logic.endpoint(self.baseURL)
  if not endpoint then hs.alert.show('只允许配置已授权的 127.0.0.1 私有网关'); return end
  -- Read exactly once, only after a user invokes the command. No watcher or history.
  local before=hs.pasteboard.changeCount and hs.pasteboard.changeCount()
  local copied=hs.pasteboard.getContents()
  local url=logic.link(copied)
  if not url then self:attachText(copied);return end
  self.busy=true
  -- Match the foreground document URL before trusting its title. No tree scan,
  -- chat inspection, cookies, background monitoring or manual title prompt.
  local title=''
  local clipboardTitle=''
  if hs.pasteboard.readDataForUTI and before then
    local ok,itemURL,itemTitle=pcall(function()
      return hs.pasteboard.readDataForUTI('public.url'),hs.pasteboard.readDataForUTI('public.url-name')
    end)
    if ok then clipboardTitle=logic.clipboardTitle(url,itemURL,itemTitle,before,hs.pasteboard.changeCount()) end
  end
  local front=hs.application and hs.application.frontmostApplication()
  if front and logic.reader(front:bundleID()) then
    local window=front:focusedWindow()
    if window and hs.axuielement then
      local ok,document=pcall(function()
        return hs.axuielement.windowElement(window):attributeValue('AXDocument')
      end)
      if ok then title=logic.articleTitle(url,document,window:title()) end
    end
  end
  title=logic.chooseTitle(title,clipboardTitle)
  -- A clipboard change during AX lookup invalidates metadata collected for it.
  if before and hs.pasteboard.changeCount()~=before then title='' end
  if self.titleQueue then
    self.busy=false;self.titleQueue:collect(url,title);return
  end
  self.status='保存中'
  hs.alert.show('正在提交公众号链接…')
  local payload=hs.json.encode({value=url,title=title,fill_missing_title=title~='',source_kind='wechat',ai_consent=self.aiConsent})
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
    if ok then
      local _,data=pcall(hs.json.decode,body)
      self.lastSource={id=data.source_id,url=url,title=title,at=os.time()}
      if self.titleQueue then self.titleQueue:add(data.source_id,url,title) end
    end
    -- Duplicate intake preserves existing metadata. Offer the exact saved record
    -- instead of claiming the new title was written or overwriting a known title.
    if ok and title~='' then
      local decoded,data=pcall(hs.json.decode,body)
      if decoded and data.duplicate then
        message=message .. (data.title_updated==true and '；已补全缺失标题。' or '；已有标题保持不变，缺失标题是否补全请在网站核对。')
      end
    end
    self.status=ok and '最近一次已保存' or '最近一次未确认'
    if ok and title=='' then message=message .. '；正在自动获取文章标题。' end
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
  if self.autoTitle and hs.timer.doEvery and hs.osascript then
    self.titleQueue=dofile(dir .. 'titles.lua').new(self)
    self.titleQueue:start()
  end
  if hs.urlevent and hs.urlevent.bind then
    hs.urlevent.bind('researchos-collect',function(_,params)
      local url=logic.link(params.url)
      if url and self.titleQueue then self.titleQueue:collect(url,'') end
    end)
  end
  if hs.settings and hs.autoLaunch then
    hs.settings.set('ResearchClipper.runtime',{version=self.version,launchAtLogin=hs.autoLaunch(),
      shortcut=table.concat(self.mods,'+') .. '+' .. self.key})
  end
  self.menu=hs.menubar.new()
  if self.menu then
    self.menu:setTitle('收藏')
    self.menu:setMenu(function() return {
      {title='保存链接或补充已复制的正文',fn=function() self:submit() end},
      {title='打开最近收藏',disabled=not self.lastSource,fn=function()
        if self.lastSource then hs.urlevent.openURL('https://researchos.cacdb.org/topics?source=' .. self.lastSource.id) end
      end},
      {title=self.status or '就绪（仅手动触发）',disabled=true},
      {title='继续获取标题',fn=function() if self.titleQueue then self.titleQueue:retry() end end},
      {title='查看待验证文章',fn=function() if self.titleQueue then self.titleQueue:showPending() end end},
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
  if self.titleQueue then self.titleQueue:stop();self.titleQueue=nil end
  if self.hotkey then self.hotkey:delete();self.hotkey=nil end
  if self.menu then self.menu:delete();self.menu=nil end
  return self
end
return obj
