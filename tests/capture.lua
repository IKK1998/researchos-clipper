-- Isolated clipboard-content flow. No actual network, model or OS access.
local requests={}, {}
local answer='取消'
local value=''
hs={
 pasteboard={getContents=function() return value end},
 dialog={blockAlert=function() return answer end},
 alert={show=function() end},
 json={encode=function(v) return v end,decode=function(v) return v end},
 timer={doAfter=function() return {stop=function() end} end},
 http={doAsyncRequest=function(url,method,body,headers,callback,redirect)
  assert(method=='POST' and redirect==false)
  table.insert(requests,{url=url,body=body,callback=callback})
 end}
}
local app=dofile('ResearchClipper.spoon/init.lua')
local id='12345678-1234-1234-1234-123456789abc'
local function target() app.lastSource={id=id,url='https://mp.weixin.qq.com/s/example',title='',at=os.time()} end
value='文章标题\n' .. string.rep('正文选段。',30)
app:submit();assert(#requests==0) -- no known target
target();app:submit();assert(#requests==0 and not app.busy) -- cancelled
answer='保存正文';app.aiConsent=true
app:submit();assert(#requests==1 and app.busy)
assert(requests[1].body.title=='文章标题' and requests[1].body.capture_scope=='selected_excerpts')
assert(requests[1].body.body_text==value)
requests[1].callback(200,{source_id=id,document_id='doc'})
assert(#requests==2 and app.busy and app.lastSource==nil)
assert(requests[2].body.ai_consent==true and requests[2].url:match('/summarize$'))
requests[2].callback(200,{task_id='task'});assert(not app.busy)
app:submit();assert(#requests==2) -- no automatic repeated attachment
target();app:submit();requests[3].callback(500,{})
assert(#requests==3 and not app.busy) -- failed capture never invokes model
target();app.lastSource.at=0;app:submit();assert(#requests==3)
target();app.aiConsent=false;app:submit();requests[4].callback(200,{source_id=id,document_id='doc'})
assert(#requests==4 and not app.busy) -- consent off means no inference
print('PASS: explicit target, cancel, text/title capture, consent, queued-not-completed, failed capture, expiry, no automatic replay')
