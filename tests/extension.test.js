import test from 'node:test';
import assert from 'node:assert/strict';
import {articleURL, validTitle, websiteOrigin} from '../extension/core.js';
test('exact WeChat article URLs and valid real metadata only', () => {
  assert.equal(articleURL('https://mp.weixin.qq.com/s/fixture#read'), 'https://mp.weixin.qq.com/s/fixture');
  for (const u of ['https://evil.test/s/a','https://mp.weixin.qq.com.evil.test/s/a',
    'https://mp.weixin.qq.com@evil.test/s/a','http://mp.weixin.qq.com/s/a']) assert.equal(articleURL(u), null);
  for (const title of ['未知错误','环境异常','微信公众号文章','https://example.com']) assert.equal(validTitle(title), '');
  assert.equal(validTitle('组织年龄时钟：衰老不是同步的'),'组织年龄时钟：衰老不是同步的');
  assert.equal(websiteOrigin('https://researchos.cacdb.org'),'https://researchos.cacdb.org');
  assert.throws(() => websiteOrigin('https://name:password@site.test'));
});
