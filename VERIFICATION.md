# Verification — 2026-09-22

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
