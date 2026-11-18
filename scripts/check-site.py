"""Check the built files, navigation, fragments, SEO and image references. No packages needed."""
import argparse
import json
import os
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
BASE = '/' + os.environ.get('BASE_PATH', '').strip('/')
BASE = '' if BASE == '/' else BASE


class Page(HTMLParser):
    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.path, self.refs, self.ids, self.images = path, [], set(), []
        self.headings = self.titles = 0
        self.description = self.canonical = self.language = False
        self.title_text = ''
        self.in_title = False
        self.feed(path.read_text())

    def handle_starttag(self, tag, pairs):
        a = dict(pairs)
        if 'id' in a:
            if a['id'] in self.ids:
                errors.append(f'{self.path}: duplicate id {a["id"]}')
            self.ids.add(a['id'])
        if tag == 'h1': self.headings += 1
        if tag == 'title': self.titles += 1; self.in_title = True
        if tag == 'html': self.language = bool(a.get('lang'))
        if tag == 'meta' and a.get('name') == 'description': self.description = bool(a.get('content'))
        if tag == 'link' and a.get('rel') == 'canonical': self.canonical = a.get('href', '')
        if tag == 'img': self.images.append(a)
        if tag in ('a', 'img', 'script', 'link', 'source'):
            if tag == 'link' and a.get('rel') in ('canonical', 'preconnect'): return
            for key in ('href', 'src'):
                if a.get(key): self.refs.append(a[key])
            for candidate in a.get('srcset', '').split(','):
                if candidate.strip(): self.refs.append(candidate.strip().split()[0])

    def handle_endtag(self, tag):
        if tag == 'title': self.in_title = False

    def handle_data(self, text):
        if self.in_title: self.title_text += text


errors = []
parser = argparse.ArgumentParser()
parser.add_argument('--external', action='store_true', help='Also record HTTP status of external links (not a deployment gate).')
args = parser.parse_args()
if not (DIST / 'index.html').exists(): sys.exit('Build first: npm run build')
pages = {p: Page(p) for p in sorted(DIST.rglob('*.html'))}
external = set()
titles = set()
ref_count = image_count = 0
for path, page in pages.items():
    route = '/' + path.relative_to(DIST).as_posix().removesuffix('index.html')
    if page.headings != 1: errors.append(f'{route}: expected one h1, found {page.headings}')
    if page.titles != 1 or not page.title_text: errors.append(f'{route}: missing title')
    if page.title_text in titles: errors.append(f'{route}: duplicate title')
    titles.add(page.title_text)
    if not page.description or not page.canonical or not page.language: errors.append(f'{route}: missing description, canonical or language')
    if BASE and not urlsplit(page.canonical).path.startswith(BASE+'/'): errors.append(f'{route}: canonical missing base path')
    for img in page.images:
        image_count += 1
        if 'alt' not in img: errors.append(f'{route}: missing image alt')
        if not img.get('width') or not img.get('height'): errors.append(f'{route}: missing image dimensions')
        if img.get('src', '').startswith('http'): errors.append(f'{route}: image still depends on remote host')
    for ref in page.refs:
        ref_count += 1
        split = urlsplit(ref)
        if split.scheme in ('https','http'):
            external.add(ref)
            continue
        if split.scheme or ref.startswith('//'): continue
        dest = urlsplit(urljoin('https://local.invalid'+BASE+route, ref))
        target_path = unquote(dest.path)
        if BASE:
            if not target_path.startswith(BASE+'/') and target_path != BASE:
                errors.append(f'{route}: reference escapes base path: {ref}')
                continue
            target_path = target_path[len(BASE):]
        target = DIST / target_path.lstrip('/')
        if target.is_dir(): target /= 'index.html'
        if not target.exists():
            errors.append(f'{route}: missing target {ref}')
        elif dest.fragment and target.suffix == '.html' and target in pages and unquote(dest.fragment) not in pages[target].ids:
            errors.append(f'{route}: missing fragment {ref}')
for route in ['', 'research','team','photos','publications','support','contact','welcome']:
    if not (DIST/route/'index.html').exists(): errors.append(f'Missing preserved route /{route}')
for filename in ['404.html','robots.txt','sitemap.xml','favicon.svg']:
    if not (DIST/filename).exists(): errors.append(f'Missing {filename}')
sitemap = (DIST/'sitemap.xml').read_text()
if '/welcome' in sitemap or '/404' in sitemap: errors.append('Duplicate/error page included in sitemap')
# Build validation depends on the site image metadata, not archived migration notes.
for image_path in json.loads((ROOT/'src/data/images.json').read_text()):
    if not (DIST/image_path.lstrip('/')).exists(): errors.append(f'Missing image from inventory: {image_path}')
if errors:
    print('\n'.join(errors)); sys.exit(1)
print(f'PASS: {len(pages)} HTML pages; {ref_count} references; {image_count} images; preserved routes, fragments, SEO, sitemap and all migrated images.')
if args.external:
    result = []
    for url in sorted(external):
        try:
            with urlopen(Request(url, headers={'User-Agent':'Mozilla/5.0 (Serebrenik Lab migration link check)'}), timeout=15) as response:
                status, final = response.status, response.url
        except HTTPError as exc:
            status, final = exc.code, exc.url
        except Exception as exc:
            status, final = str(exc), url
        result.append({'url':url, 'status':status, 'destination':final})
        print(f'{status}: {url}')
    report = ROOT/'docs/audit/external-links.json'
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps(result, indent=2)+'\n')
    print('External HTTP results saved; publisher/bot restrictions need human review, not automatic removal.')
