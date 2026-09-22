-- No macOS, clipboard or network access: exercise the real Spoon with mocked hs APIs.
local reads,posts=0,0
local text='https://mp.weixin.qq.com/s/Example123'
local callback,timeout,hotkey,lastAlert,requestPayload
local receipt={saved=true,source_id='12345678-1234-1234-1234-123456789abc'}
hs={
 pasteboard={getContents=function() reads=reads+1;return text end},
 alert={show=function(s) lastAlert=s end},
 json={encode=function(v) requestPayload=v;return '{}' end,decode=function() return receipt end},
 timer={doAfter=function(_,fn) timeout=fn;return {stop=function() end} end},
 http={doAsyncRequest=function(url,method,body,headers,fn,redirect)
   posts=posts+1;assert(method=='POST');assert(url=='http://127.0.0.1:3010/api/v1/intake')
   assert(headers.Origin=='http://127.0.0.1:3010');assert(redirect==false);callback=fn
 end},
 hotkey={assignable=function() return true end,bind=function(mods,key,fn)
   assert(key=='S' and #mods==3);hotkey=fn;return {delete=function() hotkey=nil end}
 end},
 menubar={new=function() return {setTitle=function() end,setMenu=function() end,delete=function() end} end}
}
local app=dofile('ResearchClipper.spoon/init.lua'):start()
assert(reads==0 and posts==0) -- startup does not inspect clipboard
hotkey();assert(reads==1 and posts==1 and requestPayload.ai_consent==false)
hotkey();assert(reads==1 and posts==1) -- no parallel replays
timeout();assert(app.busy and lastAlert:find('30'))
callback(200,'{}');assert(not app.busy and lastAlert:find('延迟响应'))
text='private non-URL clipboard text';hotkey();assert(posts==1)
text='https://mp.weixin.qq.com/s/Example123';hotkey();callback(403,'{}')
assert(lastAlert:find('拒绝') and posts==2)
app:stop();assert(hotkey==nil)
print('PASS: client startup, key binding, clipboard gating, busy guard, timeout, delayed receipt, invalid input, denial, stop')
