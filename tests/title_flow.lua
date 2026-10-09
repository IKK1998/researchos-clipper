-- Synthetic end-to-end client branches; never access a real clipboard or network.
local url='https://mp.weixin.qq.com/s/title_fixture'
local document=url
local bundle='com.tencent.flue.WeChatAppEx'
local windowTitle='真实标题'
local pbURL,pbTitle=nil,nil
local revision=1
local changed=false
local sent,reply,message
local receipt={saved=true,source_id='12345678-1234-1234-1234-123456789abc',duplicate=true}
hs={
 pasteboard={getContents=function() return url end,changeCount=function() return revision end,
  readDataForUTI=function(uti) if uti=='public.url' then return pbURL else return pbTitle end end},
 application={frontmostApplication=function() return {
  bundleID=function() return bundle end,
  focusedWindow=function() return {title=function() return windowTitle end} end} end},
 axuielement={windowElement=function() return {attributeValue=function()
  if changed then revision=revision+1 end
  return document end} end},
 alert={show=function(value) message=value end},
 json={encode=function(value) sent=value;return '{}' end,decode=function() return receipt end},
 timer={doAfter=function() return {stop=function() end} end},
 http={doAsyncRequest=function(endpoint,method,body,headers,callback,redirect)
  assert(endpoint=='http://127.0.0.1:3010/api/v1/intake' and method=='POST' and redirect==false)
  reply=callback end}
}
local app=dofile('ResearchClipper.spoon/init.lua')
app:submit();assert(sent.title==windowTitle and sent.fill_missing_title)
reply(200,'{}');assert(not message:find('已补全缺失标题')) -- old server: not confirmed
receipt.title_updated=true
app:submit();reply(200,'{}');assert(message:find('已补全缺失标题'))
receipt.title_updated=false
app:submit();reply(200,'{}');assert(not message:find('已补全缺失标题'))
document='https://mp.weixin.qq.com/s/other'
app:submit();assert(sent.title=='' and not sent.fill_missing_title);reply(200,'{}')
pbURL=url;pbTitle='剪贴板标题'
app:submit();assert(sent.title==pbTitle and sent.fill_missing_title);reply(200,'{}')
document=url
app:submit();assert(sent.title=='' and not sent.fill_missing_title);reply(200,'{}') -- conflict
pbTitle=windowTitle;changed=true
app:submit();assert(sent.title=='' and not sent.fill_missing_title);reply(200,'{}') -- clipboard changed
changed=false;pbURL=nil;pbTitle=nil;bundle='com.unrelated.app'
app:submit();assert(sent.title=='' and not sent.fill_missing_title);reply(200,'{}')
assert(not app.busy)
print('PASS: independent reader, old/new receipt, exact URL, clipboard title, conflict, race, unrelated app')
