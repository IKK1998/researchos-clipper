import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {articleFromText,inputFromHash,collect,titleFromSource,authorizedAutoInput} from '../ios/collect-core.mjs';
import {workflow} from '../ios/build-shortcut.mjs';
const url = 'https://mp.weixin.qq.com/s/example_Article';
const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
test('iPhone URLs, encoded fragments, long-link preservation and unsafe input',() => {
  assert.equal(articleFromText('文章 '+url),url);
  assert.equal(inputFromHash('#url='+encodeURIComponent(url)),url);
  assert.equal(articleFromText('http://mp.weixin.qq.com/s/example_Article#ignore'),url);
  const long = 'https://mp.weixin.qq.com/s?__biz=a%2Bb&mid=1&idx=1&sn=abc';
  assert.equal(articleFromText(inputFromHash('#url='+encodeURIComponent(long))),long);
  for (const bad of ['http://127.0.0.1/secret','https://mp.weixin.qq.com.evil/s/x','https://u:p@mp.weixin.qq.com/s/x',url+' '+url,'https://mp.weixin.qq.com/s?mid=1']) assert.throws(()=>articleFromText(bad));
  assert.throws(()=>inputFromHash('#url=a&url=b'));
});
test('explicit collection uses same-origin, AI=false and checks matching source/title',async () => {
  let posts = 0;
  const result = await collect(url,async (path,init) => {
    assert.equal(init.credentials,'same-origin');assert.equal(init.redirect,'error');
    assert.ok(!init.headers?.Authorization);
    if (init.method === 'POST') {posts++;assert.equal(path,'/api/v1/intake');assert.equal(JSON.parse(init.body).ai_consent,false);return Response.json({saved:true,source_id:id,duplicate:true});}
    return Response.json({source:{id,original_value:url,provenance:{title:'真实文章标题'}}});
  });
  assert.equal(posts,1);assert.equal(result.title,'真实文章标题');assert.equal(result.duplicate,true);assert.equal(result.verified,true);
});
test('offline, login HTML and invalid receipts cannot falsely report saved',async () => {
  await assert.rejects(collect(url,async () => {throw new Error('offline');}));
  await assert.rejects(collect(url,async () => new Response('<html>login</html>',{headers:{'Content-Type':'text/html'}})));
  await assert.rejects(collect(url,async () => Response.json({source_id:id})));
});
test('confirmed receipt with failed/mismatched readback is explicit and does not replay POST',async () => {
  let posts = 0;
  const result = await collect(url,async (_path,init) => {
    if (init.method === 'POST') {posts++;return Response.json({saved:true,source_id:id});}
    return Response.json({source:{id,original_value:'https://mp.weixin.qq.com/s/wrong'}});
  });
  assert.equal(posts,1);assert.equal(result.verified,false);assert.equal(result.title,'');
  assert.equal(titleFromSource({provenance:{title:url}}),'');
});
test('shortcut explicitly reads clipboard and binds URL extraction to that output',() => {
  const w = workflow();
  const actions = w.WFWorkflowActions.map(a=>a.WFWorkflowActionIdentifier);
  assert.deepEqual(actions,['is.workflow.actions.getclipboard','is.workflow.actions.gettext','is.workflow.actions.detect.link','is.workflow.actions.urlencode','is.workflow.actions.gettext','is.workflow.actions.openurl']);
  assert.equal(w.WFWorkflowImportQuestions[0].ActionIndex,1);
  assert.equal(w.WFWorkflowImportQuestions[0].ParameterKey,'WFTextActionText');
  assert.equal(w.WFWorkflowActions[2].WFWorkflowActionParameters.WFInput.Value.OutputUUID,w.WFWorkflowActions[0].WFWorkflowActionParameters.UUID);
  const text = w.WFWorkflowActions[4].WFWorkflowActionParameters.WFTextActionText.Value;
  for (const range of Object.keys(text.attachmentsByRange)) assert.equal(text.string[Number(range.match(/\d+/)[0])],'\ufffc');
  assert.ok(JSON.stringify(w).includes('/phone-collect/index.html#url='));
  assert.throws(()=>workflow('http://example.org'));
  const page = readFileSync(new URL('../ios/collect-page.mjs',import.meta.url),'utf8');
  assert.ok(page.includes('if (autoInput)'));
  assert.ok(!page.includes('innerHTML'));
});
test('auto collection requires explicit matching browser-local code and fresh valid URL',() => {
  const key = 'a'.repeat(32), hash = '#url='+encodeURIComponent(url)+'&key='+key;
  assert.equal(authorizedAutoInput(hash,key),url);
  for (const bad of ['',null,'b'.repeat(32),'PASTE_BROWSER_CONNECTION_CODE']) assert.equal(authorizedAutoInput(hash,bad),'');
  assert.equal(authorizedAutoInput('#url='+encodeURIComponent(url),key),'');
  assert.equal(authorizedAutoInput('#key='+key,key),'');
  assert.equal(authorizedAutoInput(hash+'&key='+key,key),'');
  assert.throws(()=>authorizedAutoInput(hash+'&url=evil',key));
  assert.throws(()=>authorizedAutoInput('#url=https%3A%2F%2Fevil.test%2Fs%2Fx&key='+key,key));
});
test('page controller auto-posts once only for paired fresh input; draft and wrong code never post',async () => {
  const script = readFileSync(new URL('../ios/collect-page.mjs',import.meta.url),'utf8').replace(/^import[^\n]+\n/,'');
  const key = 'a'.repeat(32);
  for (const mode of ['paired','wrong','draft','disabled']) {
    const elements = new Map();
    const element = selector => {
      if (!elements.has(selector)) elements.set(selector,{value:'',textContent:'',hidden:false,listeners:{},addEventListener(k,v){this.listeners[k]=v;},setAttribute(){}});
      return elements.get(selector);
    };
    const local = new Map(mode === 'disabled' ? [] : [['researchos.phone.collect.auto.v1',key]]);
    const session = new Map([['researchos.phone.collect.draft.v1',url]]);
    const storage = data => ({getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)});
    let calls=0;
    vm.runInNewContext(script,{inputFromHash,articleFromText,authorizedAutoInput,URLSearchParams,Uint8Array,
      collect:async()=>{calls++;return {id,url,title:'Fixture title',verified:true,duplicate:true};},
      document:{querySelector:element},sessionStorage:storage(session),localStorage:storage(local),
      navigator:{clipboard:{}},crypto:{},history:{replaceState(){}},
      location:{pathname:'/phone-collect/index.html',hash:mode==='draft'?'':'#url='+encodeURIComponent(url)+'&key='+(mode==='wrong'?'b'.repeat(32):key)}});
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(calls,mode==='paired'?1:0);
    if (mode==='paired') {assert.equal(element('#result').hidden,false);assert.equal(element('#title').textContent,'Fixture title');}
  }
});
