import assert from 'node:assert/strict'
import test from 'node:test'
import { BOOKMARK_LIMITS, decodeEntities, parseBookmarksHtml } from '../features/imports/bookmark-parser.ts'
import { canonicalizeUrl } from '../features/resources/resource-domain.ts'

const CHROME_EXPORT = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file. -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1700000000" PERSONAL_TOOLBAR_FOLDER="true">Bookmarks bar</H3>
    <DL><p>
        <DT><A HREF="https://example.com/guide?utm_source=x" ADD_DATE="1700000100" ICON="data:image/png;base64,AAAA">Caches &amp; Coherence</A>
        <DT><H3 ADD_DATE="1700000200">Systems</H3>
        <DL><p>
            <DT><A HREF="https://www.youtube.com/watch?v=dQw4w9WgXcQ" ADD_DATE="1700000300">CPU video</A>
            <DT><A HREF="javascript:alert('bookmarklet')">Bookmarklet</A>
            <DT><A HREF="https://youtu.be/dQw4w9WgXcQ">Same video again</A>
        </DL><p>
        <DT><A HREF="chrome://settings">Settings</A>
    </DL><p>
    <DT><H3>Other bookmarks</H3>
    <DL><p>
        <DT><A HREF='https://arxiv.org/abs/1706.03762'>&lt;Attention&gt; &#8211; paper</A>
        <DT><A HREF="https://example.com/no-title"></A>
    </DL><p>
</DL><p>`

test('parses a Chrome export with nested folders, entities and dates', () => {
  const result = parseBookmarksHtml(CHROME_EXPORT, canonicalizeUrl)
  assert.ok(!('error' in result))
  assert.equal(result.total, 7)
  assert.equal(result.skippedUnsupported, 2, 'javascript: and chrome:// skipped')
  assert.equal(result.duplicatesInFile, 1, 'youtu.be duplicate of the watch URL')
  assert.equal(result.truncated, false)
  assert.deepEqual(result.bookmarks.map((b) => [b.title, b.folderPath, b.canonical]), [
    ['Caches & Coherence', 'Bookmarks bar', 'https://example.com/guide'],
    ['CPU video', 'Bookmarks bar / Systems', 'https://youtube.com/watch?v=dQw4w9WgXcQ'],
    ['<Attention> – paper', 'Other bookmarks', 'https://arxiv.org/abs/1706.03762'],
    [null, 'Other bookmarks', 'https://example.com/no-title'],
  ])
  assert.equal(result.bookmarks[0].addedAt, '2023-11-14T22:15:00.000Z')
  assert.equal(result.bookmarks[1].inferredType, 'video')
  assert.equal(result.bookmarks[2].inferredType, 'paper')
  assert.equal(result.bookmarks[3].addedAt, null)
})

test('rejects files that are not bookmark exports', () => {
  assert.deepEqual(parseBookmarksHtml('', canonicalizeUrl), { error: 'empty' })
  assert.deepEqual(parseBookmarksHtml('<html><body><p>hello</p></body></html>', canonicalizeUrl), { error: 'not_bookmark_file' })
  assert.deepEqual(parseBookmarksHtml('<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p></DL>', canonicalizeUrl), { error: 'empty' })
  assert.deepEqual(parseBookmarksHtml(`<DL>${'x'.repeat(BOOKMARK_LIMITS.maxBytes)}</DL>`, canonicalizeUrl), { error: 'too_large' })
})

test('caps the number of bookmarks per import', () => {
  const links = Array.from({ length: BOOKMARK_LIMITS.maxBookmarks + 3 }, (_, i) => `<DT><A HREF="https://example.com/p/${i}">P${i}</A>`).join('\n')
  const result = parseBookmarksHtml(`<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p>${links}</DL>`, canonicalizeUrl)
  assert.equal(result.bookmarks.length, BOOKMARK_LIMITS.maxBookmarks)
  assert.equal(result.truncated, true)
})

test('handles malformed markup without throwing', () => {
  const messy = '<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><DT><H3>Unclosed<DL><DT><A HREF=https://example.com/a>A</A></DL></DL></DL><DT><A>no href</A>'
  const result = parseBookmarksHtml(messy, canonicalizeUrl)
  assert.equal(result.bookmarks.length, 1)
  assert.equal(result.bookmarks[0].canonical, 'https://example.com/a')
  assert.equal(result.skippedUnsupported, 1)
})

test('decodes named and numeric entities', () => {
  assert.equal(decodeEntities('a &amp; b &lt;c&gt; &quot;d&quot; &#39;e&#39; &#x2014; &bogus;'), 'a & b <c> "d" \'e\' — &bogus;')
})
