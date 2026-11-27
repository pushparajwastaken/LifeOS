// Content script: relays between the LifeOS page and the extension. Runs only on the origins in config.js
// (the manifest's match patterns are generated from the same list). It never reads bookmarks itself and
// never touches the page's DOM beyond window.postMessage to its own origin.
;(function () {
  'use strict'
  const lib = globalThis.LifeOSLib
  const allowed = globalThis.LIFEOS_CONFIG && globalThis.LIFEOS_CONFIG.allowedOrigins
  if (!lib || window.top !== window || !lib.isAllowedOrigin(location.origin, allowed)) return

  function post(payload) {
    window.postMessage(Object.assign({ source: lib.EXTENSION_SOURCE, version: lib.PROTOCOL_VERSION }, payload), location.origin)
  }

  function announce() {
    post({ type: 'ready', extensionVersion: chrome.runtime.getManifest().version })
  }

  function onImportPage() {
    return location.pathname === '/library/import' || location.pathname.indexOf('/library/import/') === 0
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== location.origin) return
    const message = lib.parsePageMessage(event.data)
    if (!message || !onImportPage()) return
    if (message.type === 'ping') {
      announce()
      return
    }
    const fail = () => post({ type: 'bookmarks-result', requestId: message.requestId, status: 'error' })
    chrome.runtime.sendMessage({ type: 'request-bookmarks', requestId: message.requestId }).then((response) => {
      if (!response || response.ok !== true) fail()
    }, fail)
  })

  chrome.runtime.onMessage.addListener((message, sender) => {
    if (sender.id !== chrome.runtime.id || !message || message.type !== 'bookmarks-result' || !lib.isRequestId(message.requestId)) return
    const status = ['approved', 'denied', 'cancelled'].indexOf(message.status) !== -1 ? message.status : 'error'
    post({
      type: 'bookmarks-result',
      requestId: message.requestId,
      status,
      bookmarks: status === 'approved' && Array.isArray(message.bookmarks) ? message.bookmarks : undefined,
      summary: status === 'approved' ? message.summary : undefined,
    })
  })

  if (onImportPage()) announce()
})()
