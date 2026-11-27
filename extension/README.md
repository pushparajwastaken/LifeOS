# LifeOS Bookmarks (Chrome extension, M7)

Optional companion to the bookmark-file import. Lets you pick Chrome bookmark folders and send them to the
LifeOS import page, where they are reviewed exactly like an uploaded export. Nothing is saved until you confirm.

## Build and load
```
node scripts/build-extension.mjs                                   # local dev: http://localhost:3000
node scripts/build-extension.mjs --origin https://<your-lifeos-host>  # add every LifeOS origin it should work on
```
Then open `chrome://extensions`, enable Developer mode, choose **Load unpacked** and select `extension/dist`
(git-ignored). Rebuild and reload after changing the origin list.

## How it works
1. On `/library/import` the page posts `{source:'lifeos-page', type:'ping'}`; the content script answers `ready`.
2. **Choose bookmarks in Chrome** posts `request-bookmarks` with a random UUID request id.
3. The content script forwards it to the service worker, which accepts it only from a top-level frame of an
   allowlisted origin and opens the approval window (`approve.html`).
4. In that window you grant the optional, read-only `bookmarks` permission (first time), tick folders and
   press **Send**, or **Don't send**. Closing the window counts as cancelling. "Give back bookmarks access after
   sending" is ticked by default.
5. The result is sent only to the tab **and document** that asked (`documentId`), relayed to the page with
   `postMessage` targeted at that origin, and accepted by the page only for its own request id.
6. The page submits the JSON to the `stageExtensionImportAction` server action, which validates it (zod,
   5 MB / 5,000 links, http(s) only), re-canonicalises and de-duplicates it, and stages an `import_runs` row
   with provider `chrome_extension`. Resources imported from it get `origin = 'chrome_extension'`.

## Permissions
| Permission | Why |
|---|---|
| `storage` | `chrome.storage.session` holds the single pending request (cleared when finished). No warning. |
| `bookmarks` (optional) | Requested only from the approval window, on your click. Read-only use. |
| Content script on the configured LifeOS origins | Relays messages; does nothing outside `/library/import*`. Shown by Chrome as site access for those origins only. |

No `host_permissions`, no `tabs`, no `externally_connectable`, no remote code (`script-src 'self'`), and no
network requests from the extension. The extension never visits bookmarked links.

## Files
`src/lib.js` (pure helpers, unit-tested) · `src/content.js` · `src/background.js` · `src/approve.html/js` ·
`src/popup.html/js` (access status and "Give back access") · `src/ui.css`. Tests: `tests/extension-lib.test.mjs`.
