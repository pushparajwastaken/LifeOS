import assert from 'node:assert/strict'
import test from 'node:test'
import { EXTENSION_LIMITS, parseExtensionPayload } from '../features/imports/extension-payload.ts'
import { canonicalizeUrl } from '../features/resources/resource-domain.ts'

const payload = (value) => JSON.stringify(value)

test('valid payload is re-canonicalised and de-duplicated on the server', () => {
  const result = parseExtensionPayload(payload({
    bookmarks: [
      { url: 'https://www.example.com/guide?utm_source=x', title: ' Guide\u0000 ', folderPath: 'Bookmarks bar', dateAdded: 1700000000000 },
      { url: 'https://example.com/guide', title: 'Same page' },
      { url: 'javascript:alert(1)', title: 'Bookmarklet' },
      { url: 'https://youtu.be/dQw4w9WgXcQ', title: null, folderPath: null, dateAdded: null },
    ],
    summary: { skipped: 2, duplicates: 1, truncated: false },
  }), canonicalizeUrl)
  assert.ok(!('error' in result))
  assert.equal(result.bookmarks.length, 2)
  assert.equal(result.bookmarks[0].canonical, 'https://example.com/guide')
  assert.equal(result.bookmarks[0].title, 'Guide')
  assert.equal(result.bookmarks[0].addedAt, '2023-11-14T22:13:20.000Z')
  assert.equal(result.bookmarks[1].inferredType, 'video')
  assert.equal(result.bookmarks[1].folderPath, '')
  assert.equal(result.skippedUnsupported, 3)
  assert.equal(result.duplicatesInFile, 2)
  assert.equal(result.total, 7)
  assert.equal(result.truncated, false)
})

test('malformed, oversized and empty payloads are rejected', () => {
  assert.deepEqual(parseExtensionPayload(null, canonicalizeUrl), { error: 'empty' })
  assert.deepEqual(parseExtensionPayload('', canonicalizeUrl), { error: 'empty' })
  assert.deepEqual(parseExtensionPayload('{not json', canonicalizeUrl), { error: 'invalid' })
  assert.deepEqual(parseExtensionPayload(payload({ bookmarks: 'x' }), canonicalizeUrl), { error: 'invalid' })
  assert.deepEqual(parseExtensionPayload(payload({ bookmarks: [] }), canonicalizeUrl), { error: 'invalid' })
  assert.deepEqual(parseExtensionPayload(payload({ bookmarks: [{ url: 42 }] }), canonicalizeUrl), { error: 'invalid' })
  assert.deepEqual(parseExtensionPayload(payload({ bookmarks: [{ url: `https://a.test/${'x'.repeat(EXTENSION_LIMITS.maxUrl)}` }] }), canonicalizeUrl), { error: 'invalid' })
  assert.deepEqual(parseExtensionPayload(payload({ bookmarks: [{ url: 'https://a.test', dateAdded: -5 }] }), canonicalizeUrl), { error: 'invalid' })
  assert.deepEqual(parseExtensionPayload('x'.repeat(EXTENSION_LIMITS.maxChars + 1), canonicalizeUrl), { error: 'too_large' })
  const tooMany = Array.from({ length: EXTENSION_LIMITS.maxBookmarks + 1 }, (_, i) => ({ url: `https://a.test/${i}` }))
  assert.deepEqual(parseExtensionPayload(payload({ bookmarks: tooMany }), canonicalizeUrl), { error: 'too_large' })
  assert.deepEqual(parseExtensionPayload(payload({ bookmarks: [{ url: 'file:///etc/passwd' }, { url: 'chrome://settings' }] }), canonicalizeUrl), { error: 'empty' })
})

test('titles and folder paths are cleaned and truncated; markup stays plain text', () => {
  const result = parseExtensionPayload(payload({
    bookmarks: [{ url: 'https://a.test/x', title: `<script>alert(1)</script>${'t'.repeat(900)}`, folderPath: 'f'.repeat(1500) }],
  }), canonicalizeUrl)
  assert.ok(!('error' in result))
  assert.equal(result.bookmarks[0].title.length, EXTENSION_LIMITS.maxTitle)
  assert.ok(result.bookmarks[0].title.startsWith('<script>'))
  assert.equal(result.bookmarks[0].folderPath.length, EXTENSION_LIMITS.maxFolderPath)
})
