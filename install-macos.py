#!/usr/bin/env python3
"""Install the Spoon with exact-file backups; preserve unrelated Hammerspoon config."""
import argparse
from datetime import datetime
from pathlib import Path
import shutil
import sys

parser = argparse.ArgumentParser()
parser.add_argument('--login', action='store_true', help='Enable Hammerspoon launch at login')
parser.add_argument('--dry-run', action='store_true')
args = parser.parse_args()
if sys.platform != 'darwin':
    raise SystemExit('Use extension/ on Windows and Linux.')
source = Path(__file__).resolve().parent / 'ResearchClipper.spoon'
root = Path.home() / '.hammerspoon'
target = root / 'Spoons/ResearchClipper.spoon'
config = root / 'init.lua'
files = ['init.lua', 'logic.lua', 'titles.lua']
old = config.read_text() if config.exists() else ''
start, end = '-- BEGIN ResearchOS Clipper managed install', '-- END ResearchOS Clipper managed install'
if start in old:
    first = old.index(start); last = old.index(end, first) + len(end)
    prefix, suffix = old[:first], old[last:]
    if suffix.startswith('spoon.ResearchClipper:start()'):
        suffix = suffix[len('spoon.ResearchClipper:start()'):]
    managed = old[first:last]
else:
    # Migrate only a simple, standalone old Spoon block. Refuse ambiguous edits.
    lines = old.splitlines(keepends=True)
    indexes = [i for i, line in enumerate(lines) if "hs.loadSpoon('ResearchClipper')" in line]
    if len(indexes) > 1:
        raise SystemExit('Multiple ResearchClipper blocks: review init.lua manually.')
    if indexes:
        first = indexes[0]; last = first + 1
        while last < len(lines) and (lines[last].strip().startswith('spoon.ResearchClipper.')
                                    or lines[last].strip() == 'spoon.ResearchClipper:start()'):
            last += 1
        prefix, suffix = ''.join(lines[:first]), ''.join(lines[last:])
        managed = ''.join(lines[first:last])
    else:
        prefix, suffix, managed = old + ('\n' if old else ''), '', ''
settings = [line.strip() for line in managed.splitlines()
            if line.strip().startswith('spoon.ResearchClipper.') and ':start(' not in line
            and '.autoTitle=' not in line]
if not settings:
    settings = ["spoon.ResearchClipper.mods={'alt'}", "spoon.ResearchClipper.key='S'",
                "spoon.ResearchClipper.aiConsent=false"]
block = '\n'.join([start, "hs.loadSpoon('ResearchClipper')", *settings,
    'spoon.ResearchClipper.autoTitle=true',
    *(['hs.autoLaunch(true)'] if args.login or 'hs.autoLaunch(true)' in managed else []),
    'spoon.ResearchClipper:start()', end])
new = prefix + block + '\n' + suffix.lstrip('\n')
for name in files:
    print(f'{source / name} -> {target / name} ({(source / name).stat().st_size} bytes)')
print(f'Merge managed block into {config}; unrelated lines and existing shortcut/provider settings retained.')
if args.dry_run:
    raise SystemExit(0)
backup = root / ('researchclipper-backup-' + datetime.now().strftime('%Y%m%d-%H%M%S'))
backup.mkdir(parents=True, exist_ok=False)
if config.exists(): shutil.copy2(config, backup / 'init.lua')
if target.exists(): shutil.copytree(target, backup / 'ResearchClipper.spoon')
target.mkdir(parents=True, exist_ok=True)
for name in files: shutil.copy2(source / name, target / name)
config.write_text(new)
print('Installed. Backup:', backup)
print('Choose Hammerspoon > Reload Config. Chrome automation approval may appear on first collection.')
