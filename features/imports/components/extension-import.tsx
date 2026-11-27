'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Puzzle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import styles from '@/features/quests/quests.module.css'
import { stageExtensionImportAction } from '../import-actions'

// Protocol shared with extension/src/lib.js (content script). Messages are accepted only from this window
// and this origin, and a result is accepted only for the request id this page generated.
const PAGE_SOURCE = 'lifeos-page'
const EXTENSION_SOURCE = 'lifeos-extension'
const PROTOCOL_VERSION = 1
const DETECT_MS = 1500
const APPROVAL_TIMEOUT_MS = 10 * 60 * 1000

type Status = 'checking' | 'missing' | 'ready' | 'waiting' | 'sending' | 'denied' | 'cancelled' | 'error' | 'timeout'

const STATUS_TEXT: Partial<Record<Status, string>> = {
  waiting: 'Approve the request in the LifeOS Bookmarks window that just opened.',
  sending: 'Bookmarks received. Preparing your review…',
  denied: 'You chose not to send bookmarks. Nothing was read into LifeOS.',
  cancelled: 'The approval window was closed. Nothing was sent.',
  error: 'The extension could not start the request. Reload this page and try again.',
  timeout: 'No answer from the extension. Start again when you are ready.',
}

export function ExtensionImport() {
  const [status, setStatus] = useState<Status>('checking')
  const [version, setVersion] = useState<string | null>(null)
  const requestRef = useRef<string | null>(null)
  const timerRef = useRef<number | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const payloadRef = useRef<HTMLInputElement>(null)

  const post = useCallback((message: Record<string, unknown>) => {
    window.postMessage({ source: PAGE_SOURCE, version: PROTOCOL_VERSION, ...message }, window.location.origin)
  }, [])

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== window || event.origin !== window.location.origin) return
      const data = event.data as Record<string, unknown> | null
      if (!data || typeof data !== 'object' || data.source !== EXTENSION_SOURCE || data.version !== PROTOCOL_VERSION) return
      if (data.type === 'ready') {
        setVersion(typeof data.extensionVersion === 'string' ? data.extensionVersion.slice(0, 20) : null)
        setStatus((current) => (current === 'checking' || current === 'missing' ? 'ready' : current))
        return
      }
      if (data.type !== 'bookmarks-result' || !requestRef.current || data.requestId !== requestRef.current) return
      requestRef.current = null
      if (timerRef.current) window.clearTimeout(timerRef.current)
      if (data.status === 'approved' && Array.isArray(data.bookmarks) && payloadRef.current && formRef.current) {
        payloadRef.current.value = JSON.stringify({ bookmarks: data.bookmarks, summary: data.summary })
        setStatus('sending')
        formRef.current.requestSubmit()
        return
      }
      setStatus(data.status === 'denied' ? 'denied' : data.status === 'cancelled' ? 'cancelled' : 'error')
    }
    window.addEventListener('message', onMessage)
    post({ type: 'ping' })
    const detect = window.setTimeout(() => setStatus((current) => (current === 'checking' ? 'missing' : current)), DETECT_MS)
    return () => {
      window.removeEventListener('message', onMessage)
      window.clearTimeout(detect)
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [post])

  function requestBookmarks() {
    const requestId = crypto.randomUUID()
    requestRef.current = requestId
    setStatus('waiting')
    post({ type: 'request-bookmarks', requestId })
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      requestRef.current = null
      setStatus('timeout')
    }, APPROVAL_TIMEOUT_MS)
  }

  const busy = status === 'waiting' || status === 'sending'
  return (
    <section className={styles.panel} aria-labelledby="extension-title">
      <div className={styles.sectionHeader}><div><p className={styles.kicker}>OR USE THE EXTENSION</p><h2 id="extension-title">Choose folders straight from Chrome</h2></div></div>
      {status === 'checking' ? <p className={styles.mutedNote} role="status">Looking for the LifeOS Bookmarks extension…</p> : null}
      {status === 'missing' ? (
        <p className={styles.mutedNote}>The LifeOS Bookmarks extension is not installed in this browser. It is optional: the file upload above works without it. To try it, build it with <code>node scripts/build-extension.mjs</code> and load <code>extension/dist</code> as an unpacked extension (chrome://extensions → Developer mode).</p>
      ) : null}
      {status !== 'checking' && status !== 'missing' ? (
        <>
          <p className={styles.mutedNote}>Extension connected{version ? ` (version ${version})` : ''}. You pick folders and approve in an extension window; bookmark access is read-only and can be given back right after sending. The links are staged for review here, exactly like a file.</p>
          {STATUS_TEXT[status] ? <p className={status === 'error' || status === 'timeout' ? styles.errorNotice : styles.notice} role={status === 'error' || status === 'timeout' ? 'alert' : 'status'}>{STATUS_TEXT[status]}</p> : null}
          <div className={styles.editorFooter}>
            <Button type="button" onClick={requestBookmarks} disabled={busy}><Puzzle size={15} aria-hidden="true" /> {busy ? 'Waiting for approval…' : 'Choose bookmarks in Chrome'}</Button>
          </div>
        </>
      ) : null}
      <form ref={formRef} action={stageExtensionImportAction} hidden>
        <input ref={payloadRef} type="hidden" name="payload" />
      </form>
    </section>
  )
}
