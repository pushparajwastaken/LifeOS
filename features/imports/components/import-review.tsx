import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { SubmitButton } from '@/features/quests/components/submit-button'
import { resolveNotice } from '@/features/quests/quest-notices'
import styles from '@/features/quests/quests.module.css'
import { RESOURCE_TYPE_LABELS, type ResourceType } from '@/features/resources/resource-domain'
import { cancelImportAction, confirmImportAction } from '../import-actions'
import type { ImportCandidate, ImportRunData } from '../import-service'
import { RUN_STATUS_LABELS } from './import-home'
import { SelectionControls } from './selection-controls'

function groupByFolder(candidates: ImportCandidate[]) {
  const groups = new Map<string, ImportCandidate[]>()
  for (const candidate of candidates) {
    const key = candidate.folder_path ?? 'No folder'
    const list = groups.get(key)
    if (list) list.push(candidate)
    else groups.set(key, [candidate])
  }
  return [...groups.entries()]
}

export function ImportReview({ data, timeZone, notice }: { data: ImportRunData; timeZone: string; notice?: string }) {
  const { run, candidates } = data
  const message = resolveNotice(notice)
  const dateFormat = new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  const newCount = candidates.filter((c) => !c.already_in_library).length

  return (
    <div className={styles.page}>
      <Link href="/library/import" className={styles.subtleLink}><ArrowLeft size={14} aria-hidden="true" /> Imports</Link>
      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>{run.status === 'staged' ? 'STEP 2 OF 2 · REVIEW' : 'IMPORT SUMMARY'} · {run.file_name?.toUpperCase() ?? 'BOOKMARKS FILE'}</p>
          <h1>{run.status === 'staged' ? 'Choose what to import.' : RUN_STATUS_LABELS[run.status]}</h1>
          <p className={styles.heroCopy}>
            {run.items_seen} links in the file · {run.items_staged} unique and importable · {run.items_skipped} skipped (bookmarklets, browser-internal links or repeats)
            {run.status === 'staged' ? ` · ${newCount} new, ${candidates.length - newCount} already in your library` : ''}
          </p>
        </div>
      </header>

      {message ? <p className={message.tone === 'error' ? styles.errorNotice : styles.notice} role={message.tone === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
      {data.hasLoadError ? <p className={styles.errorNotice} role="alert">Some staged links could not be loaded. Refresh to try again.</p> : null}

      {run.status === 'completed' ? (
        <section className={styles.panel} aria-labelledby="summary-title">
          <div className={styles.sectionHeader}><div><p className={styles.kicker}>DONE</p><h2 id="summary-title">Import summary</h2></div></div>
          <dl className={styles.factList}>
            <dt>New resources</dt><dd>{run.items_imported}</dd>
            <dt>Already in your library</dt><dd>{run.items_duplicate} (left unchanged, provenance recorded)</dd>
            <dt>Skipped in the file</dt><dd>{run.items_skipped}</dd>
            <dt>Finished</dt><dd>{run.completed_at ? dateFormat.format(new Date(run.completed_at)) : '—'}</dd>
          </dl>
          <div className={styles.inlineForm}>
            <Link href="/library" className={styles.primaryLink}>Open library</Link>
            <Link href="/library/import" className={styles.subtleLink}>Import another file</Link>
          </div>
        </section>
      ) : run.status !== 'staged' ? (
        <section className={styles.panel}><p className={styles.mutedNote}>This import is {RUN_STATUS_LABELS[run.status].toLowerCase()}. Staged links are only kept for 24 hours; upload the file again to start over.</p></section>
      ) : (
        <section className={styles.panel} aria-labelledby="review-title">
          <div className={styles.sectionHeader}>
            <div><p className={styles.kicker}>REVIEW BEFORE {dateFormat.format(new Date(run.expires_at)).toUpperCase()}</p><h2 id="review-title">Staged links</h2></div>
          </div>
          <SelectionControls formId="import-review-form" />
          <form id="import-review-form" action={confirmImportAction} className={styles.editorForm}>
            <input type="hidden" name="runId" value={run.id} />
            {groupByFolder(candidates).map(([folder, items]) => (
              <fieldset key={folder} style={{ border: 0, padding: 0, margin: '16px 0 0' }}>
                <legend className={styles.kicker}>{folder.toUpperCase()} · {items.length}</legend>
                <ul className={styles.itemList}>
                  {items.map((candidate) => (
                    <li key={candidate.id} className={styles.linkRow}>
                      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minWidth: 0, flex: 1 }}>
                        <input type="checkbox" name="candidate" value={candidate.id} defaultChecked={!candidate.already_in_library} data-existing={candidate.already_in_library} style={{ marginTop: 3 }} />
                        <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                          {candidate.title ?? candidate.url}
                          <span className={styles.itemMeta}>
                            {RESOURCE_TYPE_LABELS[candidate.resource_type as ResourceType] ?? candidate.resource_type} · {new URL(candidate.url).hostname.replace(/^www\./, '')}
                            {candidate.already_in_library ? ' · Already in your library (will not be changed)' : ''}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            ))}
            {data.quests.length > 0 ? (
              <label style={{ display: 'grid', gap: 6, marginTop: 18, fontSize: 13 }}>
                Also attach the imported links to a side quest (optional)
                <select name="questId" className={styles.nativeSelect} defaultValue="">
                  <option value="">Don&apos;t attach</option>
                  {data.quests.map((quest) => <option key={quest.id} value={quest.id}>{quest.title}</option>)}
                </select>
              </label>
            ) : null}
            <div className={styles.editorFooter}><SubmitButton pendingLabel="Importing…">Import selected</SubmitButton></div>
          </form>
          <form action={cancelImportAction} className={styles.inlineForm}>
            <input type="hidden" name="runId" value={run.id} />
            <SubmitButton variant="ghost" pendingLabel="Cancelling…">Cancel import</SubmitButton>
          </form>
        </section>
      )}
    </div>
  )
}
