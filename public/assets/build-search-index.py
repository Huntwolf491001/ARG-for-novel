"""Rebuild the public search index after editing website content."""
from html.parser import HTMLParser
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class PublicContent(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_title = False
        self.in_main = False
        self.hidden = 0
        self.title = ''
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag == 'title':
            self.in_title = True
        if tag == 'main':
            self.in_main = True
        if self.in_main and tag in ('script', 'style'):
            self.hidden += 1

    def handle_endtag(self, tag):
        if tag == 'title':
            self.in_title = False
        if self.in_main and tag in ('script', 'style'):
            self.hidden -= 1
        if tag == 'main':
            self.in_main = False

    def handle_data(self, data):
        if self.in_title:
            self.title += data
        if self.in_main and not self.hidden:
            self.parts.append(data.strip())


pages = []
for path in sorted(ROOT.rglob('*.html')):
    relative = path.relative_to(ROOT).as_posix()
    if relative.startswith(('archive/', 'forum/')) or relative in ('login.html', 'search.html'):
        continue
    content = PublicContent()
    content.feed(path.read_text(encoding='utf-8'))
    body = ' '.join(filter(None, content.parts))
    if body:
        pages.append({'url': '/' + relative,
                      'title': content.title.replace(' - 狰州市公安局', ''),
                      'text': body})

(ROOT / 'assets/search-index.json').write_text(
    json.dumps(pages, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print('已索引 %d 个公开页面。' % len(pages))
