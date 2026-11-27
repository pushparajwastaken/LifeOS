import Link from 'next/link'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { SubmitButton } from '@/features/quests/components/submit-button'
import { resolveNotice } from '@/features/quests/quest-notices'
import styles from '@/features/quests/quests.module.css'
import { deleteNoteAction, linkNoteToQuestAction, unlinkNoteFromQuestAction, updateNoteAction } from '../note-actions'
import { NOTE_TYPE_LABELS, isSafeHttpUrl } from '../note-domain'
import type { NoteDetailData } from '../note-service'
import type { NoteConnections } from '../note-connections'
import { NoteConnectionsPanel } from './note-connections-panel'
import { NoteEditorForm } from './note-editor-form'

export function NoteDetail({ data, connections, timeZone, notice }: { data: NoteDetailData; connections: NoteConnections; timeZone: string; notice?: string }) {
  const { note } = data
  const message = resolveNotice(notice)
  const returnTo = `/knowledge/${note.id}`
  const dateFormat = new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric', year: 'numeric' })
  return (
    <div className={styles.page}>
      <Link href="/knowledge" className={styles.subtleLink}><ArrowLeft size={14} aria-hidden="true" /> All notes</Link>
      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>{NOTE_TYPE_LABELS[note.note_type].toUpperCase()} · UPDATED {dateFormat.format(new Date(note.updated_at)).toUpperCase()}</p>
          <h1>{note.title}</h1>
          {note.source_url && isSafeHttpUrl(note.source_url) ? (
            <a className={styles.subtleLink} href={note.source_url} target="_blank" rel="noopener noreferrer nofollow">
              Source <ExternalLink size={13} aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </header>

      {message ? <p className={message.tone === 'error' ? styles.errorNotice : styles.notice} role={message.tone === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
      {data.hasLoadError ? <p className={styles.errorNotice} role="alert">Some links could not be loaded. Refresh to try again.</p> : null}

      <div className={styles.detailGrid}>
        <div className={styles.stack}>
          <section className={styles.panel} aria-label="Note">
            {note.body ? <p className={styles.noteBody}>{note.body}</p> : <p className={styles.mutedNote}>This note has no text yet.</p>}
          </section>
          <section className={styles.panel} aria-labelledby="edit-note-title">
            <details className={styles.createDetails}>
              <summary id="edit-note-title">Edit note</summary>
              <NoteEditorForm action={updateNoteAction} note={note} submitLabel="Save note" />
            </details>
          </section>
        </div>

        <div className={styles.stack}>
          <section className={styles.panel} aria-labelledby="note-quests-title">
            <div className={styles.sectionHeader}><div><p className={styles.kicker}>SIDE QUESTS</p><h2 id="note-quests-title">Linked quests</h2></div></div>
            {data.linkedQuests.length > 0 ? (
              <ul className={styles.itemList}>
                {data.linkedQuests.map((quest) => (
                  <li key={quest.id} className={styles.linkRow}>
                    <Link href={`/quests/${quest.id}`}>{quest.title}</Link>
                    <form action={unlinkNoteFromQuestAction}>
                      <input type="hidden" name="noteId" value={note.id} />
                      <input type="hidden" name="questId" value={quest.id} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <SubmitButton variant="ghost" size="sm" pendingLabel="Unlinking…" ariaLabel={`Unlink from “${quest.title}”`}>Unlink</SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            ) : <p className={styles.mutedNote}>Not linked to any quest.</p>}
            {data.questOptions.length > 0 ? (
              <form action={linkNoteToQuestAction} className={styles.inlineForm}>
                <input type="hidden" name="noteId" value={note.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <label className="sr-only" htmlFor="link-quest">Quest to link</label>
                <select id="link-quest" name="questId" className={styles.nativeSelect} required defaultValue="">
                  <option value="" disabled>Choose a quest…</option>
                  {data.questOptions.map((quest) => <option key={quest.id} value={quest.id}>{quest.title}</option>)}
                </select>
                <SubmitButton variant="outline" pendingLabel="Linking…">Link</SubmitButton>
              </form>
            ) : null}
          </section>

          <NoteConnectionsPanel noteId={note.id} data={connections} />

          <section className={`${styles.panel} ${styles.dangerZone}`} aria-label="Delete note">
            <details>
              <summary>Delete this note</summary>
              <p className={styles.mutedNote}>
                {data.linkedQuests.length > 0
                  ? `This note is linked to ${data.linkedQuests.length === 1 ? '1 quest' : `${data.linkedQuests.length} quests`}: ${data.linkedQuests.map((quest) => quest.title).join(', ')}. Deleting removes those links; the quests are kept.`
                  : 'Deleting this note cannot be undone.'}
              </p>
              <form action={deleteNoteAction} className={styles.confirmRow}>
                <input type="hidden" name="noteId" value={note.id} />
                <label><input type="checkbox" name="confirm" value="delete" required /> I understand this cannot be undone</label>
                <SubmitButton variant="destructive" pendingLabel="Deleting…">Delete note</SubmitButton>
              </form>
            </details>
          </section>
        </div>
      </div>
    </div>
  )
}
