import Link from 'next/link'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { createNoteAction, linkNoteToQuestAction, unlinkNoteFromQuestAction } from '@/features/notes/note-actions'
import { NOTE_LIMITS, NOTE_TYPE_LABELS, type NoteType } from '@/features/notes/note-domain'
import type { LinkedNote, NoteOption } from '../quest-service'
import styles from '../quests.module.css'
import { SubmitButton } from './submit-button'

type QuestNotesPanelProps = {
  questId: string
  notes: LinkedNote[]
  noteOptions: NoteOption[]
  noteQuery: string | null
}

export function QuestNotesPanel({ questId, notes, noteOptions, noteQuery }: QuestNotesPanelProps) {
  const returnTo = `/quests/${questId}`
  return (
    <section className={styles.panel} aria-labelledby="quest-notes-title">
      <div className={styles.sectionHeader}>
        <div><p className={styles.kicker}>FROM YOUR KNOWLEDGE VAULT</p><h2 id="quest-notes-title">Notes</h2></div>
        <Link href="/knowledge" className={styles.subtleLink}>All notes</Link>
      </div>

      {notes.length > 0 ? (
        <ul className={styles.itemList}>
          {notes.map((note) => (
            <li key={note.id} className={styles.linkRow}>
              <span>
                <Link href={`/knowledge/${note.id}`}>{note.title}</Link>
                <span className={styles.itemMeta}>{NOTE_TYPE_LABELS[note.note_type as NoteType] ?? note.note_type}</span>
              </span>
              <form action={unlinkNoteFromQuestAction}>
                <input type="hidden" name="noteId" value={note.id} />
                <input type="hidden" name="questId" value={questId} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <SubmitButton variant="ghost" size="sm" pendingLabel="Unlinking…" ariaLabel={`Unlink note “${note.title}” from this quest`}>Unlink</SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.mutedNote}>No notes yet. Notes live in your knowledge vault, so unlinking or deleting this quest never deletes them.</p>
      )}

      <details className={styles.createDetails}>
        <summary>Write a note</summary>
        <form action={createNoteAction} className={styles.editorForm}>
          <input type="hidden" name="questId" value={questId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <input type="hidden" name="noteType" value="research" />
          <input type="hidden" name="sourceUrl" value="" />
          <div className={styles.fieldGrid}>
            <Field className={styles.fieldWide}>
              <FieldLabel htmlFor="quest-note-title">Title</FieldLabel>
              <Input id="quest-note-title" name="title" required maxLength={NOTE_LIMITS.title} />
            </Field>
            <Field className={styles.fieldWide}>
              <FieldLabel htmlFor="quest-note-body">Note</FieldLabel>
              <Textarea id="quest-note-body" name="body" rows={6} maxLength={NOTE_LIMITS.body} />
            </Field>
          </div>
          <div className={styles.editorFooter}><SubmitButton pendingLabel="Saving…">Save note</SubmitButton></div>
        </form>
      </details>

      <details className={styles.createDetails} open={noteQuery !== null}>
        <summary>Link an existing note</summary>
        <form method="get" action={returnTo} className={styles.searchForm} role="search">
          <label className="sr-only" htmlFor="note-search">Search notes</label>
          <Input id="note-search" name="noteQuery" defaultValue={noteQuery ?? ''} placeholder="Search your notes" />
          <button type="submit" className={styles.subtleLink}>Search</button>
        </form>
        {noteOptions.length > 0 ? (
          <ul className={styles.itemList}>
            {noteOptions.map((note) => (
              <li key={note.id} className={styles.linkRow}>
                <span>{note.title}<span className={styles.itemMeta}>{NOTE_TYPE_LABELS[note.note_type as NoteType] ?? note.note_type}</span></span>
                <form action={linkNoteToQuestAction}>
                  <input type="hidden" name="noteId" value={note.id} />
                  <input type="hidden" name="questId" value={questId} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <SubmitButton variant="outline" size="sm" pendingLabel="Linking…" ariaLabel={`Link note “${note.title}”`}>Link</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.mutedNote}>{noteQuery ? 'No unlinked notes match that search.' : 'No other notes to link yet.'}</p>
        )}
      </details>
    </section>
  )
}
