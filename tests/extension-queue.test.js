import test from 'node:test';
import assert from 'node:assert/strict';

test('saved link resumes after offline failure and title is confirmed in existing website', async () => {
  let listener, alarm, online = false, title = '', captures = 0, state = {};
  const id = '12345678-1234-1234-1234-123456789abc';
  const url = 'https://mp.weixin.qq.com/s/fixture';
  global.chrome = {
    storage: {local: {get: async () => structuredClone(state), set: async s => { state = structuredClone({...state, ...s}); }}},
    runtime: {id: 'extension-test', onMessage: {addListener: fn => { listener = fn; }},
      onInstalled: {addListener() {}}, onStartup: {addListener() {}}},
    tabs: {query: async () => [{id: 1, url: 'https://researchos.cacdb.org/topics'}],
      create: async () => ({id: 2}), get: async () => ({id: 2, url}), remove: async () => {}, onUpdated: {addListener() {}}},
    scripting: {executeScript: async ({args}) => {
      assert(args.every(value => value !== undefined), 'Chrome rejects undefined script arguments');
      if (args.length === 1) return [{result: '从浏览器读取的真实标题'}];
      if (!online) return [{result: {error: 'offline'}}];
      const path = args[1], body = args[3];
      if (path === '/api/v1/intake') return [{result: {data: {saved: true, source_id: id}}}];
      if (path.endsWith('/capture')) { assert.equal(body.capture_scope, 'metadata_only'); assert.equal(body.body_text, undefined); title = body.title; captures++; return [{result: {data: {source_id: id}}}]; }
      return [{result: {data: {source: {id, original_value: url, provenance: {title}}}}}];
    }},
    action: {setBadgeText: async () => {}}, commands: {onCommand: {addListener() {}}},
    alarms: {create: async () => {}, onAlarm: {addListener: fn => { alarm = fn; }}}
  };
  await import('../extension/background.js');
  const send = msg => new Promise(resolve => listener(msg, {id: 'extension-test'}, resolve));
  assert.equal((await send({type: 'collect', url})).ok, true);
  await new Promise(r => setTimeout(r, 20));
  assert.equal(state.jobs[0].state, 'pending');
  online = true;
  for (let i = 0; i < 3; i++) { alarm(); await new Promise(r => setTimeout(r, 20)); }
  assert.equal(state.jobs[0].state, 'done'); assert.equal(captures, 1);
  assert.equal(title, '从浏览器读取的真实标题');
  await send({type: 'collect', url}); await new Promise(r => setTimeout(r, 20));
  assert.equal(captures, 1);
});
