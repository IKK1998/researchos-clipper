"""Produce small source packages; never include local settings or credentials."""
from pathlib import Path
import zipfile
import json
root = Path(__file__).resolve().parents[1]
out = root / 'artifacts'
out.mkdir(exist_ok=True)
with zipfile.ZipFile(out / 'ResearchClipper.spoon.zip', 'w', zipfile.ZIP_DEFLATED) as z:
    for name in ['init.lua', 'logic.lua', 'titles.lua']:
        z.write(root / 'ResearchClipper.spoon' / name, 'ResearchClipper.spoon/' + name)
version = json.loads((root / 'extension/manifest.json').read_text())['version']
with zipfile.ZipFile(out / ('researchos-clipper-browser-v' + version + '.zip'), 'w', zipfile.ZIP_DEFLATED) as z:
    for p in sorted((root / 'extension').iterdir()):
        if p.is_file() and p.suffix in {'.json', '.js', '.html', '.css'}:
            z.write(p, 'extension/' + p.name)
    z.write(root / 'PRIVACY.md', 'PRIVACY.md')
for p in out.glob('*.zip'): print(p.name, p.stat().st_size, 'bytes')
