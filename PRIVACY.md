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
