import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import a from '@/features/analytics/analytics.module.css'
import { addDays, formatMinutes, plural, weekStartOf } from '@/features/pillars/pillar-domain'
import { SubmitButton } from '@/features/quests/components/submit-button'
import { resolveNotice } from '@/features/quests/quest-notices'
import styles from '@/features/quests/quests.module.css'
import { saveWeeklyReviewAction } from '../review-actions'
import { REVIEW_FIELDS, REVIEW_LIMITS, weekRangeLabel } from '../review-domain'
import type { getWeeklyReviewData } from '../review-service'

type Data = Awaited<ReturnType<typeof getWeeklyReviewData>>

const href = (week: string, current: string) => (week === current ? '/reviews' : `/reviews?week=${week}`)

export function WeeklyReview({ data, week, today, notice }: { data: Data; week: string; today: string; notice?: string }) {
  const message = resolveNotice(notice)
  const current = weekStartOf(today)
  const isCurrent = week === current
  const facts = [
    { label: 'Tasks done', value: data.facts.tasksDone.toLocaleString('en-US') },
    { label: 'Habit check-ins', value: data.facts.habitCheckIns.toLocaleString('en-US') },
    { label: 'Learning', value: formatMinutes(data.facts.learningMinutes) },
    { label: 'Workouts', value: data.facts.workouts.toLocaleString('en-US') },
    { label: 'Pages read', value: data.facts.pagesRead.toLocaleString('en-US') },
    { label: 'Shipped', value: data.facts.shipped.toLocaleString('en-US') },
    { label: 'Goal readings', value: data.facts.goalReadings.toLocaleString('en-US') },
  ]
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>WEEKLY REVIEW{isCurrent ? ' · THIS WEEK' : ''}</p>
          <h1>{weekRangeLabel(week)}</h1>
          <p className={styles.heroCopy}>Look back honestly, then choose what matters next. The numbers below come from what you logged this week; the words are yours.</p>
        </div>
        <nav className={styles.inlineForm} aria-label="Change week" style={{ marginTop: 0 }}>
          <Link href={href(addDays(week, -7), current)} className={styles.subtleLink}><ChevronLeft size={16} aria-hidden="true" /> Previous week</Link>
          {!isCurrent ? <Link href="/reviews" className={styles.subtleLink}>This week</Link> : null}
          {!isCurrent ? <Link href={href(addDays(week, 7), current)} className={styles.subtleLink}>Next week <ChevronRight size={16} aria-hidden="true" /></Link> : null}
        </nav>
      </header>

      {message ? <p className={message.tone === 'error' ? styles.errorNotice : styles.notice} role={message.tone === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
      {data.hasLoadError ? <p className={styles.errorNotice} role="alert">Some of this week could not be loaded. Refresh to try again; nothing was changed.</p> : null}

      <section className={styles.panel} aria-labelledby="facts-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>THE WEEK IN RECORDS</p><h2 id="facts-heading">What you logged</h2></div></div>
        <div className={a.stateGrid}>
          {facts.map((fact) => <div key={fact.label} className={a.tile}><span className={a.tileLabel}>{fact.label}</span><strong className={a.tileValue}>{fact.value}</strong></div>)}
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="review-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>{data.review ? 'SAVED' : 'NOT WRITTEN YET'}</p><h2 id="review-heading">Reflection</h2></div></div>
        <form action={saveWeeklyReviewAction} className={styles.editorForm}>
          <input type="hidden" name="week" value={week} />
          <div className={styles.fieldGrid}>
            {REVIEW_FIELDS.map(({ field, label, prompt }) => (
              <Field key={field}>
                <FieldLabel htmlFor={`review-${field}`}>{label}</FieldLabel>
                <Textarea id={`review-${field}`} name={field} maxLength={REVIEW_LIMITS.field} rows={4} defaultValue={data.review?.[field] ?? ''} />
                <FieldDescription>{prompt}</FieldDescription>
              </Field>
            ))}
          </div>
          <div className={styles.editorFooter}><p>Every part is optional. Saving replaces this week’s review.</p><SubmitButton pendingLabel="Saving…">Save review</SubmitButton></div>
        </form>
      </section>

      {data.history.length ? (
        <section className={styles.panel} aria-labelledby="history-heading">
          <div className={styles.sectionHeader}><div><p className={styles.kicker}>{plural(data.history.length, 'REVIEW').toUpperCase()}</p><h2 id="history-heading">Past reviews</h2></div></div>
          <ul className={styles.itemList}>
            {data.history.map((item) => (
              <li key={item.id} className={styles.checkItem} style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
                <Link href={href(item.week_start, current)} className={styles.itemTitle}>{weekRangeLabel(item.week_start)}
                  <span className={styles.itemMeta} style={{ overflowWrap: 'anywhere' }}>{item.next_priorities ? `Next: ${item.next_priorities.slice(0, 160)}${item.next_priorities.length > 160 ? '…' : ''}` : item.wins ? `Wins: ${item.wins.slice(0, 160)}${item.wins.length > 160 ? '…' : ''}` : 'Saved without notes'}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
