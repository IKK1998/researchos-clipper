-- Browser-assisted title queue. Only URLs explicitly collected by the owner.
local T = {}
local dir = debug.getinfo(1,'S').source:sub(2):match('(.*/)')
local logic = dofile(dir .. 'logic.lua')
local KEY = 'ResearchClipper.titleQueue.v1'
local function quote(s) return '"' .. s:gsub('\\','\\\\'):gsub('"','\\"') .. '"' end

function T.new(owner)
  local self = {owner=owner, jobs={}, active=false}
  function self:persist()
    if hs.settings then hs.settings.set(KEY,self.jobs) end
  end
  function self:finish(job,state,message)
    local previous=job.message
    job.state=state;job.message=message;self.active=false;self:persist()
    self.owner.status=message
    if state=='done' then
      if self.owner.lastSource and self.owner.lastSource.id==job.id then self.owner.lastSource.title=job.title end
      hs.alert.show(message,5)
      hs.timer.doAfter(1,function() self:next() end)
    elseif (state=='verification' or state=='permission') and previous~=message then hs.alert.show(message,7) end
  end
  function self:request(job,path,method,data,callback)
    local headers={['Accept']='application/json',['Content-Type']='application/json',
      ['Origin']=self.owner.baseURL,['Cache-Control']='no-store'}
    local complete=false
    local timeout=hs.timer.doAfter(30,function()
      if complete then return end
      complete=true;self:finish(job,'pending','标题等待网站连接恢复')
    end)
    hs.http.doAsyncRequest(self.owner.baseURL .. '/api/v1/sources/' .. job.id .. path,
      method,data and hs.json.encode(data) or '',headers,function(code,body)
        if complete or self.stopped then return end
        complete=true;timeout:stop()
        local ok,value=pcall(hs.json.decode,body)
        if code<200 or code>=300 or not ok or type(value)~='table' then
          self:finish(job,'pending','标题等待网站连接恢复');return
        end
        callback(value)
      end,false)
  end
  function self:readSource(job,callback)
    self:request(job,'','GET',nil,function(data)
      local source=data.source or data
      if tostring(source.id)~=job.id or logic.link(source.original_value)~=job.url then
        self:finish(job,'verification','标题未写入：资料链接不匹配');return
      end
      local provenance=source.provenance or {}
      if type(provenance)=='string' then
        local ok,value=pcall(hs.json.decode,provenance);provenance=ok and value or {}
      end
      callback(logic.title(provenance.title))
    end)
  end
  function self:closeWindow(job)
    if job.window then
      hs.osascript.applescript('tell application "Google Chrome"\ntry\nclose window id ' .. job.window .. '\nend try\nend tell')
      job.window=nil
    end
  end
  function self:write(job,title)
    -- Read again immediately before updating; never deliberately replace an existing title.
    self:readSource(job,function(existing)
      if existing~='' then job.title=existing;self:closeWindow(job);self:finish(job,'done','文章标题已保存：' .. existing);return end
      self:request(job,'/capture','POST',{title=title,capture_scope='metadata_only',
        captured_by='researchos-clipper-chrome-exact-url-v0.6'},function(receipt)
        if receipt.source_id~=job.id or (receipt.captured or {}).title~=title then
          self:finish(job,'pending','标题写入尚未确认');return
        end
        self:readSource(job,function(saved)
          if saved~=title then self:finish(job,'verification','标题回读不一致，请查看资料');return end
          job.title=saved;self:closeWindow(job);self:finish(job,'done','已自动保存标题：' .. saved)
        end)
      end)
    end)
  end
  function self:poll(job,attempt)
    if self.stopped or job.state=='done' or not job.window then return end
    local script='tell application "Google Chrome"\ntry\nset t to active tab of window id ' .. job.window
      .. '\nreturn {URL of t, title of t}\non error\nreturn {"", ""}\nend try\nend tell'
    local ok,result=hs.osascript.applescript(script)
    if ok and type(result)=='table' and logic.link(result[1])==job.url then
      local title=logic.title(result[2])
      if title~='' and title~=job.url then self:write(job,title);return end
    elseif ok and type(result)=='table' and result[1] and result[1]~='' and result[1]~='about:blank' then
      self:finish(job,'verification','请在“收藏 → 查看待验证文章”完成微信验证，之后自动继续');return
    end
    if attempt>=30 then
      self:finish(job,'verification','标题暂未取得；可在专用窗口打开文章后继续获取');return
    end
    self.pollTimer=hs.timer.doAfter(2,function() self:poll(job,attempt+1) end)
  end
  function self:run(job)
    self.active=true;job.state='running';self:persist()
    if not job.id then
      local complete=false
      local timeout=hs.timer.doAfter(30,function()
        if complete then return end
        complete=true;self:finish(job,'pending','链接已留在待提交队列，连接恢复后自动继续')
      end)
      hs.http.doAsyncRequest(logic.endpoint(self.owner.baseURL),'POST',
        hs.json.encode({value=job.url,title=job.title or '',source_kind='wechat',ai_consent=job.aiConsent==true}),
        {['Content-Type']='application/json',['Origin']=self.owner.baseURL,['Accept']='application/json'},function(code,body)
          if complete or self.stopped then return end
          complete=true;timeout:stop()
          local ok=logic.result(code,body,hs.json.decode)
          if not ok then self:finish(job,'pending','链接等待网站连接恢复');return end
          local data=hs.json.decode(body);job.id=data.source_id;self:persist()
          self.owner.lastSource={id=job.id,url=job.url,title=job.title or '',at=os.time()}
          self:run(job)
        end,false)
      return
    end
    self:readSource(job,function(existing)
      if existing~='' then job.title=existing;self:finish(job,'done','文章标题已保存：' .. existing);return end
      if job.title and job.title~='' then self:write(job,job.title);return end
      if not hs.osascript then self:finish(job,'verification','需要 Chrome 浏览器及自动化权限');return end
      if job.window then self:poll(job,0);return end
      -- A separate window lets us address exactly one owner-selected article.
      local script='tell application "Google Chrome"\nset w to make new window\nset URL of active tab of w to '
        .. quote(job.url) .. '\nset minimized of w to true\nreturn id of w\nend tell'
      local ok,id,descriptor=hs.osascript.applescript(script)
      id=tonumber(id)
      if not ok or type(id)~='number' then
        job.browserError=type(descriptor)=='table' and (descriptor.NSAppleScriptErrorNumber or descriptor.NSAppleScriptErrorMessage)
          or (tostring(ok) .. ':' .. tostring(descriptor):sub(1,300))
        self:finish(job,'permission','请允许 Hammerspoon 控制 Chrome，授权后自动继续获取标题');return
      end
      job.browserError=nil
      job.window=id;self:persist();self:poll(job,0)
    end)
  end
  function self:next()
    if self.active or self.stopped then return end
    for _,job in ipairs(self.jobs) do
      if job.state=='pending' or job.state=='permission' then self:run(job);return end
    end
    for _,job in ipairs(self.jobs) do
      if job.state=='verification' and job.window then self.active=true;self:poll(job,30);return end
    end
  end
  function self:add(id,url,title)
    if not logic.link(url) then return end
    for _,job in ipairs(self.jobs) do
      if job.id==id then
        if job.state~='done' then job.state='pending';job.title=title~='' and title or job.title;self:persist();self:next() end
        return
      end
    end
    -- Persist only a small queue; completed metadata are held in ResearchOS.
    while #self.jobs>=100 do
      local removed=false
      for i,job in ipairs(self.jobs) do if job.state=='done' then table.remove(self.jobs,i);removed=true;break end end
      if not removed then hs.alert.show('待处理标题达到100条，请先完成现有队列');return end
    end
    table.insert(self.jobs,{id=id,url=url,title=title,state='pending'})
    self:persist();self:next()
  end
  function self:collect(url,title)
    for _,job in ipairs(self.jobs) do
      if job.url==url then
        if job.state~='done' then job.state='pending';self:persist();self:next() end
        hs.alert.show(job.state=='done' and '这篇文章及标题已经收藏' or '这篇文章已在自动处理队列');return
      end
    end
    if #self.jobs>=100 then
      for i=#self.jobs,1,-1 do if self.jobs[i].state=='done' then table.remove(self.jobs,i) end end
    end
    if #self.jobs>=100 then hs.alert.show('待处理标题达到100条，请先完成现有队列');return end
    table.insert(self.jobs,{url=url,title=title,aiConsent=self.owner.aiConsent,state='pending'})
    self:persist();hs.alert.show('已加入收藏队列，自动获取标题');self:next()
  end
  function self:retry()
    for _,job in ipairs(self.jobs) do if job.state=='verification' or job.state=='permission' then job.state='pending' end end
    self:persist();self:next()
  end
  function self:showPending()
    for _,job in ipairs(self.jobs) do
      if job.state=='verification' and job.window then
        hs.osascript.applescript('tell application "Google Chrome"\ntry\nset minimized of window id '
          .. job.window .. ' to false\nset index of window id ' .. job.window .. ' to 1\nactivate\nend try\nend tell')
        return
      end
    end
    hs.alert.show('目前没有需要验证的文章页面')
  end
  function self:start()
    self.jobs=(hs.settings and hs.settings.get(KEY)) or {}
    for _,job in ipairs(self.jobs) do
      if job.state=='running' or job.state=='verification' then job.state='pending' end
      -- Window IDs are not meaningful after a browser restart.
      job.window=nil
    end
    self:persist()
    self.tick=hs.timer.doEvery(60,function() self:next() end)
    self.boot=hs.timer.doAfter(3,function() self:next() end)
  end
  function self:stop()
    self.stopped=true
    for _,timer in ipairs({self.tick,self.boot,self.pollTimer}) do if timer then timer:stop() end end
    self:persist()
  end
  return self
end
return T
