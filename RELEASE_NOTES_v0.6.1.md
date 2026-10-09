# v0.6.1 — browser preview serialization fix

The installed Mac Spoon remains at v0.6.0. Its real title-only collection,
existing-title repair and Hammerspoon restart acceptance are unchanged.

The browser extension is v0.6.1. A real Chromium test exposed a v0.6.0 defect:
GET requests passed `undefined` in `chrome.scripting.executeScript.args`, which
Chrome rejects before the request runs. Arguments now use serializable `null`;
GET/HEAD fetch calls still omit the body. A regression assertion covers this.

The Chromium runner uses only synthetic article/API fixtures and blocks real
site DNS. This is not proof of live WeChat acquisition or public authentication.
See VERIFICATION.md for the exact acceptance results and outstanding gates.

The browser package remains a preview, not a Chrome/Edge store release. Mac
owners can continue copying an article link and pressing their installed hotkey.
Other computers require installation and normal login to their authorized
ResearchOS website. No credentials, SSH settings or private library are shipped.
