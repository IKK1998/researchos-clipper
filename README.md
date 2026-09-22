# ResearchOS Clipper

A small MIT-licensed [Hammerspoon](https://github.com/Hammerspoon/hammerspoon)
Spoon for saving a copied WeChat article link to an **existing, authorized**
ResearchOS private gateway. This is not a WeChat plugin, scraper or standalone
bookmark server. It does not require a Chrome extension.

## 使用方式

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
