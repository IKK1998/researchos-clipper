// Generated artifact, no account identifiers, API keys or article collections.
import {writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export function workflow(origin = 'https://researchos.cacdb.org') {
  const u = new URL(origin); if (u.protocol !== 'https:' || u.username || u.password || u.pathname !== '/' || u.search || u.hash) throw new Error('HTTPS origin required');
  const ids = ['F3F9D063-465C-4A05-9FB7-EF1D5A51B111','F3F9D063-465C-4A05-9FB7-EF1D5A51B222','F3F9D063-465C-4A05-9FB7-EF1D5A51B333'];
  const ref = (id) => ({WFSerializationType:'WFTextTokenAttachment',Value:{Type:'ActionOutput',OutputUUID:id,OutputName:'Result'}});
  const prefix = u.origin+'/phone-collect/index.html#url=';
  const keyId = 'F3F9D063-465C-4A05-9FB7-EF1D5A51B000';
  const clipboardId = 'F3F9D063-465C-4A05-9FB7-EF1D5A51B444';
  const linkText = prefix+'\ufffc&key=\ufffc';
  return {WFWorkflowName:'收藏到 ResearchOS',WFWorkflowClientVersion:'2700.0.4',WFWorkflowClientRelease:'4.0',WFWorkflowMinimumClientVersion:900,WFWorkflowMinimumClientVersionString:'900',WFWorkflowHasShortcutInputVariables:true,
    WFWorkflowIcon:{WFWorkflowIconStartColor:463140863,WFWorkflowIconGlyphNumber:59511},
    WFWorkflowTypes:[],WFWorkflowInputContentItemClasses:[],
    WFWorkflowNoInputBehavior:{Name:'WFWorkflowNoInputBehaviorContinue',Parameters:{}},WFWorkflowImportQuestions:[{ActionIndex:1,Category:'Parameter',ParameterKey:'WFTextActionText',DefaultValue:'PASTE_BROWSER_CONNECTION_CODE',Text:'粘贴手机收藏页提供的本机连接码。设置完成后请重新复制文章链接，再运行快捷指令。'}],
    WFWorkflowActions:[
      {WFWorkflowActionIdentifier:'is.workflow.actions.getclipboard',WFWorkflowActionParameters:{UUID:clipboardId}},
      {WFWorkflowActionIdentifier:'is.workflow.actions.gettext',WFWorkflowActionParameters:{UUID:keyId,WFTextActionText:'PASTE_BROWSER_CONNECTION_CODE'}},
      {WFWorkflowActionIdentifier:'is.workflow.actions.detect.link',WFWorkflowActionParameters:{UUID:ids[0],WFInput:ref(clipboardId)}},
      {WFWorkflowActionIdentifier:'is.workflow.actions.urlencode',WFWorkflowActionParameters:{UUID:ids[1],WFEncodeMode:'Encode',WFInput:ref(ids[0])}},
      {WFWorkflowActionIdentifier:'is.workflow.actions.gettext',WFWorkflowActionParameters:{UUID:ids[2],WFTextActionText:{WFSerializationType:'WFTextTokenString',Value:{string:linkText,attachmentsByRange:{['{'+prefix.length+', 1}']:ref(ids[1]).Value,['{'+(prefix.length+6)+', 1}']:ref(keyId).Value}}}}},
      {WFWorkflowActionIdentifier:'is.workflow.actions.openurl',WFWorkflowActionParameters:{WFInput:ref(ids[2])}},
    ]};
}
function xml(value) {
  const escape = (v) => v.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  if (Array.isArray(value)) return '<array>'+value.map(xml).join('')+'</array>';
  if (typeof value === 'boolean') return value ? '<true/>' : '<false/>';
  if (typeof value === 'object') return '<dict>'+Object.entries(value).map(([k,v])=>'<key>'+escape(k)+'</key>'+xml(v)).join('')+'</dict>';
  if (typeof value === 'number') return '<integer>'+value+'</integer>';
  return '<string>'+escape(String(value))+'</string>';
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = resolve(dirname(fileURLToPath(import.meta.url)),'ResearchOS-Collect.unsigned.shortcut');
  writeFileSync(output,'<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">'+xml(workflow())+'</plist>\n');
  console.log('Unsigned shortcut generated (no credentials)');
}
