# Privacy

## iPhone Shortcut and same-origin collection page

The current signed shortcut explicitly reads the current clipboard as its first
action, only when the user runs it. It opens the configured
HTTPS website and passes input in a URL fragment. It has no API keys, cookies,
SSH keys, model calls, scheduled triggers or clipboard history monitoring.

The page uses the existing website session. Tapping Confirm sends an intake
request with AI consent=false. Alternatively, after explicit one-time opt-in,
a shortcut carrying a matching browser-local connection code and a fresh valid
article URL submits once automatically. The random code lives in localStorage
and the user's private shortcut; it is an intent guard, not an API credential.
It cannot replace website authentication. It is passed only in the fragment,
never a query parameter. Do not share a configured shortcut. Disable or rotate
the connection on the page to revoke the old code; a new browser must reconnect.
Public downloads contain only a placeholder. A temporary sessionStorage draft keeps unsubmitted
input within that tab; a failed request is not silently replayed. Fragments are
removed from the visible URL after input is loaded, and the page sends no referrer.
Keep the phone and browser account private. Draft persistence across phone restarts
is not guaranteed. Website records are not deleted when the shortcut is removed.

## Mini-program development preview

Clipboard reading occurs only after an explicit Paste tap and, where supported,
privacy authorization. Manual pasting remains available. No WeChat message,
like/favorite list, cookie or clipboard history is read. The phone stores a
30-day scoped device token and up to 20 unsubmitted URL drafts. Logging out
removes the local token, not drafts or website records; protect shared phones.

The separate server stores hashed one-time pairing codes/device tokens, article
URLs, titles and receipts in a bounded private queue. A phone sees only its own
receipts and receives no upstream API credential. The server sends URL and
optional supplied title to ResearchOS with AI consent=false. It does not fetch
article pages itself. Operators must provide HTTPS, private backups, retention,
device revocation and platform privacy declarations before release. This preview
has not been deployed or audited on a real phone.

ResearchOS Clipper processes articles that you explicitly collect. The Mac
shortcut reads the current clipboard only when invoked. The extension receives
a URL you paste or the active article you explicitly collect.

Only the article URL, its real title and task receipts are sent to your configured
ResearchOS. Title-only capture sends no article body, image, chat, history, model
request, cookie or API key. Extension requests execute in your signed-in website
tab using the browser's normal same-origin session; login cookies are never read
by the extension. Local task queues contain URL, title, source ID and status.

The Mac version opens a dedicated Chrome window for each pending title and reads
only that window's URL and title. The extension reads the explicitly selected
article's heading/title metadata. Challenges are left for the owner to complete.
No proxy certificate, CAPTCHA bypass or private WeChat storage is used.

The existing Mac optional text-capture and AI toggle remain separate, explicitly
chosen operations. Installing the extension does not enable AI.

The public repository contains no owner credentials, SSH configuration, private
gateway implementation or article collection. Other users need their own
authorized ResearchOS access. A repository download grants no access to the
maintainer's private website.

Remove the browser extension to delete its local queue. To uninstall the Mac
version, remove the managed ResearchClipper block from Hammerspoon init.lua and
the ResearchClipper.spoon directory; reload Hammerspoon. Preserve unrelated Spoons
and login/tunnel settings. Server records remain in your ResearchOS.

## Optional official-account receiver (development preview)

The mobile receiver accepts only encrypted, signed official-account callbacks
from explicitly allowed OpenIDs, for the configured application/recipient.
It is not a personal-WeChat bot and does not scan chats, likes or clipboard
history. Only a supported article URL and a title supplied by the message go
to ResearchOS; AI consent is always false.

Callback bodies exist transiently in memory. A bounded persistent server queue
retains URLs, titles, timestamps, states and source receipts, with a hashed
sender/message key rather than raw OpenIDs. Private configuration holds allowed
OpenIDs, callback Token/AESKey and the ResearchOS API credential. No AppSecret
is required by this passive-reply implementation. Desktop statements about not
storing API keys do not describe this server-only module.

Logs omit message bodies, URLs, titles, identities and secrets. HTTPS is still
required. Protect and back up the queue, define retention, and archive completed
receipts before the 1,000-record limit. Stopping the receiver does not delete
website records. Production configuration and queues must never enter Git.
