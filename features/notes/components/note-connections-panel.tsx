import Link from 'next/link'
import { BookOpen, Link2, Plus, Tag, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { IconSubmitButton } from '@/features/quests/components/icon-submit-button'
import { SubmitButton } from '@/features/quests/components/submit-button'
import styles from '@/features/quests/quests.module.css'
import { addNoteTagAction, linkNotesAction, removeNoteTagAction, unlinkNotesAction } from '../note-connection-actions'
import { NOTE_RELATIONS, RELATION_LABELS, TAG_MAX, type NoteConnections } from '../note-connections'

export function NoteConnectionsPanel({ noteId, data }: { noteId: string; data: NoteConnections }) {
  return (
    <section className={styles.panel} id="connections" aria-labelledby="connections-heading">
      <div className={styles.sectionHeader}><div><p className={styles.kicker}>CONNECTIONS</p><h2 id="connections-heading">Tags and links</h2></div></div>
      {data.hasLoadError ? <p className={styles.errorNotice} role="alert">Some connections could not be loaded.</p> : null}

      <h3 className={styles.kicker} style={{ marginTop: 4 }}>TAGS</h3>
      {data.tags.length ? (
        <ul style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 0, margin: '6px 0 0', listStyle: 'none' }}>
          {data.tags.map((tag) => (
            <li key={tag.id} className={styles.statusBadge} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: '100%' }}>
              <Tag size={11} aria-hidden="true" style={{ flexShrink: 0 }} /><span style={{ overflowWrap: 'anywhere' }}>{tag.name}</span>
              <form action={removeNoteTagAction} style={{ display: 'inline' }}>
                <input type="hidden" name="noteId" value={noteId} />
                <input type="hidden" name="tagId" value={tag.id} />
                <button type="submit" aria-label={`Remove tag ${tag.name}`} style={{ display: 'inline-grid', placeItems: 'center', border: 0, background: 'none', padding: 0, cursor: 'pointer', color: 'inherit' }}><X size={11} aria-hidden="true" /></button>
              </form>
            </li>
          ))}
        </ul>
      ) : <p className={styles.mutedNote} style={{ margin: '6px 0 0' }}>No tags yet.</p>}
      <form action={addNoteTagAction} className={styles.searchForm} style={{ marginTop: 8 }}>
        <input type="hidden" name="noteId" value={noteId} />
        <label className="sr-only" htmlFor="note-tag">Add a tag</label>
        <Input id="note-tag" name="tag" required maxLength={TAG_MAX} list="note-tag-suggestions" placeholder="Add a tag" />
        <datalist id="note-tag-suggestions">{data.tagSuggestions.map((name) => <option key={name} value={name} />)}</datalist>
        <SubmitButton variant="outline" size="sm" pendingLabel="Adding…"><Plus size={14} aria-hidden="true" /> Tag</SubmitButton>
      </form>

      <h3 className={styles.kicker} style={{ marginTop: 18 }}>LINKED NOTES</h3>
      {data.links.length ? (
        <ul className={styles.itemList}>
          {data.links.map((link) => (
            <li key={link.id} className={styles.checkItem}>
              <Link2 size={14} aria-hidden="true" />
              <span className={styles.itemTitle}><span className={styles.itemMeta} style={{ marginTop: 0 }}>{link.label}</span><Link href={`/knowledge/${link.noteId}`} style={{ overflowWrap: 'anywhere' }}>{link.title}</Link></span>
              <form action={unlinkNotesAction}>
                <input type="hidden" name="noteId" value={noteId} />
                <input type="hidden" name="linkId" value={link.id} />
                <IconSubmitButton label={`Remove the link to “${link.title}”`}><X size={14} aria-hidden="true" /></IconSubmitButton>
              </form>
            </li>
          ))}
        </ul>
      ) : <p className={styles.mutedNote} style={{ margin: '6px 0 0' }}>Not linked to other notes yet.</p>}
      {data.linkable.length ? (
        <form action={linkNotesAction} className={styles.searchForm} style={{ marginTop: 8 }}>
          <input type="hidden" name="noteId" value={noteId} />
          <label className="sr-only" htmlFor="note-relation">Relation</label>
          <select id="note-relation" name="relation" className={styles.nativeSelect} defaultValue="related" style={{ width: 'auto' }}>
            {NOTE_RELATIONS.map((relation) => <option key={relation} value={relation}>{RELATION_LABELS[relation].outgoing}</option>)}
          </select>
          <label className="sr-only" htmlFor="note-target">Note</label>
          <select id="note-target" name="targetId" className={styles.nativeSelect} required defaultValue="">
            <option value="" disabled>Choose a note…</option>
            {data.linkable.map((note) => <option key={note.id} value={note.id}>{note.title}</option>)}
          </select>
          <SubmitButton variant="outline" size="sm" pendingLabel="Linking…"><Link2 size={14} aria-hidden="true" /> Link</SubmitButton>
        </form>
      ) : null}

      {data.books.length ? (
        <>
          <h3 className={styles.kicker} style={{ marginTop: 18 }}>BOOKS</h3>
          <ul className={styles.itemList}>
            {data.books.map((book) => (
              <li key={book.id} className={styles.checkItem} style={{ gridTemplateColumns: 'auto minmax(0, 1fr)' }}>
                <BookOpen size={14} aria-hidden="true" />
                <Link href={`/intellectual/books/${book.id}`} className={styles.itemTitle} style={{ overflowWrap: 'anywhere' }}>{book.title}</Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  )
}
