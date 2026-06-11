#!/usr/bin/env python3
"""Build street-protocol: concatenate parts, embed three.js inline, verify."""
import re, subprocess, sys, pathlib

ROOT = pathlib.Path(__file__).parent
PARTS = ['p0_head.html','p1_core.html','p2_audio.html','p3_world.html',
         'p4_actors.html','p5_combat.html','p5b_boss.html','p6_game.html','p7_boot.html']

html = ''.join((ROOT/'parts'/p).read_text() for p in PARTS)

vendor = (ROOT/'node_modules/three/build/three.min.js').read_text()
assert '</script>' not in vendor, 'vendor lib would break inline embedding'
cdn_tag = re.search(r'<script src="https://cdnjs[^"]*"></script>', html)
assert cdn_tag, 'CDN placeholder tag not found'
html = html.replace(cdn_tag.group(0),
    '<script id="vendor-three">\n' + vendor + '\n</script>')

(ROOT/'index.html').write_text(html)

m = re.search(r'<script id="game">([\s\S]*?)</script>', html)
assert m, 'game script missing'
(pathlib.Path('/tmp/game.js')).write_text(m.group(1))
r = subprocess.run(['node','--check','/tmp/game.js'])
sys.exit(r.returncode or print(f'built index.html  {len(html)/1024:.0f} KB  (vendor {len(vendor)/1024:.0f} KB)') or 0)
