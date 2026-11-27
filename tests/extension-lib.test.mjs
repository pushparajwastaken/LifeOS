import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import { buildConfig, buildManifest, parseArgs, validateOrigin } from '../scripts/build-extension.mjs'

const libSource = readFileSync(new URL('../extension/src/lib.js', import.meta.url), 'utf8')
const contentSource = readFileSync(new URL('../extension/src/content.js', import.meta.url), 'utf8')

function loadLib() {
  const context = vm.createContext({ URL })
  vm.runInContext(libSource, context)
  return context.LifeOSLib
}

const lib = loadLib()
const ID = '3f1c2b4a-9d8e-4f7a-8b6c-5d4e3f2a1b0c'

const TREE = [{
  id: '0', title: '', children: [
    { id: '1', title: 'Bookmarks bar', children: [
      { id: '10', title: 'Guide', url: 'https://example.com/guide', dateAdded: 1700000000123 },
      { id: '11', title: 'Bookmarklet', url: 'javascript:alert(1)' },
      { id: '12', title: 'Same again', url: 'https://example.com/guide' },
      { id: '13', title: 'Systems', children: [
        { id: '130', title: '  Video\n title ', url: 'https://www.youtube.com/watch?v=abc' },
        { id: '131', title: 'Internal', url: 'chrome://settings' },
      ] },
      { id: '14', title: 'Empty folder', children: [] },
    ] },
    { id: '2', title: 'Other bookmarks', children: [
      { id: '20', title: '', url: 'http://plain.example.org/' },
    ] },
  ],
}]

test('listFolders returns folders with direct bookmarks and readable paths', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(lib.listFolders(TREE))), [
    { id: '1', path: 'Bookmarks bar', count: 3 },
    { id: '13', path: 'Bookmarks bar / Systems', count: 2 },
    { id: '2', path: 'Other bookmarks', count: 1 },
  ])
})

test('collectBookmarks takes only selected folders, http(s) only, exact duplicates once', () => {
  const all = lib.collectBookmarks(TREE, ['1', '13', '2'])
  assert.equal(all.bookmarks.length, 3)
  assert.equal(all.skipped, 2)
  assert.equal(all.duplicates, 1)
  assert.equal(all.truncated, false)
  assert.deepEqual({ ...all.bookmarks[0] }, { url: 'https://example.com/guide', title: 'Guide', folderPath: 'Bookmarks bar', dateAdded: 1700000000123 })
  assert.deepEqual({ ...all.bookmarks[1] }, { url: 'https://www.youtube.com/watch?v=abc', title: 'Video title', folderPath: 'Bookmarks bar / Systems', dateAdded: null })
  assert.equal(all.bookmarks[2].title, null)

  const onlySystems = lib.collectBookmarks(TREE, ['13'])
  assert.deepEqual([...onlySystems.bookmarks.map((b) => b.url)], ['https://www.youtube.com/watch?v=abc'])
  assert.equal(lib.collectBookmarks(TREE, []).bookmarks.length, 0)
})

test('collectBookmarks stops at the bookmark limit and long URLs are skipped', () => {
  const many = Array.from({ length: lib.LIMITS.maxBookmarks + 5 }, (_, i) => ({ id: `b${i}`, title: `t${i}`, url: `https://example.com/${i}` }))
  many.push({ id: 'long', title: 'long', url: `https://example.com/${'a'.repeat(lib.LIMITS.maxUrl)}` })
  const result = lib.collectBookmarks([{ id: 'f', title: 'F', children: many }], ['f'])
  assert.equal(result.bookmarks.length, lib.LIMITS.maxBookmarks)
  assert.equal(result.truncated, true)
  assert.equal(result.skipped, 1)
})

test('parsePageMessage accepts only the LifeOS page protocol', () => {
  assert.deepEqual({ ...lib.parsePageMessage({ source: 'lifeos-page', version: 1, type: 'ping' }) }, { type: 'ping' })
  assert.deepEqual({ ...lib.parsePageMessage({ source: 'lifeos-page', version: 1, type: 'request-bookmarks', requestId: ID }) }, { type: 'request-bookmarks', requestId: ID })
  for (const bad of [null, 'x', { source: 'other', version: 1, type: 'ping' }, { source: 'lifeos-page', version: 2, type: 'ping' },
    { source: 'lifeos-page', version: 1, type: 'request-bookmarks', requestId: 'not-a-uuid' }, { source: 'lifeos-page', version: 1, type: 'eval' }]) {
    assert.equal(lib.parsePageMessage(bad), null)
  }
})

test('origin helpers compare exact origins', () => {
  assert.equal(lib.isAllowedOrigin('https://app.example.com', ['https://app.example.com']), true)
  assert.equal(lib.isAllowedOrigin('https://app.example.com.evil.test', ['https://app.example.com']), false)
  assert.equal(lib.isAllowedOrigin(undefined, ['https://app.example.com']), false)
  assert.equal(lib.originOf('https://app.example.com/library/import?x=1'), 'https://app.example.com')
  assert.equal(lib.originOf('not a url'), null)
})

test('build script accepts only https origins (or local http) without paths', () => {
  assert.equal(validateOrigin('https://app.example.com'), 'https://app.example.com')
  assert.equal(validateOrigin('https://app.example.com/'), 'https://app.example.com')
  assert.equal(validateOrigin('http://localhost:3000'), 'http://localhost:3000')
  for (const bad of ['http://app.example.com', 'https://app.example.com/library', 'https://user:pw@app.example.com', 'ftp://x.test', 'nonsense', 'https://*.example.com']) {
    assert.throws(() => validateOrigin(bad), bad)
  }
  assert.deepEqual(parseArgs([]), ['http://localhost:3000'])
  assert.deepEqual(parseArgs(['--origin', 'https://a.test', '--origin', 'https://a.test']), ['https://a.test'])
  assert.throws(() => parseArgs(['--evil']))
})

test('manifest asks for no host or bookmark permission up front', () => {
  const manifest = buildManifest(['https://app.example.com', 'http://localhost:3000'])
  assert.equal(manifest.manifest_version, 3)
  assert.deepEqual(manifest.permissions, ['storage'])
  assert.deepEqual(manifest.optional_permissions, ['bookmarks'])
  assert.equal(manifest.host_permissions, undefined)
  assert.equal(manifest.externally_connectable, undefined)
  assert.deepEqual(manifest.content_scripts[0].matches, ['https://app.example.com/*', 'http://localhost:3000/*'])
  assert.equal(manifest.content_scripts[0].all_frames, false)
  const context = vm.createContext({})
  vm.runInContext(buildConfig(['https://app.example.com']), context)
  assert.deepEqual([...context.LIFEOS_CONFIG.allowedOrigins], ['https://app.example.com'])
})

// Runs the real content script against fake window/chrome objects.
function runContentScript({ origin = 'http://localhost:3000', pathname = '/library/import', allowed = ['http://localhost:3000'], top = true } = {}) {
  const posted = []
  const sentToWorker = []
  const listeners = { message: [], runtime: [] }
  const window = {
    postMessage: (data, targetOrigin) => posted.push({ data, targetOrigin }),
    addEventListener: (type, fn) => listeners[type].push(fn),
  }
  window.top = top ? window : {}
  const chrome = {
    runtime: {
      id: 'ext-id',
      getManifest: () => ({ version: '0.1.0' }),
      sendMessage: (message) => { sentToWorker.push(message); return Promise.resolve({ ok: true }) },
      onMessage: { addListener: (fn) => listeners.runtime.push(fn) },
    },
  }
  const context = vm.createContext({ window, chrome, location: { origin, pathname }, URL, LIFEOS_CONFIG: { allowedOrigins: allowed } })
  vm.runInContext(libSource, context)
  vm.runInContext(contentSource, context)
  const fromPage = (data, overrides = {}) => listeners.message.forEach((fn) => fn({ source: window, origin, data, ...overrides }))
  const fromExtension = (message, sender = { id: 'ext-id' }) => listeners.runtime.forEach((fn) => fn(message, sender))
  return { posted, sentToWorker, fromPage, fromExtension, window }
}

test('content script announces itself and relays a request only from its own window and origin', () => {
  const env = runContentScript()
  assert.equal(env.posted[0].data.type, 'ready')
  assert.equal(env.posted[0].targetOrigin, 'http://localhost:3000')

  env.fromPage({ source: 'lifeos-page', version: 1, type: 'request-bookmarks', requestId: ID }, { origin: 'https://evil.test' })
  env.fromPage({ source: 'lifeos-page', version: 1, type: 'request-bookmarks', requestId: ID }, { source: {} })
  assert.equal(env.sentToWorker.length, 0)

  env.fromPage({ source: 'lifeos-page', version: 1, type: 'request-bookmarks', requestId: ID })
  assert.deepEqual(JSON.parse(JSON.stringify(env.sentToWorker)), [{ type: 'request-bookmarks', requestId: ID }])
})

test('content script forwards results only from its own extension and strips bookmarks unless approved', () => {
  const env = runContentScript()
  env.posted.length = 0
  env.fromExtension({ type: 'bookmarks-result', requestId: ID, status: 'approved', bookmarks: [{ url: 'https://a.test' }] }, { id: 'other-extension' })
  assert.equal(env.posted.length, 0)
  env.fromExtension({ type: 'bookmarks-result', requestId: ID, status: 'denied', bookmarks: [{ url: 'https://a.test' }] })
  assert.equal(env.posted[0].data.status, 'denied')
  assert.equal(env.posted[0].data.bookmarks, undefined)
  env.fromExtension({ type: 'bookmarks-result', requestId: ID, status: 'weird' })
  assert.equal(env.posted[1].data.status, 'error')
  env.fromExtension({ type: 'bookmarks-result', requestId: ID, status: 'approved', bookmarks: [{ url: 'https://a.test' }], summary: { skipped: 0 } })
  assert.equal(env.posted[2].data.bookmarks.length, 1)
  assert.equal(env.posted[2].targetOrigin, 'http://localhost:3000')
})

test('content script stays inert on other origins, in frames and off the import pages', () => {
  assert.equal(runContentScript({ origin: 'https://evil.test' }).posted.length, 0)
  assert.equal(runContentScript({ top: false }).posted.length, 0)
  const elsewhere = runContentScript({ pathname: '/tasks' })
  assert.equal(elsewhere.posted.length, 0)
  elsewhere.fromPage({ source: 'lifeos-page', version: 1, type: 'request-bookmarks', requestId: ID })
  assert.equal(elsewhere.sentToWorker.length, 0)
})
