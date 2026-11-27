import Link from 'next/link'
import { ArrowLeft, FileUp } from 'lucide-react'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { SubmitButton } from '@/features/quests/components/submit-button'
import { resolveNotice } from '@/features/quests/quest-notices'
import styles from '@/features/quests/quests.module.css'
import { stageChromeImportAction } from '../import-actions'
import { ExtensionImport } from './extension-import'
import type { ImportRun } from '../import-service'

export const RUN_STATUS_LABELS: Record<ImportRun['status'], string> = {
  staged: 'Waiting for your review',
  completed: 'Imported',
  failed: 'Failed',
  cancelled: 'Cancelled',
  expired: 'Expired',
}

export function ImportHome({ runs, hasLoadError, timeZone, notice }: { runs: ImportRun[]; hasLoadError: boolean; timeZone: string; notice?: string }) {
  const message = resolveNotice(notice)
  const dateFormat = new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  return (
    <div className={styles.page}>
      <Link href="/library" className={styles.subtleLink}><ArrowLeft size={14} aria-hidden="true" /> Library</Link>
      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>IMPORT · BROWSER BOOKMARKS</p>
          <h1>Bring in your bookmarks, then choose what to keep.</h1>
          <p className={styles.heroCopy}>Export your bookmarks as an HTML file (Chrome: Bookmark manager → ⋮ → Export bookmarks). Nothing is imported until you review the list and confirm. Links you already saved are never changed.</p>
        </div>
      </header>

      {message ? <p className={message.tone === 'error' ? styles.errorNotice : styles.notice} role={message.tone === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
      {hasLoadError ? <p className={styles.errorNotice} role="alert">Import history could not be loaded. Refresh to try again.</p> : null}

      <section className={styles.panel} aria-labelledby="upload-title">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>STEP 1 OF 2</p><h2 id="upload-title">Upload a bookmarks file</h2></div></div>
        <form action={stageChromeImportAction} className={styles.editorForm}>
          <Field>
            <FieldLabel htmlFor="bookmark-file">Bookmarks HTML file</FieldLabel>
            <input id="bookmark-file" name="file" type="file" accept=".html,.htm,text/html" required />
            <FieldDescription>Up to 5 MB and 5,000 links. Bookmarklets and browser-internal links are skipped. LifeOS does not visit any of the links.</FieldDescription>
          </Field>
          <div className={styles.editorFooter}><SubmitButton pendingLabel="Reading file…"><FileUp size={15} aria-hidden="true" /> Review bookmarks</SubmitButton></div>
        </form>
      </section>

      <ExtensionImport />

      <section className={styles.panel} aria-labelledby="history-title">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>IMPORT HISTORY</p><h2 id="history-title">Previous imports</h2></div></div>
        {runs.length > 0 ? (
          <ul className={styles.itemList}>
            {runs.map((run) => (
              <li key={run.id} className={styles.linkRow}>
                <span>
                  <Link href={`/library/import/${run.id}`}>{run.file_name ?? (run.provider === 'chrome_extension' ? 'Chrome bookmarks (extension)' : 'Bookmarks file')}</Link>
                  <span className={styles.itemMeta}>
                    {dateFormat.format(new Date(run.created_at))} · {run.items_staged} unique links
                    {run.status === 'completed' ? ` · ${run.items_imported} imported · ${run.items_duplicate} already saved` : ''}
                  </span>
                </span>
                <span className={styles.statusBadge} data-status={run.status === 'completed' ? 'completed' : run.status === 'staged' ? 'active' : 'paused'}>{RUN_STATUS_LABELS[run.status]}</span>
              </li>
            ))}
          </ul>
        ) : <p className={styles.mutedNote}>No imports yet.</p>}
      </section>
    </div>
  )
}
