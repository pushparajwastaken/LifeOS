// Service worker: accepts bookmark requests only from the allowlisted LifeOS origins (top frame, real tab)
// and opens the approval window. Bookmarks are read only in the approval window, after the user agrees.
importScripts('config.js', 'lib.js')

const lib = self.LifeOSLib
const ALLOWED = self.LIFEOS_CONFIG.allowedOrigins

async function getPending() {
  const { pending } = await chrome.storage.session.get('pending')
  return pending || null
}

async function notifyTab(pending, message) {
  const options = pending.documentId ? { documentId: pending.documentId } : { frameId: 0 }
  try {
    await chrome.tabs.sendMessage(pending.tabId, message, options)
  } catch (_) {
    // The tab was closed or navigated away; nothing to tell.
  }
}

async function cancelPending(pending) {
  await chrome.storage.session.remove('pending')
  await notifyTab(pending, { type: 'bookmarks-result', requestId: pending.requestId, status: 'cancelled' })
  if (pending.windowId) {
    try {
      await chrome.windows.remove(pending.windowId)
    } catch (_) {
      // Already closed.
    }
  }
}

async function handleRequest(message, sender) {
  const origin = sender.origin || lib.originOf(sender.url)
  if (!sender.tab || typeof sender.tab.id !== 'number' || sender.frameId !== 0) return { ok: false }
  if (!lib.isAllowedOrigin(origin, ALLOWED) || !lib.isRequestId(message.requestId)) return { ok: false }

  const previous = await getPending()
  if (previous) await cancelPending(previous)

  const pending = { requestId: message.requestId, tabId: sender.tab.id, documentId: sender.documentId || null, origin, windowId: null, createdAt: Date.now() }
  await chrome.storage.session.set({ pending })
  const created = await chrome.windows.create({ url: chrome.runtime.getURL('approve.html'), type: 'popup', width: 520, height: 680, focused: true })
  const current = await getPending()
  if (current && current.requestId === pending.requestId) await chrome.storage.session.set({ pending: Object.assign(current, { windowId: created.id }) })
  return { ok: true }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !message || message.type !== 'request-bookmarks') return undefined
  handleRequest(message, sender).then(sendResponse, () => sendResponse({ ok: false }))
  return true
})

// Closing the approval window without choosing counts as cancelling.
chrome.windows.onRemoved.addListener(async (windowId) => {
  const pending = await getPending()
  if (pending && pending.windowId === windowId) await cancelPending(pending)
})
