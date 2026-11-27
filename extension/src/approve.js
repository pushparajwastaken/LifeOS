// Approval window. Reads bookmarks only after the user grants the optional permission and ticks folders,
// and sends them once, to the exact LifeOS tab and document that asked. All text is set with textContent.
;(async function () {
  'use strict'
  const lib = globalThis.LifeOSLib
  const allowed = globalThis.LIFEOS_CONFIG.allowedOrigins
  const $ = (id) => document.getElementById(id)
  const PERMISSION = { permissions: ['bookmarks'] }
  let tree = null
  let finished = false

  const { pending } = await chrome.storage.session.get('pending')
  if (!pending || !lib.isAllowedOrigin(pending.origin, allowed)) {
    $('intro').textContent = 'There is no request waiting. Start from the import page in LifeOS.'
    $('deny').textContent = 'Close'
    $('deny').addEventListener('click', () => window.close())
    return
  }
  $('intro').textContent = `LifeOS at ${pending.origin} asks for your bookmarks. Only the folders you tick are sent, once, to that tab. LifeOS shows every link for review before anything is saved, and never visits the links.`

  async function finish(message, status) {
    if (finished) return false
    finished = true
    await chrome.storage.session.remove('pending')
    const options = pending.documentId ? { documentId: pending.documentId } : { frameId: 0 }
    try {
      await chrome.tabs.sendMessage(pending.tabId, Object.assign({ type: 'bookmarks-result', requestId: pending.requestId, status }, message), options)
      return true
    } catch (_) {
      return false
    }
  }

  function selectedIds() {
    return Array.from(document.querySelectorAll('#folders input:checked'), (input) => input.value)
  }

  function updateCount() {
    if (!tree) return
    const result = lib.collectBookmarks(tree, selectedIds())
    const send = $('send')
    send.disabled = result.bookmarks.length === 0
    send.textContent = `Send ${result.bookmarks.length.toLocaleString('en-US')} bookmark${result.bookmarks.length === 1 ? '' : 's'}`
    $('message').textContent = result.truncated ? `Only the first ${lib.LIMITS.maxBookmarks.toLocaleString('en-US')} links fit in one import; untick some folders or send the rest later.` : ''
  }

  function renderFolders() {
    const list = $('folders')
    list.replaceChildren()
    for (const folder of lib.listFolders(tree)) {
      const item = document.createElement('li')
      const label = document.createElement('label')
      label.className = 'check'
      const input = document.createElement('input')
      input.type = 'checkbox'
      input.value = folder.id
      input.checked = true
      input.addEventListener('change', updateCount)
      const name = document.createElement('span')
      name.textContent = folder.path
      const count = document.createElement('span')
      count.className = 'muted'
      count.textContent = ` (${folder.count})`
      label.append(input, name, count)
      item.append(label)
      list.append(item)
    }
    if (!list.children.length) $('message').textContent = 'No bookmarks were found.'
  }

  async function loadTree() {
    tree = await chrome.bookmarks.getTree()
    $('grant').hidden = true
    $('choose').hidden = false
    $('send').hidden = false
    renderFolders()
    updateCount()
  }

  function setAll(checked) {
    for (const input of document.querySelectorAll('#folders input')) input.checked = checked
    updateCount()
  }

  $('select-all').addEventListener('click', () => setAll(true))
  $('select-none').addEventListener('click', () => setAll(false))

  $('grant-button').addEventListener('click', async () => {
    const granted = await chrome.permissions.request(PERMISSION)
    if (granted) await loadTree()
    else $('message').textContent = 'Permission was not granted. Nothing was read.'
  })

  $('deny').addEventListener('click', async () => {
    await finish({}, 'denied')
    window.close()
  })

  $('send').addEventListener('click', async () => {
    const result = lib.collectBookmarks(tree, selectedIds())
    if (result.bookmarks.length === 0) return
    $('send').disabled = true
    const delivered = await finish({
      bookmarks: result.bookmarks,
      summary: { skipped: result.skipped, duplicates: result.duplicates, truncated: result.truncated },
    }, 'approved')
    if ($('revoke').checked) await chrome.permissions.remove(PERMISSION)
    if (!delivered) {
      $('message').textContent = 'The LifeOS tab was closed or moved to another page, so nothing was sent. Start again from the import page.'
      $('send').hidden = true
      $('deny').textContent = 'Close'
      return
    }
    window.close()
  })

  if (await chrome.permissions.contains(PERMISSION)) await loadTree()
  else $('grant').hidden = false
})()
