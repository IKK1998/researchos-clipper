# ResearchOS Clipper

## 当前版本 0.6：自动标题收藏

复制公众号链接后按快捷键，工具自动保存链接、在专用 Chrome 窗口读取真实标题，
并回填到同一条 ResearchOS 收藏。获取成功后关闭工具自己打开的窗口。
已有标题保持原值；旧的无标题收藏再次提交即可自动补齐。

这是一款免费、MIT 开源的收藏工具。它不使用大模型猜标题。
遇到微信验证时保留专用页面，完成验证后继续；不能保证每篇受限文章都能读取。

### Mac：继续使用复制链接 + Option+S

安装官方 Hammerspoon 和 Google Chrome，下载本仓库后运行：

```sh
python3 install-macos.py --login --dry-run
python3 install-macos.py --login
```

在 Hammerspoon 菜单选 Reload Config。首次需要系统的辅助功能授权，以及
Hammerspoon 控制 Chrome 的自动化授权。以后按 Option+S 即可收藏。
安装器保留你已有的快捷键、网站地址和 AI 设置，先备份再更新三个插件文件。
新安装默认关闭 AI；标题提取始终不调用模型。

Mac 入口使用已经授权的 `http://127.0.0.1:3010` 网关。你的 SSH 别名、密钥
和本机隧道由你自己的环境管理，不包含在这个开源仓库中。
没有私有隧道的新电脑应使用下面的浏览器扩展。

### 换电脑：Chrome / Edge 扩展（预览版）

Windows、macOS、Linux 均可使用 `extension/`：

请使用 v0.6.1 扩展；v0.6.0 存在 Chrome 参数序列化错误。
v0.6.1 已通过真实 Chromium 的隔离页面测试：标题回写、重复保护、断网队列和
浏览器重启恢复。尚未完成当前电脑扩展安装、公网登录会话及 Windows / Edge 实测。
Mac 快捷键版已完成真实收藏验收；推广前应在目标浏览器完成登录、收藏与回读测试。

1. 在浏览器中打开并登录你有权限使用的 ResearchOS 网站。
2. Chrome 打开 `chrome://extensions`（Edge 为 `edge://extensions`），启用
   开发者模式，选择「加载已解压的扩展程序」，选中 `extension/` 文件夹。
3. 点击扩展图标，粘贴公众号链接。粘贴完成后自动加入队列。
   已经在浏览器中阅读文章时，可直接按 Alt+Shift+S 收藏当前文章。
4. 窗口可以关闭，后台继续获取标题。网站退出登录时，任务等待重新登录。

扩展通过已登录的 ResearchOS 页面调用原有接口，不需要 SSH、API Token，
也不提取或导出登录 Cookie。默认只授权微信和 ResearchOS 两个域名；
连接自己的 ResearchOS 时，在设置页填写 HTTPS 根地址并批准那个域名的权限。
它不向其他人开放你的私人网站。其他使用者需要自己的 ResearchOS 账号或部署。

### 重启、迁移与恢复

- Mac 安装时的 `--login` 开启 Hammerspoon 登录启动。已保存的待提交链接和
  待取标题任务会在重启后恢复；私有网关也需要你已有的登录启动配置。
- 扩展把待处理任务存于该浏览器本地，浏览器重启后自动恢复。需要启动浏览器；
  电脑关机时不会进行本机浏览器采集。
- 换电脑重新安装扩展、登录同一网站，已经入库的文章仍在服务器。
  尚未入库的本机队列不会自动跨设备同步。迁移前应确认队列已处理完成。
- 没有原始标题时明确显示等待获取。网络恢复会重试幂等收藏和标题回读，
  不自动重跑已完成的摘要或模型问答。

### 发布与验证

仓库提供源码、安装器、可解压加载的扩展包和 GitHub Release；目前没有提交
Chrome / Edge 商店，浏览器首次安装仍需人工确认。仅 URL 和真实标题被发送，
无正文抓取。详见 [PRIVACY.md](PRIVACY.md) 和 [VERIFICATION.md](VERIFICATION.md)。

下面保留历史版本说明。旧版的「不自动获取标题」等描述不适用于 0.6 的新队列。

## Historical versions

A small MIT-licensed [Hammerspoon](https://github.com/Hammerspoon/hammerspoon)
Spoon for saving a copied WeChat article link to an **existing, authorized**
ResearchOS private gateway. This is not a WeChat plugin, scraper or standalone
bookmark server. It does not require a Chrome extension.

## 使用方式

### Version 0.5: title metadata compatibility (live acceptance pending)

The foreground allowlist now includes WeChat's independent article reader
`com.tencent.flue.WeChatAppEx`, observed on the owner's Mac. Both reader processes
still require an exact AXDocument-to-copied-URL match. If the same clipboard item
provides `public.url` and `public.url-name`, its title is considered only when that
URL matches and the clipboard change counter remains stable. Conflicting titles
are not used. This does not fetch WeChat pages, read chats, or guess missing titles.
Synthetic tests passed and the owner installation was reloaded on 2026-09-25;
real article title capture and public-site search acceptance remain outstanding.
Duplicate intake still does not overwrite existing metadata.

### Version 0.4: linked content and model handoff

1. Copy the public WeChat article link, then invoke your existing shortcut.
2. If automatic acquisition is unavailable, copy the article text you have the
   right to process (include its title on the first line), then invoke the same
   shortcut. The successfully saved source is remembered in memory for 30 minutes.
3. Confirm the exact destination link and text preview. No text is sent before
   confirmation. Do not supply chats, credentials, patient or controlled data.
4. Text is stored as owner-supplied **selected excerpts**, not certified full text.
   A short first line can become the title when the saved-link session had no title;
   the confirmation explicitly displays that change. Images and original layout
   are not captured. Existing backend title search then works without new schema.
5. When AI is enabled, only a confirmed text-save receipt triggers one summary
   request. A queued task is not a completed summary; inspect the website for
   completion. Failure/timeout never automatically replays an inference request.

The target is cleared after successful text capture, preventing accidental
repeated attachment. It is not retained across Hammerspoon restarts. This is an
explicit clipboard workflow, not a background collector or a workaround for
source access restrictions. It cannot capture an unreadable browser page for you.

Version 0.3: 不再弹出标题确认框。仅当当前微信窗口提供的 AXDocument 链接
与复制链接精确匹配时，自动携带窗口标题；微信不提供该属性时仅保存链接，
由后台按来源规则尝试获取网页标题。不能保证微信链接均可提取标题。
不会扫描聊天记录或自动读取正文，也不会把其他窗口标题误认为文章标题。
重复链接沿用原记录，不覆盖已有标题；无标题的旧记录需在网站补充。
本机已自定义为 Option+S 的用户保留原快捷键，不受默认组合影响。

在 Mac 微信文章的菜单中选择「复制链接」，按 **Control + Option + Command + S**
（⌃⌥⌘S），等待「已保存」或「已有此链接」提示。也可以点击菜单栏「收藏」。
只有后台返回 `saved: true` 和来源 ID 才显示成功；全文抓取、模型总结是否完成
必须在网站查看。第一版不自动点击微信的复制按钮，也不批量收集浏览记录。

## Installation

1. Install Hammerspoon from its official release and grant Accessibility permission
   in macOS System Settings if requested. Hammerspoon is a separate dependency;
   its source/license remain upstream. No Hammerspoon binaries are bundled here.
2. Copy `ResearchClipper.spoon` to `~/.hammerspoon/Spoons/ResearchClipper.spoon`.
3. Append the contents of `config.example.lua` to your existing
   `~/.hammerspoon/init.lua` without overwriting other configuration.
4. Configure the loopback port for your already-established private SSH gateway.
   Choose **Reload Config** in Hammerspoon. Configure Launch at Login in its
   preferences if desired. This project does not silently install a login daemon.

The default shortcut is checked for assignability. You can change `mods` and `key`.
For macOS users unfamiliar with the symbols: ⌃ Control, ⌥ Option, ⌘ Command.

## Backend contract / authentication

This repository does **not** include ResearchOS private server code or credentials.
The gateway must already be securely connected to your backend. HTTP is accepted
only at literal `127.0.0.1` with a port; traffic beyond the local gateway must use
an authenticated protected transport such as SSH. Never expose that gateway to
the LAN or Internet. The local tunnel is accessible to local processes; use a
trusted, single-user Mac. Do not point this at an arbitrary local service.

The client sends one `POST /api/v1/intake`, JSON:

```json
{"value":"https://mp.weixin.qq.com/s/EXAMPLE","source_kind":"wechat","ai_consent":false}
```

Expected successful response:

```json
{"saved":true,"duplicate":false,"source_id":"12345678-1234-1234-1234-123456789abc"}
```

The server must validate URLs, deduplicate submissions and enforce access control.
For acquisition, it must also prevent SSRF and respect source restrictions. A
generic linkding/Karakeep server will not satisfy this contract without an adapter.
Cloudflare Access browser sessions are **not** extracted, bypassed or reused.
Direct authenticated public ingestion is not implemented in v0.1; collection needs
the local tunnel, even if the website itself has a public login-protected URL.

## Privacy and behavior

- Clipboard is read once on an explicit shortcut/menu action; no clipboard watcher.
- Only a single HTTPS `mp.weixin.qq.com/s/...` or `/s?...` URL is accepted.
- No WeChat cookies, chat database, full text, credentials or clipboard history
  are read, persisted or uploaded. URLs may contain source query identifiers;
  these go only to the configured private gateway.
- No shell interpolation, background polling, automatic retry or redirect following.
- An uncertain timeout is not declared success or failure; verify in the website.
  Further submissions wait for the outstanding HTTP callback. If the transport
  never returns, check the server and reload Hammerspoon configuration manually.
- AI processing is off by default. Enable it explicitly in the menu for newly
  saved links; it may send acquired text to an external paid model. This toggle
  is session-only unless configured in your private init.lua.
- User-triggered repeated collection can still reach the server; server-side
  deduplication is required. A duplicate is not an instruction to rerun AI jobs.

## Tests

```sh
lua tests/logic.lua
lua tests/client.lua
luac -p ResearchClipper.spoon/init.lua
```

Unit tests exercise URL restrictions, endpoint restrictions and saved-receipt
validation. Real macOS shortcut, menu, permissions and private-server acceptance
must be verified on the installed machine; CI alone cannot certify those.

## Uninstall

Remove only the ResearchClipper lines you added to `init.lua`, reload Hammerspoon,
then remove the `ResearchClipper.spoon` folder if no longer needed. Other Spoons
and website records are unaffected.
