# Privacy

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
