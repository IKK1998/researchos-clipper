-- Add to ~/.hammerspoon/init.lua after installing the Spoon.
-- This URL must be an ALREADY authorized loopback tunnel, not an unauthenticated public API.
hs.loadSpoon('ResearchClipper')
spoon.ResearchClipper.baseURL='http://127.0.0.1:3010'
spoon.ResearchClipper.mods={'ctrl','alt','cmd'}
spoon.ResearchClipper.key='S'
spoon.ResearchClipper.aiConsent=false
spoon.ResearchClipper:start()
