;(async function () {
  'use strict'
  const PERMISSION = { permissions: ['bookmarks'] }
  const status = document.getElementById('status')
  const revoke = document.getElementById('revoke')

  async function refresh() {
    const granted = await chrome.permissions.contains(PERMISSION)
    status.textContent = granted ? 'Bookmarks access: allowed (read-only).' : 'Bookmarks access: not allowed. You will be asked when you import.'
    revoke.hidden = !granted
  }

  revoke.addEventListener('click', async () => {
    await chrome.permissions.remove(PERMISSION)
    await refresh()
  })

  document.getElementById('open').addEventListener('click', async () => {
    const origin = globalThis.LIFEOS_CONFIG.allowedOrigins[0]
    await chrome.tabs.create({ url: `${origin}/library/import` })
    window.close()
  })

  await refresh()
})()
