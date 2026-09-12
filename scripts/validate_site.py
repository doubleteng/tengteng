"""Validate rendered content and internal links after `bundle exec jekyll build`."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse, unquote
import re, sys, xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / '_site'
errors = []

class Page(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.links, self.ids, self.headings = [], set(), 0
        self.feed(source)
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get('id'): self.ids.add(attrs['id'])
        if tag == 'h1': self.headings += 1
        if tag in ['a', 'link'] and attrs.get('href'): self.links.append(attrs['href'])
        if tag in ['img', 'script', 'source', 'iframe'] and attrs.get('src'): self.links.append(attrs['src'])
        if tag == 'img' and 'alt' not in attrs: errors.append('Image missing alt text')

if not (SITE / 'index.html').is_file(): sys.exit('Build the site first.')
pages = {}
for path in SITE.rglob('*.html'):
    if 'assets' in path.relative_to(SITE).parts: continue
    text = path.read_text()
    key = '/' + path.relative_to(SITE).as_posix()
    pages[key] = Page(text)
    if pages[key].headings != 1 and 'http-equiv="refresh"' not in text: errors.append(f'{key}: expected one h1')
    for term in ['Short description of the project', 'Summarize computation', '[Name]', 'example.com', 'xxxxxxxx', 'YOUR_']:
        if term in text: errors.append(f'{key}: leftover placeholder {term}')

for url, page in pages.items():
    for link in page.links:
        target = urlparse(urljoin('https://teng-teng.org' + url, link))
        if target.scheme not in ['http', 'https'] or target.netloc != 'teng-teng.org': continue
        path = unquote(target.path)
        destination = SITE / path.lstrip('/')
        if path.endswith('/'): destination /= 'index.html'
        if not destination.is_file(): errors.append(f'{url}: broken link {link}')
        if target.fragment and destination.suffix == '.html' and destination.is_file():
            key = '/' + destination.relative_to(SITE).as_posix()
            if key in pages and target.fragment not in pages[key].ids: errors.append(f'{url}: broken anchor {link}')

project_count = 0
for path in (ROOT / '_projects').glob('*.md'):
    text = path.read_text().split('---', 2)[1]
    if not re.search(r'^published: true$', text, re.M): continue
    match = re.search(r'^permalink: (.+)$', text, re.M)
    url = match.group(1).strip("'\"") if match else '/projects/' + path.stem + '/'
    if not (SITE / url.strip('/') / 'index.html').is_file(): errors.append(f'Missing project route: {url}')
    project_count += 1
gallery = (SITE / 'gallery/index.html').read_text()
if gallery.count('<article class="project-card"') != project_count: errors.append('Project index count mismatch')
pub_count = sum(bool(re.search(r'^published: true$', p.read_text().split('---', 2)[1], re.M)) for p in (ROOT / '_publications').glob('*.md'))
if (SITE / 'publications/index.html').read_text().count('<article class="publication"') != pub_count: errors.append('Publication index count mismatch')
sitemap = ET.parse(SITE / 'sitemap.xml')
urls = {node.text for node in sitemap.iter('{http://www.sitemaps.org/schemas/sitemap/0.9}loc')}
for route in ['/', '/research/', '/teaching/', '/design/', '/gallery/', '/publications/', '/about/', '/contact/', '/news/']:
    if 'https://teng-teng.org' + route not in urls: errors.append('Sitemap missing ' + route)
if any('/admin/' in url for url in urls): errors.append('Admin included in sitemap')
if errors:
    print('\n'.join(sorted(set(errors))))
    sys.exit(1)
print(f'PASS: {len(pages)} pages, {project_count} projects, {pub_count} publications; internal links, assets, placeholders, and sitemap checked.')
