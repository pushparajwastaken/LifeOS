import Link from 'next/link'
import { NotebookPen, Plus, Search } from 'lucide-react'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { resolveNotice } from '@/features/quests/quest-notices'
import styles from '@/features/quests/quests.module.css'
import { createNoteAction } from '../note-actions'
import { NOTE_TYPE_LABELS, excerpt, type NoteFilter } from '../note-domain'
import type { NoteListData } from '../note-service'
import { NoteEditorForm } from './note-editor-form'

const FILTERS: Array<{ value: NoteFilter; label: string }> = [
  { value: 'all', label: 'All notes' },
  { value: 'linked', label: 'Linked to a quest' },
  { value: 'unlinked', label: 'Unlinked' },
]

function filterHref(filter: NoteFilter, query: string | null): string {
  const params = new URLSearchParams()
  if (filter !== 'all') params.set('filter', filter)
  if (query) params.set('q', query)
  const search = params.toString()
  return search ? `/knowledge?${search}` : '/knowledge'
}

export function NoteOverview({ data, timeZone, notice }: { data: NoteListData; timeZone: string; notice?: string }) {
  const message = resolveNotice(notice)
  const dateFormat = new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric', year: 'numeric' })
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>KNOWLEDGE VAULT · NOTES</p>
          <h1>What you are learning, in your own words.</h1>
          <p className={styles.heroCopy}>Notes you write here or inside a side quest all live in one place. Unlinking a note or deleting its quest never deletes the note.</p>
        </div>
        <Link href="#create-note" className={styles.primaryLink}><Plus size={16} aria-hidden="true" /> New note</Link>
      </header>

      {message ? <p className={message.tone === 'error' ? styles.errorNotice : styles.notice} role={message.tone === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
      {data.hasLoadError ? <p className={styles.errorNotice} role="alert">Some notes could not be loaded. Refresh to try again; nothing was changed.</p> : null}
      {data.truncated ? <p className={styles.notice} role="status">Showing your 200 most recent matching notes. Search to narrow the list.</p> : null}

      <section className={styles.panel} aria-labelledby="notes-title">
        <div className={styles.sectionHeader}>
          <div><p className={styles.kicker}>{data.notes.length === 1 ? '1 NOTE' : `${data.notes.length} NOTES`}</p><h2 id="notes-title">Your notes</h2></div>
        </div>
        <form method="get" action="/knowledge" className={styles.searchForm} role="search">
          {data.filter !== 'all' ? <input type="hidden" name="filter" value={data.filter} /> : null}
          <label className="sr-only" htmlFor="notes-search">Search notes</label>
          <Input id="notes-search" name="q" defaultValue={data.query ?? ''} placeholder="Search titles and text" />
          <button type="submit" className={styles.subtleLink}><Search size={14} aria-hidden="true" /> Search</button>
          {data.query ? <Link href={filterHref(data.filter, null)} className={styles.subtleLink}>Clear</Link> : null}
        </form>
        <nav className={styles.filterTabs} aria-label="Filter notes" style={{ marginTop: 12 }}>
          {FILTERS.map(({ value, label }) => (
            <Link key={value} href={filterHref(value, data.query)} className={styles.filterTab} aria-current={data.filter === value ? 'page' : undefined}>{label}</Link>
          ))}
        </nav>

        {data.notes.length > 0 ? (
          <ul className={styles.noteList}>
            {data.notes.map((note) => (
              <li key={note.id} className={styles.noteRow}>
                <Link href={`/knowledge/${note.id}`}><h3>{note.title}</h3></Link>
                <div className={styles.questMeta}>
                  <span>{NOTE_TYPE_LABELS[note.note_type]}</span>
                  <span>Updated {dateFormat.format(new Date(note.updated_at))}</span>
                  <span>{note.quests.length > 0 ? `Linked to ${note.quests.map((quest) => quest.title).join(', ')}` : 'Not linked to a quest'}</span>
                </div>
                {note.body ? <p className={styles.noteExcerpt}>{excerpt(note.body)}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <Empty className={styles.emptyState}>
            <EmptyHeader>
              <EmptyMedia variant="icon"><NotebookPen aria-hidden="true" /></EmptyMedia>
              <EmptyTitle>{data.query ? 'No notes match that search' : data.filter === 'unlinked' ? 'Every note is linked to a quest' : 'No notes yet'}</EmptyTitle>
              <EmptyDescription>{data.query ? 'Try fewer or different words.' : 'Capture an idea, a question, or an explanation in your own words.'}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>

      <section className={styles.panel} id="create-note" aria-labelledby="create-note-title">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>NEW NOTE</p><h2 id="create-note-title">Write a note</h2></div></div>
        <NoteEditorForm action={createNoteAction} submitLabel="Save note" />
      </section>
    </div>
  )
}
