import Link from 'next/link'
import { BookOpen, Check, Library, Plus, Trash2 } from 'lucide-react'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import a from '@/features/analytics/analytics.module.css'
import { WeeklyBars } from '@/features/analytics/components/weekly-bars'
import { formatMinutes, plural } from '@/features/pillars/pillar-domain'
import { IconSubmitButton } from '@/features/quests/components/icon-submit-button'
import { SubmitButton } from '@/features/quests/components/submit-button'
import { resolveNotice } from '@/features/quests/quest-notices'
import styles from '@/features/quests/quests.module.css'
import { createBookAction, deleteReadingAction, logReadingAction, setBookStatusAction } from '../intellectual-actions'
import { BOOK_LIMITS, BOOK_STATUSES, BOOK_STATUS_LABELS, type BookStatus } from '../intellectual-domain'
import type { BookView, getIntellectualData } from '../intellectual-service'

type Data = Awaited<ReturnType<typeof getIntellectualData>>
type Filter = BookStatus | 'all'

const weekLabel = (key: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(new Date(`${key}T00:00:00Z`))
const dayLabel = (key: string, today: string) => (key === today ? 'Today' : new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${key}T00:00:00Z`)))

export function progressText(book: BookView): string {
  const { progress } = book
  if (progress.percent === null) return progress.pagesRead ? `${plural(progress.pagesRead, 'page')} read` : 'No pages logged yet'
  return `${progress.pagesRead.toLocaleString('en-US')} of ${plural(book.total_pages ?? 0, 'page')} · ${progress.percent}%`
}

function QuickLog({ book, today }: { book: BookView; today: string }) {
  return (
    <form action={logReadingAction} className={styles.searchForm} style={{ marginTop: 10 }}>
      <input type="hidden" name="bookId" value={book.id} />
      <input type="hidden" name="returnTo" value="list" />
      <input type="hidden" name="date" value={today} />
      <Input name="pages" inputMode="numeric" maxLength={4} placeholder="Pages" aria-label={`Pages read today in ${book.title}`} style={{ width: 90 }} />
      <Input name="minutes" inputMode="numeric" maxLength={4} placeholder="Minutes" aria-label={`Minutes read today in ${book.title}`} style={{ width: 100 }} />
      <SubmitButton variant="outline" size="sm" pendingLabel="Saving…"><Plus size={14} aria-hidden="true" /> Log today</SubmitButton>
    </form>
  )
}

export function IntellectualOverview({ data, filter, today, notice }: { data: Data; filter: Filter; today: string; notice?: string }) {
  const message = resolveNotice(notice)
  const reading = data.books.filter((book) => book.status === 'reading')
  const listed = filter === 'all' ? data.books : data.books.filter((book) => book.status === filter)
  const counts = Object.fromEntries(BOOK_STATUSES.map((status) => [status, data.books.filter((book) => book.status === status).length])) as Record<BookStatus, number>
  const hasHistory = data.pagesSeries.some(Boolean)
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>DEVELOPMENT PILLAR · INTELLECTUAL</p>
          <h1>Reading, ideas and what you keep from them.</h1>
          <p className={styles.heroCopy}>Track the books you are reading and the time you put in. Your notes live in the knowledge vault and can be linked to any book.</p>
        </div>
        <div className={styles.inlineForm} style={{ marginTop: 0 }}>
          <Link href="/knowledge" className={styles.subtleLink}><Library size={15} aria-hidden="true" /> Knowledge vault · {plural(data.noteCount, 'note')}</Link>
          <Link href="#add-book" className={styles.primaryLink}><Plus size={16} aria-hidden="true" /> Add book</Link>
        </div>
      </header>

      {message ? <p className={message.tone === 'error' ? styles.errorNotice : styles.notice} role={message.tone === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
      {data.hasLoadError ? <p className={styles.errorNotice} role="alert">Some reading records could not be loaded. Refresh to try again; nothing was changed.</p> : null}

      <section className={styles.panel} aria-labelledby="week-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>THIS WEEK SO FAR</p><h2 id="week-heading">Right now</h2></div></div>
        <div className={a.stateGrid}>
          <div className={a.tile}><span className={a.tileLabel}>Pages read</span><strong className={a.tileValue}>{data.thisWeek.pages.toLocaleString('en-US')}</strong><span className={a.tileLabel}>{plural(data.thisWeek.days, 'day')} with reading</span></div>
          <div className={a.tile}><span className={a.tileLabel}>Reading time</span><strong className={a.tileValue}>{formatMinutes(data.thisWeek.minutes)}</strong><span className={a.tileLabel}>from sessions with a duration</span></div>
          <div className={a.tile}><span className={a.tileLabel}>Reading now</span><strong className={a.tileValue}>{reading.length}</strong><span className={a.tileLabel}>{plural(counts.to_read, 'book')} waiting</span></div>
          <div className={a.tile}><span className={a.tileLabel}>Finished this year</span><strong className={a.tileValue}>{data.finishedThisYear}</strong><span className={a.tileLabel}>{today.slice(0, 4)}</span></div>
        </div>
        {hasHistory ? (
          <>
            <h3 className={a.zoneTitle}>OVER TIME · LAST 8 WEEKS</h3>
            <div className={a.eventGrid}>
              <div className={a.tile}>
                <span className={a.tileLabel}>Pages read per week</span>
                <WeeklyBars labels={data.weeks.map(weekLabel)} values={data.pagesSeries} unit="count" metricLabel="Pages" />
                <div className="sr-only"><table><caption>Pages read per week, Monday to Sunday</caption><tbody>{data.weeks.map((week, index) => <tr key={week}><th scope="row">Week of {weekLabel(week)}</th><td>{data.pagesSeries[index]}</td></tr>)}</tbody></table></div>
              </div>
              <div className={a.tile}>
                <span className={a.tileLabel}>Days with reading per week</span>
                <WeeklyBars labels={data.weeks.map(weekLabel)} values={data.daysSeries} unit="count" metricLabel="Days" />
                <div className="sr-only"><table><caption>Days with reading per week</caption><tbody>{data.weeks.map((week, index) => <tr key={week}><th scope="row">Week of {weekLabel(week)}</th><td>{data.daysSeries[index]}</td></tr>)}</tbody></table></div>
              </div>
            </div>
          </>
        ) : null}
      </section>

      {reading.length ? (
        <section className={styles.panel} aria-labelledby="reading-heading">
          <div className={styles.sectionHeader}><div><p className={styles.kicker}>CURRENTLY READING · {reading.length}</p><h2 id="reading-heading">On the nightstand</h2></div></div>
          <div className={a.eventGrid}>
            {reading.map((book) => (
              <div key={book.id} className={a.tile}>
                <Link href={`/intellectual/books/${book.id}`} className={styles.itemTitle} style={{ fontSize: 15, fontWeight: 600 }}>{book.title}</Link>
                {book.author ? <span className={a.tileLabel}>{book.author}</span> : null}
                {book.progress.percent !== null ? <Progress value={book.progress.percent} aria-label={`${book.title} progress`} /> : null}
                <span className={a.tileLabel}>{progressText(book)}{book.lastRead ? ` · last read ${dayLabel(book.lastRead, today).toLowerCase()}` : ''}</span>
                <QuickLog book={book} today={today} />
                <form action={setBookStatusAction}>
                  <input type="hidden" name="bookId" value={book.id} />
                  <input type="hidden" name="status" value="completed" />
                  <input type="hidden" name="returnTo" value="list" />
                  <SubmitButton variant="outline" size="sm" pendingLabel="Saving…"><Check size={14} aria-hidden="true" /> Mark finished</SubmitButton>
                </form>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.panel} aria-labelledby="books-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>{plural(data.books.length, 'BOOK').toUpperCase()}</p><h2 id="books-heading">Your books</h2></div></div>
        <nav className={styles.filterTabs} aria-label="Filter books by status">
          {(['all', ...BOOK_STATUSES] as Filter[]).map((tab) => (
            <Link key={tab} href={tab === 'all' ? '/intellectual' : `/intellectual?status=${tab}`} className={styles.filterTab} aria-current={filter === tab ? 'page' : undefined}>
              {tab === 'all' ? `All (${data.books.length})` : `${BOOK_STATUS_LABELS[tab]} (${counts[tab]})`}
            </Link>
          ))}
        </nav>
        {listed.length ? (
          <ul className={styles.questList}>
            {listed.map((book) => (
              <li key={book.id} className={styles.questRow}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Link href={`/intellectual/books/${book.id}`}><h3 style={{ overflowWrap: 'anywhere' }}>{book.title}</h3></Link>
                  <div className={styles.questMeta}>
                    {book.author ? <span>{book.author}</span> : null}
                    <span>{progressText(book)}</span>
                    {book.finished_on ? <span>Finished {dayLabel(book.finished_on, today)}</span> : null}
                  </div>
                </div>
                <div className={styles.questAside}><span className={styles.statusBadge} data-status={book.status === 'completed' ? 'completed' : book.status === 'reading' ? 'active' : 'paused'}>{BOOK_STATUS_LABELS[book.status]}</span></div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty className={styles.emptyState}>
            <EmptyHeader>
              <EmptyMedia variant="icon"><BookOpen aria-hidden="true" /></EmptyMedia>
              <EmptyTitle>{filter === 'all' ? 'No books yet' : `No ${BOOK_STATUS_LABELS[filter as BookStatus].toLowerCase()} books`}</EmptyTitle>
              <EmptyDescription>{filter === 'all' ? 'Add the book you are reading now, or the next one on your list.' : 'Books move here when you change their status.'}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>

      {data.recent.length ? (
        <section className={styles.panel} aria-labelledby="recent-heading">
          <div className={styles.sectionHeader}><div><p className={styles.kicker}>LAST TWO WEEKS</p><h2 id="recent-heading">Reading log</h2></div></div>
          <ul className={styles.itemList}>
            {data.recent.map((session) => (
              <li key={session.id} className={styles.checkItem}>
                <span className={styles.statusBadge}>{session.pages_read ? plural(session.pages_read, 'page') : formatMinutes(session.duration_minutes ?? 0)}</span>
                <span className={styles.itemTitle}>{data.titles.get(session.book_id) ?? 'Book'}<span className={styles.itemMeta}>{[dayLabel(session.session_date, today), session.pages_read && session.duration_minutes ? formatMinutes(session.duration_minutes) : null, session.notes].filter(Boolean).join(' · ')}</span></span>
                <form action={deleteReadingAction}>
                  <input type="hidden" name="sessionId" value={session.id} />
                  <input type="hidden" name="returnTo" value="list" />
                  <IconSubmitButton label={`Delete the reading entry from ${dayLabel(session.session_date, today)}`}><Trash2 size={14} aria-hidden="true" /></IconSubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={styles.panel} id="add-book" aria-labelledby="add-book-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>NEW</p><h2 id="add-book-heading">Add a book</h2></div></div>
        <form action={createBookAction} className={styles.editorForm}>
          <div className={styles.fieldGrid}>
            <Field style={{ gridColumn: '1 / -1' }}><FieldLabel htmlFor="book-title">Title</FieldLabel><Input id="book-title" name="title" required maxLength={BOOK_LIMITS.title} /></Field>
            <Field><FieldLabel htmlFor="book-author">Author</FieldLabel><Input id="book-author" name="author" maxLength={BOOK_LIMITS.author} /></Field>
            <Field><FieldLabel htmlFor="book-pages">Pages (optional)</FieldLabel><Input id="book-pages" name="totalPages" inputMode="numeric" maxLength={5} /></Field>
            <Field><FieldLabel htmlFor="book-status">Status</FieldLabel>
              <select id="book-status" name="status" className={styles.nativeSelect} defaultValue="reading">
                {BOOK_STATUSES.map((status) => <option key={status} value={status}>{BOOK_STATUS_LABELS[status]}</option>)}
              </select>
            </Field>
          </div>
          <div className={styles.editorFooter}><SubmitButton pendingLabel="Adding…"><Plus size={15} aria-hidden="true" /> Add book</SubmitButton></div>
        </form>
      </section>
    </div>
  )
}
