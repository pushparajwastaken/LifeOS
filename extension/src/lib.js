// Shared, side-effect-free helpers for the LifeOS Bookmarks extension.
// Classic script (no modules) so the content script, service worker and extension pages can all load it.
// Exposes globalThis.LifeOSLib. Unit-tested in tests/extension-lib.test.mjs.
;(function (root) {
  'use strict'

  const LIMITS = Object.freeze({
    maxBookmarks: 5000,
    maxUrl: 2048,
    maxTitle: 500,
    maxFolderPath: 1000,
    // Keeps the JSON payload well under the app's 6 MB server-action body limit.
    maxPayloadChars: 4500000,
  })
  const PAGE_SOURCE = 'lifeos-page'
  const EXTENSION_SOURCE = 'lifeos-extension'
  const PROTOCOL_VERSION = 1
  const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

  function isAllowedOrigin(origin, allowed) {
    return typeof origin === 'string' && Array.isArray(allowed) && allowed.indexOf(origin) !== -1
  }

  function originOf(url) {
    try {
      return new URL(url).origin
    } catch (_) {
      return null
    }
  }

  function isRequestId(value) {
    return typeof value === 'string' && REQUEST_ID.test(value)
  }

  /** Accepts only well-formed messages from the LifeOS page; everything else is ignored. */
  function parsePageMessage(data) {
    if (!data || typeof data !== 'object' || data.source !== PAGE_SOURCE || data.version !== PROTOCOL_VERSION) return null
    if (data.type === 'ping') return { type: 'ping' }
    if (data.type === 'request-bookmarks' && isRequestId(data.requestId)) return { type: 'request-bookmarks', requestId: data.requestId }
    return null
  }

  function cleanText(value, max) {
    if (typeof value !== 'string') return ''
    return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
  }

  function isWebUrl(url) {
    if (typeof url !== 'string' || url.length === 0 || url.length > LIMITS.maxUrl) return false
    try {
      const parsed = new URL(url)
      return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname.length > 0
    } catch (_) {
      return false
    }
  }

  function walk(nodes, path, visit) {
    for (const node of nodes || []) {
      if (typeof node.url === 'string') {
        visit({ kind: 'bookmark', node, path })
      } else if (Array.isArray(node.children)) {
        const title = cleanText(node.title, 200)
        const nextPath = title ? path.concat(title) : path
        visit({ kind: 'folder', node, path: nextPath })
        walk(node.children, nextPath, visit)
      }
    }
  }

  /** Folders that directly contain at least one bookmark, in tree order. */
  function listFolders(tree) {
    const folders = []
    walk(tree, [], (entry) => {
      if (entry.kind !== 'folder') return
      const direct = entry.node.children.filter((child) => typeof child.url === 'string').length
      if (direct > 0) folders.push({ id: String(entry.node.id), path: entry.path.join(' / ') || 'Bookmarks', count: direct })
    })
    return folders
  }

  /**
   * Bookmarks directly inside the selected folders. Only http(s) links are kept; exact duplicates keep the
   * first occurrence. Stops at LIMITS.maxBookmarks or the payload size budget (truncated = true).
   */
  function collectBookmarks(tree, selectedFolderIds) {
    const selected = new Set(Array.from(selectedFolderIds || [], String))
    const seen = new Set()
    const bookmarks = []
    let skipped = 0
    let duplicates = 0
    let truncated = false
    let chars = 0
    walk(tree, [], (entry) => {
      if (entry.kind !== 'folder' || !selected.has(String(entry.node.id))) return
      const folderPath = entry.path.join(' / ').slice(0, LIMITS.maxFolderPath)
      for (const child of entry.node.children) {
        if (typeof child.url !== 'string') continue
        if (!isWebUrl(child.url)) {
          skipped += 1
          continue
        }
        if (seen.has(child.url)) {
          duplicates += 1
          continue
        }
        const item = {
          url: child.url,
          title: cleanText(child.title, LIMITS.maxTitle) || null,
          folderPath: folderPath || null,
          dateAdded: typeof child.dateAdded === 'number' && Number.isFinite(child.dateAdded) && child.dateAdded > 0 ? Math.floor(child.dateAdded) : null,
        }
        const size = item.url.length + (item.title ? item.title.length : 0) + (item.folderPath ? item.folderPath.length : 0) + 64
        if (bookmarks.length >= LIMITS.maxBookmarks || chars + size > LIMITS.maxPayloadChars) {
          truncated = true
          continue
        }
        seen.add(child.url)
        chars += size
        bookmarks.push(item)
      }
    })
    return { bookmarks, skipped, duplicates, truncated }
  }

  root.LifeOSLib = Object.freeze({
    LIMITS,
    PAGE_SOURCE,
    EXTENSION_SOURCE,
    PROTOCOL_VERSION,
    isAllowedOrigin,
    originOf,
    isRequestId,
    parsePageMessage,
    listFolders,
    collectBookmarks,
  })
})(globalThis)
