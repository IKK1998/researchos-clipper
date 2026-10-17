local items, queued={},{}
local timers={}
hs={json={decode=function() return {items=items} end},
 timer={doAfter=function(_,fn) return {stop=function() end} end},
 http={doAsyncRequest=function(url,method,body,headers,cb)
   assert(method=='GET' and url:find('limit=50',1,true)); cb(200,'fixture')
 end}}
local T=dofile('ResearchClipper.spoon/titles.lua')
local owner={baseURL='http://127.0.0.1:3010',syncLibraryTitles=false}
local q=T.new(owner)
q.add=function(self,id,url,title) queued[#queued+1]=id; self.jobs[#self.jobs+1]={id=id,url=url,state='verification'} end
local id='12345678-1234-1234-1234-123456789abc'
items={{source_id=id,record_type='source',source_kind='wechat',title='https://mp.weixin.qq.com/s/test',original_value='https://mp.weixin.qq.com/s/test'}}
q:syncLibrary();assert(#queued==0)
owner.syncLibraryTitles=true;q:syncLibrary();assert(#queued==1)
q:syncLibrary();assert(#queued==1 and q.jobs[1].state=='verification')
items={{source_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',record_type='source',source_kind='wechat',title='真实标题',original_value='https://mp.weixin.qq.com/s/other'},
 {source_id='invalid',record_type='source',source_kind='wechat',title='',original_value='https://mp.weixin.qq.com/s/other'},
 {source_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',record_type='source',source_kind='wechat',title='',original_value='https://evil.example/'}}
q:syncLibrary();assert(#queued==1)
q:stop();q:syncLibrary();assert(#queued==1)
print('PASS: opt-in recent-library title bridge, dedup, preserve verification, title and URL guards')
