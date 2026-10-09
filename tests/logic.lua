local logic=dofile('ResearchClipper.spoon/logic.lua')
local count=0
assert(logic.reader('com.tencent.flue.WeChatAppEx'))
assert(not logic.reader('com.other.app'))
local fixture='https://mp.weixin.qq.com/s/fixture'
assert(logic.clipboardTitle(fixture,fixture,'真实标题',5,5)=='真实标题')
assert(logic.clipboardTitle(fixture,fixture,'真实标题',5,6)=='')
assert(logic.clipboardTitle(fixture,fixture..'other','真实标题',5,5)=='')
assert(logic.chooseTitle('标题甲','标题乙')=='')
assert(logic.chooseTitle('','标题乙')=='标题乙')
assert(logic.title(' 微信 ')=='' and logic.title('https://example.com')=='')
assert(logic.title(' 正常标题 ')=='正常标题')
assert(logic.title(string.rep('x',1001))=='')
assert(logic.articleTitle('https://mp.weixin.qq.com/s/a','https://mp.weixin.qq.com/s/b','不对应标题')=='')
assert(logic.articleTitle('https://mp.weixin.qq.com/s/a','https://mp.weixin.qq.com/s/a','文章标题')=='文章标题')
local function check(value) assert(value);count=count+1 end
check(logic.link(' https://mp.weixin.qq.com/s/Example_123-abc#read ')=='https://mp.weixin.qq.com/s/Example_123-abc')
check(logic.link('https://mp.weixin.qq.com/s?__biz=example&mid=123')~=nil)
for _,v in ipairs({'','hello','http://mp.weixin.qq.com/s/a','https://evil.invalid/s/a',
 'https://mp.weixin.qq.com.evil.invalid/s/a','https://mp.weixin.qq.com@evil.invalid/s/a',
 'https://mp.weixin.qq.com/s/a\nhttps://mp.weixin.qq.com/s/b','https://mp.weixin.qq.com/',
 'https://mp.weixin.qq.com/s/a"bad',string.rep('a',4097)}) do check(logic.link(v)==nil) end
check(logic.endpoint('http://127.0.0.1:3010')=='http://127.0.0.1:3010/api/v1/intake')
for _,v in ipairs({'https://example.com','http://localhost:3010','http://127.0.0.1:0','http://127.0.0.1:65536','http://127.0.0.1:3010@evil.invalid'}) do check(logic.endpoint(v)==nil) end
local function good() return {saved=true,source_id='12345678-1234-1234-1234-123456789abc'} end
check(logic.result(200,'{}',good)==true)
for _,status in ipairs({-1,301,401,403,429,500}) do check(logic.result(status,'{}',good)==false) end
check(logic.result(200,'HTML',function() error('bad') end)==false)
check(logic.result(200,'{}',function() return {} end)==false)
check(logic.result(200,'{}',function() return {saved=true,source_id=''} end)==false)
check(logic.result(200,string.rep('a',65537),good)==false)
print('PASS: '..count..' logic assertions')
