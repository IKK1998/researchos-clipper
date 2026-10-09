# ResearchOS Clipper 0.6 preview

Mac collection now obtains real article titles through a dedicated Chrome window,
repairs untitled existing records through the existing API and confirms saved
titles by readback. The persistent queue resumes after Hammerspoon restart or
temporary network failure. The installer preserves existing shortcut settings,
backs up replaced files and optionally enables launch at login.

Actual Mac acceptance completed against ResearchOS: 18/18 collected WeChat links
have real titles; new collection, duplicate repair, keyword search, actual hotkey
and application restart were exercised. Article text was not uploaded by the
title queue and no model call was required for title extraction.

A Chrome/Edge extension preview enables collection through a signed-in ResearchOS
website without a private SSH gateway. It is packaged for unpacked installation;
it has automated adapter tests but live extension/Windows/Edge testing remains
pending. This is a prerelease, not a Chrome Web Store listing.

Download `ResearchClipper.spoon.zip` for an existing Hammerspoon installation,
or clone the source and run `python3 install-macos.py --login`. Browser users can
unzip `researchos-clipper-browser-v0.6.0.zip` and follow README installation steps.
The tool never grants access to the maintainer's private ResearchOS website.

WeChat may require owner verification. Pending article pages are retained and
can be opened from the Mac menu. Title metadata cannot be guaranteed for every
blocked, removed or restricted source. No verification bypass is implemented.
