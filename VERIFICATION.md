# Verification

## iPhone shortcut and static collection page — 2026-10-12

- Generated a four-action share-input shortcut with explicit no-input clipboard
  fallback; Apple official signing command succeeded with system-service access.
  Plain sandbox signing misleadingly reported a file-format error. Import preview
  showed four actions in Mac Shortcuts; final Add/UI verification timed out, so
  Mac installation, iCloud synchronization and iPhone installation are unconfirmed.
- Corrected the clipboard fallback identifier after preview showed Continue;
  regenerated/re-signed and released a new v2 without overwriting v1.
- Node22.21.0: 29 tests passed (five iOS, seven mini, 15 official-account, two
  extension). Included long-URL encoding, unsafe inputs, AI=false, same-origin,
  offline/login failure, invalid receipts and mismatched readback handling.
- Owner approved Web-only release and one already-saved real article acceptance.
  FDU was audited before writes. Explicit seven-file transfer including manifest,
  about 39KB, dry-run first; no database, corpus, secrets or broad synchronization.
- Remote static overlay v2 activated; page/JS/shortcut hashes verified over actual
  HTTP responses. Web health passed, other ResearchOS/tunnel service fingerprints
  unchanged, API route and anatomy hashes unchanged, model-call count unchanged
  during release. Existing private Access policy was not edited.
- Existing owner-selected article: actual gateway intake returned saved=true,
  duplicate=true and original source ID; source readback/title and keyword search
  succeeded. No new source created, AI consent=false. Not an authenticated iPhone
  Safari click test; do not conflate server acceptance with mobile acceptance.
- Pending: real iPhone import, Safari/WeChat share entry, clipboard permission,
  first login/fragment preservation, offline interaction and whole-phone restart.

## Mini-program development preview — 2026-10-12

- Added a one-page mini-program and independent loopback collector in the existing
  repository. No production writes, schema/auth changes, credentials or model calls.
- Node22.21.0: `npm test` passed 24 tests (seven mini-program, 15 official-account,
  two extension). Isolated HTTP bridge tests verified pairing, ownership isolation,
  deduplication, AI=false, title readback and rejection of unsafe URLs/requests.
- Pairing expiry/reuse, hashed secret storage, device revocation, queue recreation,
  offline client drafts, invalid receipts and expired auth were checked.
- HTTP bridge used injected mock upstream responses, not the actual ResearchOS.
  Wx client used a mock, not WeChat developer tools. No real AppID, legal-domain
  setup, privacy consent, phone test, publication or production deployment claimed.
- Titleless links remain pending, never replaced with fabricated model titles.
  The timer worker refreshed a pending title and blocked a revoked queued device
  against a mock. Whole-host reboot and production refresh need live acceptance.

## Mobile official-account receiver preview — 2026-10-12

- Added `mobile/` in the existing desktop-clipper repository; no separate server
  database for articles, new npm dependencies, model calls or remote deployment.
- `npm test`: 17 tests passed on Node22.21.0, including 15 mobile tests and two
  existing extension suites. An initial sandbox prevented loopback binding;
  the permitted isolated loopback run passed. This is not a production error.
- Actual HTTP fixture flow checked encrypted callback → bounded persistent queue
  → authenticated mock intake → source/title readback. AI consent=false;
  duplicate message processing and existing-title preservation were tested.
- An independent public wechatpy cipher/signature test vector passed. It checks
  AES framing compatibility, not live official-account forwarding permissions.
- Actual child receiver was killed and restarted using a synthetic queue; one
  persistent job and its original title survived. A concurrent live receiver
  was rejected. No real machine/server reboot or startup service was tested.
- Unauthorized sender, recipient/AppID/signature mismatch, stale input, unsafe
  URL/XML, plaintext POST, multiple links, wrong source readback and retry limit
  were covered. No live article was fetched or submitted to ResearchOS.
- User has an official account but its server configuration/permissions have
  not been inspected. HTTPS routing, secret configuration, real phone forwarding,
  public website search acceptance and deployment remain pending. Existing
  official-account callbacks must be preserved until impact is reviewed.
- First receipt says accepted/queued, not saved. Background-completion proactive
  WeChat notification is not implemented. URL-only messages can lack titles.
- New Goal creation was refused because the current thread has an unfinished
  older Goal. No false completion or Goal replacement was performed.

## Browser preview 0.6.1 — 2026-10-09

- Real bundled Chromium loaded the actual MV3 extension and passed title capture
  with API readback, duplicate-title preservation, offline pending persistence
  and browser restart recovery. [CI run](https://github.com/IKK1998/researchos-clipper/actions/runs/37915516737),
  tested commit `3f2b06f066792b415e2a0ea59930cdc8a2bd4423`.
- All network article/API responses in that runtime test are synthetic fixtures;
  real site DNS is blocked. New extension targets are explicitly re-navigated to
  isolated fixtures after Playwright attaches. No production source is contacted.
  This does not prove actual public authentication or live WeChat capture.
- Chromium exposed and confirmed the fix for unserializable `undefined` GET
  arguments in 0.6.0. Browser users should use 0.6.1, not the old preview ZIP.
- The current desktop control connection still times out. Current-computer
  extension installation, public signed-in UI and Windows/Edge acceptance remain
  outstanding. No store listing or whole-machine reboot is claimed.

## Version 0.6 acceptance — 2026-10-09

- Installed Mac version 0.6; existing Option+S binding preserved.
- Actual runtime reports `launchAtLogin=true`; the existing authorized SSH
  gateway is supervised by its original launchd service. A whole Mac power-cycle
  was not performed during this session.
- Triggered actual Option+S with an explicitly selected public article link;
  the real installed queue confirmed the corresponding saved title.
- Browser title acquisition, existing-source repair and a first-time article
  collection completed against the actual ResearchOS server. Exact source URL
  matching and server title readback were required before success.
- Previously untitled records were processed by the installed queue. Final
  authenticated gateway readback: 18 WeChat sources, 18 real titles, zero URL
  title fallbacks. These title-only repairs do not imply full-text acquisition.
- Restarted Hammerspoon with unresolved tasks. The persisted queue resumed and
  completed; final 15 queue jobs done. Chrome and the website were not restarted.
- Keyword searches for newly captured titles returned the expected records.
- Five isolated Lua suites passed, covering metadata binding, receipts,
  persisted offline queue, restart recovery, duplicate repair, title readback
  and existing-title preservation. Two Node suites passed for extension URL
  validation and offline/recovery orchestration.
- Browser extension package and install instructions are provided as preview:
  live extension installation, public signed-in session and Windows/Edge
  acceptance have not been completed. No extension-store publication is claimed.

The remaining lines below describe the older release, not the current Mac install.

- GitHub Actions Lua tests and Spoon syntax check passed for commit `38f2a85`.
  [Test run](https://github.com/IKK1998/researchos-clipper/actions/runs/35727416882)
- A contract-level request against an existing authorized private gateway using
  an already-saved WeChat URL returned `saved=true`, `duplicate=true`, and the
  unchanged source ID. AI consent was false; no summary replay was requested.
  Article URLs, IDs, credentials and private host configuration are not published.
- Native Hammerspoon installation, macOS Accessibility approval and a physical
  global-shortcut test are **pending**. Mocked hotkey tests are not a substitute.
- WeChat full-text extraction, direct Cloudflare Access integration, automatic
  copying from WeChat windows and browser-independent public ingestion are not
  implemented or claimed.
