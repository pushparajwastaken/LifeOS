import Link from 'next/link'
import { ArrowLeft, Link2, Plus, Trash2, Unlink } from 'lucide-react'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { formatMinutes, plural } from '@/features/pillars/pillar-domain'
import { IconSubmitButton } from '@/features/quests/components/icon-submit-button'
import { SubmitButton } from '@/features/quests/components/submit-button'
import { resolveNotice } from '@/features/quests/quest-notices'
import styles from '@/features/quests/quests.module.css'
import { deleteBookAction, deleteReadingAction, linkNoteToBookAction, logReadingAction, setBookStatusAction, unlinkNoteFromBookAction, updateBookAction } from '../intellectual-actions'
import { BOOK_LIMITS, BOOK_STATUSES, BOOK_STATUS_LABELS } from '../intellectual-domain'
import type { getBookDetail } from '../intellectual-service'

type Detail = NonNullable<Awaited<ReturnType<typeof getBookDetail>>>
const dateLabel = (key: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${key}T00:00:00Z`))

function Hidden({ bookId }: { bookId: string }) {
  return <input type="hidden" name="bookId" value={bookId} />
}

export function BookDetail({ data, today, notice }: { data: Detail; today: string; notice?: string }) {
  const { book, progress } = data
  const message = resolveNotice(notice)
  return (
    <div className={styles.page}>
      <Link href="/intellectual" className={styles.subtleLink}><ArrowLeft size={14} aria-hidden="true" /> Intellectual</Link>
      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>BOOK · {BOOK_STATUS_LABELS[book.status].toUpperCase()}</p>
          <h1 style={{ overflowWrap: 'anywhere' }}>{book.title}</h1>
          <p className={styles.heroCopy}>{[book.author, book.started_on ? `Started ${dateLabel(book.started_on)}` : null, book.finished_on ? `Finished ${dateLabel(book.finished_on)}` : null].filter(Boolean).join(' · ') || 'No author or dates yet.'}</p>
        </div>
      </header>

      {message ? <p className={message.tone === 'error' ? styles.errorNotice : styles.notice} role={message.tone === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
      {data.hasLoadError ? <p className={styles.errorNotice} role="alert">Part of this book could not be loaded. Refresh to try again.</p> : null}

      <section className={styles.panel} aria-labelledby="progress-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>PROGRESS</p><h2 id="progress-heading">{progress.percent === null ? `${plural(progress.pagesRead, 'page')} read` : `${progress.percent}% · ${progress.pagesRead.toLocaleString('en-US')} of ${plural(book.total_pages ?? 0, 'page')}`}</h2></div></div>
        {progress.percent !== null ? <Progress value={progress.percent} aria-label="Reading progress" style={{ maxWidth: 480 }} /> : <p className={styles.mutedNote}>Add the page count below to see a percentage.</p>}
        <p className={styles.itemMeta}>{plural(data.sessions.length, 'reading session')} · {formatMinutes(data.minutes)} logged</p>
        <div className={styles.inlineForm} style={{ marginTop: 12 }}>
          {BOOK_STATUSES.filter((status) => status !== book.status).map((status) => (
            <form key={status} action={setBookStatusAction} style={{ display: 'inline' }}>
              <Hidden bookId={book.id} />
              <input type="hidden" name="status" value={status} />
              <SubmitButton variant="outline" size="sm" pendingLabel="Saving…">{status === 'completed' ? 'Mark finished' : status === 'reading' ? 'Reading now' : `Move to ${BOOK_STATUS_LABELS[status].toLowerCase()}`}</SubmitButton>
            </form>
          ))}
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="log-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>READING LOG</p><h2 id="log-heading">Log a session</h2></div></div>
        <form action={logReadingAction} className={styles.editorForm}>
          <Hidden bookId={book.id} />
          <div className={styles.fieldGrid}>
            <Field><FieldLabel htmlFor="reading-date">Date</FieldLabel><Input id="reading-date" name="date" type="date" required max={today} defaultValue={today} /></Field>
            <Field><FieldLabel htmlFor="reading-pages">Pages read</FieldLabel><Input id="reading-pages" name="pages" inputMode="numeric" maxLength={4} /></Field>
            <Field><FieldLabel htmlFor="reading-minutes">Minutes</FieldLabel><Input id="reading-minutes" name="minutes" inputMode="numeric" maxLength={4} /></Field>
            <Field style={{ gridColumn: '1 / -1' }}><FieldLabel htmlFor="reading-notes">Note (optional)</FieldLabel><Input id="reading-notes" name="notes" maxLength={BOOK_LIMITS.notes} /></Field>
          </div>
          <div className={styles.editorFooter}><p>Enter pages, minutes, or both.</p><SubmitButton pendingLabel="Saving…"><Plus size={15} aria-hidden="true" /> Log reading</SubmitButton></div>
        </form>
        {data.sessions.length ? (
          <ul className={styles.itemList}>
            {data.sessions.map((session) => (
              <li key={session.id} className={styles.checkItem}>
                <span className={styles.statusBadge}>{session.pages_read ? plural(session.pages_read, 'page') : formatMinutes(session.duration_minutes ?? 0)}</span>
                <span className={styles.itemTitle}>{dateLabel(session.session_date)}<span className={styles.itemMeta}>{[session.pages_read && session.duration_minutes ? formatMinutes(session.duration_minutes) : null, session.notes].filter(Boolean).join(' · ')}</span></span>
                <form action={deleteReadingAction}>
                  <input type="hidden" name="sessionId" value={session.id} />
                  <IconSubmitButton label={`Delete the reading entry from ${dateLabel(session.session_date)}`}><Trash2 size={14} aria-hidden="true" /></IconSubmitButton>
                </form>
              </li>
            ))}
          </ul>
        ) : <p className={styles.mutedNote}>No reading logged for this book yet.</p>}
      </section>

      <section className={styles.panel} id="notes" aria-labelledby="notes-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>KNOWLEDGE VAULT</p><h2 id="notes-heading">Notes on this book</h2></div><Link href="/knowledge" className={styles.subtleLink}>Write a note</Link></div>
        {data.linkedNotes.length ? (
          <ul className={styles.itemList}>
            {data.linkedNotes.map((note) => (
              <li key={note.id} className={styles.checkItem}>
                <Link2 size={15} aria-hidden="true" />
                <Link href={`/knowledge/${note.id}`} className={styles.itemTitle}>{note.title}</Link>
                <form action={unlinkNoteFromBookAction}>
                  <Hidden bookId={book.id} />
                  <input type="hidden" name="noteId" value={note.id} />
                  <IconSubmitButton label={`Unlink “${note.title}” from this book`}><Unlink size={14} aria-hidden="true" /></IconSubmitButton>
                </form>
              </li>
            ))}
          </ul>
        ) : <p className={styles.mutedNote}>No notes linked yet.</p>}
        {data.linkableNotes.length ? (
          <form action={linkNoteToBookAction} className={styles.searchForm} style={{ marginTop: 12 }}>
            <Hidden bookId={book.id} />
            <label className="sr-only" htmlFor="link-note">Note to link</label>
            <select id="link-note" name="noteId" className={styles.nativeSelect} required defaultValue="">
              <option value="" disabled>Choose a note…</option>
              {data.linkableNotes.map((note) => <option key={note.id} value={note.id}>{note.title}</option>)}
            </select>
            <SubmitButton variant="outline" size="sm" pendingLabel="Linking…"><Link2 size={14} aria-hidden="true" /> Link note</SubmitButton>
          </form>
        ) : null}
      </section>

      <section className={styles.panel} aria-labelledby="edit-heading">
        <details>
          <summary className={styles.sectionHeader}><div><p className={styles.kicker}>DETAILS</p><h2 id="edit-heading">Edit book</h2></div></summary>
          <form action={updateBookAction} className={styles.editorForm}>
            <Hidden bookId={book.id} />
            <input type="hidden" name="status" value={book.status} />
            <div className={styles.fieldGrid}>
              <Field style={{ gridColumn: '1 / -1' }}><FieldLabel htmlFor="edit-book-title">Title</FieldLabel><Input id="edit-book-title" name="title" required maxLength={BOOK_LIMITS.title} defaultValue={book.title} /></Field>
              <Field><FieldLabel htmlFor="edit-book-author">Author</FieldLabel><Input id="edit-book-author" name="author" maxLength={BOOK_LIMITS.author} defaultValue={book.author ?? ''} /></Field>
              <Field><FieldLabel htmlFor="edit-book-pages">Pages</FieldLabel><Input id="edit-book-pages" name="totalPages" inputMode="numeric" maxLength={5} defaultValue={book.total_pages ?? ''} /></Field>
            </div>
            <div className={styles.editorFooter}><SubmitButton pendingLabel="Saving…">Save book</SubmitButton></div>
          </form>
        </details>
      </section>

      <section className={styles.panel} id="delete" aria-labelledby="delete-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>DANGER ZONE</p><h2 id="delete-heading">Delete book</h2></div></div>
        <form action={deleteBookAction} className={styles.inlineForm}>
          <Hidden bookId={book.id} />
          <label className={styles.itemMeta} style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 0 }}><input type="checkbox" name="confirm" value="delete" required /> Delete with its reading log (notes are kept)</label>
          <SubmitButton variant="outline" size="sm" pendingLabel="Deleting…"><Trash2 size={13} aria-hidden="true" /> Delete book</SubmitButton>
        </form>
      </section>
    </div>
  )
}
