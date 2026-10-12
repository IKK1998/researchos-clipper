import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {articleFromText,inputFromHash,collect,titleFromSource} from '../ios/collect-core.mjs';
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
test('shortcut has share input, clipboard fallback and only opens protected website',() => {
  const w = workflow();assert.deepEqual(w.WFWorkflowNoInputBehavior,{Name:'WFWorkflowNoInputBehaviorGetClipboard',Parameters:{}});
  assert.ok(w.WFWorkflowTypes.includes('ActionExtension'));
  const actions = w.WFWorkflowActions.map(a=>a.WFWorkflowActionIdentifier);
  assert.deepEqual(actions,['is.workflow.actions.detect.link','is.workflow.actions.urlencode','is.workflow.actions.gettext','is.workflow.actions.openurl']);
  assert.ok(JSON.stringify(w).includes('/phone-collect/index.html#url='));
  assert.throws(()=>workflow('http://example.org'));
  const page = readFileSync(new URL('../ios/collect-page.mjs',import.meta.url),'utf8');
  assert.ok(page.indexOf("addEventListener('submit'") < page.indexOf('await collect('));
  assert.ok(!page.includes('innerHTML'));
});
