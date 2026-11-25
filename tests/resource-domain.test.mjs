import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canonicalizeUrl,
  getResourceStatusUpdate,
  parseResourceFilters,
  resourceInputSchema,
  titleFromUrl,
} from '../features/resources/resource-domain.ts'

const canon = (input) => {
  const result = canonicalizeUrl(input)
  assert.ok(result.ok, `${input} should be accepted (${result.reason})`)
  return result.value
}

test('rejects dangerous and invalid URLs', () => {
  for (const [input, reason] of [
    ['javascript:alert(1)', 'unsupported_scheme'],
    ['JAVASCRIPT:alert(1)', 'unsupported_scheme'],
    ['data:text/html,<script>1</script>', 'unsupported_scheme'],
    ['file:///etc/passwd', 'unsupported_scheme'],
    ['ftp://example.com/x', 'unsupported_scheme'],
    ['mailto:a@b.c', 'unsupported_scheme'],
    ['', 'invalid'],
    ['not a url', 'invalid'],
    ['example.com/no-scheme', 'invalid'],
    ['https://user:pass@example.com/', 'invalid'],
    [`https://example.com/${'a'.repeat(2100)}`, 'too_long'],
  ]) {
    const result = canonicalizeUrl(input)
    assert.equal(result.ok, false, input)
    assert.equal(result.reason, reason, input)
  }
})

test('normalises host, scheme, port, fragment, trailing slash and query order', () => {
  const expected = 'https://example.com/guide?a=1&b=2'
  for (const variant of [
    'https://example.com/guide?b=2&a=1',
    'http://www.Example.COM/guide/?a=1&b=2#section',
    'https://example.com:443/guide?a=1&b=2',
    'http://example.com:80/guide/?b=2&a=1',
    'https://EXAMPLE.com./guide?a=1&b=2&utm_source=x&utm_medium=y&fbclid=z&gclid=q',
  ]) {
    assert.equal(canon(variant).canonical, expected, variant)
  }
  assert.equal(canon('https://example.com/').canonical, 'https://example.com')
  assert.equal(canon('https://example.com:8443/a').canonical, 'https://example.com:8443/a')
  assert.notEqual(canon('https://example.com/a?id=1').canonical, canon('https://example.com/a?id=2').canonical, 'meaningful params kept')
})

test('keeps the original URL (minus fragment) for display', () => {
  const value = canon('https://Example.com/Path?utm_source=x#frag')
  assert.equal(value.url, 'https://example.com/Path?utm_source=x')
})

test('YouTube video and playlist URLs collapse to one form', () => {
  const video = 'https://youtube.com/watch?v=dQw4w9WgXcQ'
  for (const variant of [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ?si=abc123&t=42',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ&feature=share',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL1234567890&index=3',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    'https://www.youtube.com/live/dQw4w9WgXcQ',
  ]) {
    const value = canon(variant)
    assert.equal(value.canonical, video, variant)
    assert.equal(value.inferredType, 'video')
  }
  const playlist = canon('https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG&si=zz')
  assert.equal(playlist.canonical, 'https://youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG')
  assert.equal(playlist.inferredType, 'playlist')
  // malformed ids fall back to ordinary URL handling rather than a wrong canonical
  assert.equal(canon('https://www.youtube.com/watch?v=short').canonical, 'https://youtube.com/watch?v=short')
})

test('X and Twitter post URLs collapse to one form', () => {
  for (const variant of [
    'https://x.com/someone/status/1790000000000000000',
    'https://twitter.com/someone/status/1790000000000000000?s=20&t=abc',
    'https://mobile.twitter.com/someone/status/1790000000000000000/photo/1',
    'https://x.com/i/web/status/1790000000000000000',
  ]) {
    const value = canon(variant)
    assert.equal(value.canonical, 'https://x.com/i/status/1790000000000000000', variant)
    assert.equal(value.inferredType, 'post')
  }
})

test('infers a sensible default resource type', () => {
  assert.equal(canon('https://github.com/torvalds/linux').inferredType, 'repository')
  assert.equal(canon('https://arxiv.org/abs/1706.03762').inferredType, 'paper')
  assert.equal(canon('https://example.com/paper.pdf').inferredType, 'paper')
  assert.equal(canon('https://developer.mozilla.org/en-US/docs/Web').inferredType, 'documentation')
  assert.equal(canon('https://docs.python.org/3/').inferredType, 'documentation')
  assert.equal(canon('https://blog.example.com/post').inferredType, 'article')
})

test('input validation, fallback titles, status updates, filters', () => {
  assert.equal(resourceInputSchema.safeParse({ url: '', title: '', resourceType: '', category: '', notes: '' }).success, false)
  const parsed = resourceInputSchema.parse({ url: ' https://example.com ', title: ' ', resourceType: '', category: '', notes: '' })
  assert.equal(parsed.title, null)
  assert.equal(parsed.resourceType, null)
  assert.equal(resourceInputSchema.safeParse({ url: 'https://example.com', title: '', resourceType: 'podcast', category: '', notes: '' }).success, false)
  assert.equal(titleFromUrl(canon('https://example.com/how-caches-work.html')), 'how caches work · example.com')
  assert.equal(titleFromUrl(canon('https://example.com/')), 'example.com')
  assert.deepEqual(getResourceStatusUpdate('saved', new Date('2026-11-26T00:00:00Z')), { status: 'saved', completed_at: null })
  assert.equal(getResourceStatusUpdate('completed', new Date('2026-11-26T00:00:00Z')).completed_at, '2026-11-26T00:00:00.000Z')
  assert.deepEqual(parseResourceFilters({}), { status: 'active', type: 'all', questId: null, query: null })
  assert.deepEqual(parseResourceFilters({ status: 'completed', type: 'video', quest: 'bad', q: '  cache  lines ' }), { status: 'completed', type: 'video', questId: null, query: 'cache lines' })
})
