"""Read-only QA proof that a fixed source tree produced a CJS-only TypeBox iOS bundle."""
import argparse
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('source_tree', type=Path)
parser.add_argument('bundle_dir', type=Path)
args = parser.parse_args()
maps = list(args.bundle_dir.rglob('*.hbc.map'))
assert len(maps) == 1, 'Expected one actual iOS Hermes source map'
source_map = maps[0]
bundle = source_map.with_suffix('')
assert bundle.is_file() and bundle.stat().st_size > 0, 'Missing actual Hermes bundle'
data = json.loads(source_map.read_text())
sources, contents = data['sources'], data['sourcesContent']
assert len(sources) == len(contents), 'Incomplete source-map content list'
cjs = [s for s in sources if '/@sinclair/typebox/build/cjs/' in s]
esm = [s for s in sources if '/@sinclair/typebox/build/esm/' in s]
assert cjs and not esm, 'TypeBox must resolve only official CJS exports'
assert any(s.endswith('/apps/ios/src/features/discover/DiscoverScreen.tsx') for s in sources)
verified = []
for source, content in zip(sources, contents):
    # Metro context modules are generated virtual entries, not physical source files.
    if source.startswith('/apps/ios/') and '?' not in source:
        local = args.source_tree / source.lstrip('/')
        assert local.is_file(), f'Missing fixed source {source}'
        assert content == local.read_text(), f'Bundled source differs from fixed tree: {source}'
        verified.append(source)
assert verified, 'No fixed-tree application sources checked'
print(json.dumps({'status': 'PASS', 'typeboxCjsSources': len(cjs), 'typeboxEsmSources': len(esm),
                  'fixedAppSourceFilesVerified': len(verified), 'hermesBundleBytes': bundle.stat().st_size,
                  'hermesBundleSha256': hashlib.sha256(bundle.read_bytes()).hexdigest(),
                  'sourceMapSha256': hashlib.sha256(source_map.read_bytes()).hexdigest(),
                  'scope': 'actual Metro export and fixed application-source mapping; not native launch or interaction'}, indent=2))
