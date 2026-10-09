-- Real queue orchestration with isolated browser/server adapters.
local url='https://mp.weixin.qq.com/s/fixture'
local id='12345678-1234-1234-1234-123456789abc'
local stored,online,serverTitle,captures,windows={},false,'',0,0
local timers={}
local payloads={}
local function encode(value) table.insert(payloads,value);return tostring(#payloads) end
local function decode(value) return payloads[tonumber(value)] end
hs={
 settings={get=function() return stored end,set=function(_,v) stored=v end},
 json={encode=encode,decode=decode},
 alert={show=function() end},
 timer={doAfter=function(_,fn) table.insert(timers,fn);return {stop=function() end} end,
  doEvery=function() return {stop=function() end} end},
 osascript={applescript=function(script)
   if script:find('make new window') then windows=windows+1;return true,123 end
   if script:find('close window') then return true end
   return true,{url,'真实文章标题'}
 end},
 http={doAsyncRequest=function(endpoint,method,body,headers,callback)
   if not online then callback(503,encode({}));return end
   if endpoint:match('/intake$') then callback(200,encode({saved=true,source_id=id,duplicate=true}));return end
   if endpoint:match('/capture$') then
     body=decode(body)
     assert(body.capture_scope=='metadata_only' and not body.body_text)
     captures=captures+1;serverTitle=body.title
     callback(200,encode({source_id=id,captured={title=body.title}}));return
   end
   callback(200,encode({source={id=id,original_value=url,provenance={title=serverTitle}}}))
 end}
}
local T=dofile('ResearchClipper.spoon/titles.lua')
local owner={baseURL='http://127.0.0.1:3010',aiConsent=false}
local queue=T.new(owner);queue:start();queue:collect(url,'')
assert(stored[1].state=='pending' and not stored[1].id) -- offline persisted before intake
queue:stop()
online=true
queue=T.new(owner);queue:start();queue:next()
queue:poll(stored[1],0)
assert(stored[1].state=='done' and serverTitle=='真实文章标题' and captures==1)
queue:collect(url,'');assert(captures==1) -- repeated collection does not replay
queue:stop()
stored={};serverTitle='原来的人工标题'
queue=T.new(owner);queue:start();queue:collect(url,'')
assert(stored[1].state=='done' and captures==1 and windows==1)
print('PASS: offline queue persistence, restart, duplicate title repair, metadata-only capture, readback, existing-title preservation')
