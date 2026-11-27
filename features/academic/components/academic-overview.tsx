import Link from 'next/link'
import { GraduationCap, Plus } from 'lucide-react'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import a from '@/features/analytics/analytics.module.css'
import { formatMinutes, percent, plural } from '@/features/pillars/pillar-domain'
import { SubmitButton } from '@/features/quests/components/submit-button'
import { resolveNotice } from '@/features/quests/quest-notices'
import styles from '@/features/quests/quests.module.css'
import { createSubjectAction } from '../academic-actions'
import { ACADEMIC_LIMITS, SUBJECT_COLORS, SUBJECT_COLOR_VALUES } from '../academic-domain'
import type { getAcademicOverview } from '../academic-service'
import { ReviewButtons } from './review-buttons'

type Data = Awaited<ReturnType<typeof getAcademicOverview>>
const dateLabel = (key: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(new Date(`${key}T00:00:00Z`))

export function SubjectDot({ color }: { color: keyof typeof SUBJECT_COLOR_VALUES }) {
  return <span aria-hidden="true" style={{ display: 'inline-block', width: 10, height: 10, flexShrink: 0, borderRadius: 999, background: SUBJECT_COLOR_VALUES[color] ?? SUBJECT_COLOR_VALUES.sage }} />
}

export function AcademicOverview({ data, notice }: { data: Data; notice?: string }) {
  const message = resolveNotice(notice)
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>DEVELOPMENT PILLAR · ACADEMIC</p>
          <h1>Study that sticks.</h1>
          <p className={styles.heroCopy}>Subjects and topics, spaced revision that brings cards back when you are about to forget them, assessments, and a log of mistakes worth learning from. Study time comes from learning sessions on the Academic pillar.</p>
        </div>
        <div className={styles.inlineForm} style={{ marginTop: 0 }}>
          <Link href="/learning" className={styles.subtleLink}>Log study time</Link>
          <Link href="#add-subject" className={styles.primaryLink}><Plus size={16} aria-hidden="true" /> Add subject</Link>
        </div>
      </header>

      {message ? <p className={message.tone === 'error' ? styles.errorNotice : styles.notice} role={message.tone === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
      {data.hasLoadError ? <p className={styles.errorNotice} role="alert">Some academic records could not be loaded. Refresh to try again; nothing was changed.</p> : null}

      <section className={styles.panel} aria-labelledby="week-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>RIGHT NOW</p><h2 id="week-heading">Where things stand</h2></div></div>
        <div className={a.stateGrid}>
          <div className={a.tile}><span className={a.tileLabel}>Due for revision</span><strong className={a.tileValue}>{data.dueCount}</strong><span className={a.tileLabel}>{data.dueCount ? 'cards ready below' : 'all caught up'}</span></div>
          <div className={a.tile}><span className={a.tileLabel}>Study time this week</span><strong className={a.tileValue}>{formatMinutes(data.minutesThisWeek)}</strong><span className={a.tileLabel}>Academic learning sessions</span></div>
          <div className={a.tile}><span className={a.tileLabel}>Assessments, last 30 days</span><strong className={a.tileValue}>{data.recentAverage === null ? '—' : `${data.recentAverage}%`}</strong><span className={a.tileLabel}>average score</span></div>
          <div className={a.tile}><span className={a.tileLabel}>Open mistakes</span><strong className={a.tileValue}>{data.openErrorCount}</strong><span className={a.tileLabel}>in your error logs</span></div>
        </div>
      </section>

      {data.due.length ? (
        <section className={styles.panel} id="due" aria-labelledby="due-heading">
          <div className={styles.sectionHeader}><div><p className={styles.kicker}>DUE NOW · {data.dueCount}</p><h2 id="due-heading">Revise</h2></div></div>
          <p className={styles.mutedNote} style={{ marginTop: 0 }}>Try to recall each one before grading it. “Again” brings it back tomorrow; “Easy” pushes it furthest away.</p>
          <ul className={styles.itemList}>
            {data.due.map((item) => (
              <li key={item.id} className={styles.checkItem} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
                <span className={styles.itemTitle} style={{ overflowWrap: 'anywhere' }}>{item.title}<span className={styles.itemMeta}>{item.subjectName}{item.next_review_at ? '' : ' · new card'}</span></span>
                <ReviewButtons itemId={item.id} returnTo="list" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={styles.panel} aria-labelledby="subjects-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>{plural(data.subjects.length, 'SUBJECT').toUpperCase()}</p><h2 id="subjects-heading">Subjects</h2></div></div>
        {data.subjects.length ? (
          <ul className={styles.questList}>
            {data.subjects.map((subject) => (
              <li key={subject.id} className={styles.questRow}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Link href={`/academic/${subject.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}><SubjectDot color={subject.color} /><h3 style={{ overflowWrap: 'anywhere' }}>{subject.name}</h3></Link>
                  <div className={styles.questMeta}>
                    <span>{subject.topicCount ? `${subject.mastered} of ${plural(subject.topicCount, 'topic')} mastered` : 'No topics yet'}</span>
                    {subject.due ? <span>{plural(subject.due, 'card')} due</span> : null}
                    {subject.average !== null ? <span>Average {subject.average}%</span> : null}
                    {subject.lastAssessment ? <span>Last test {dateLabel(subject.lastAssessment.assessed_on)}</span> : null}
                    {subject.openErrors ? <span>{plural(subject.openErrors, 'open mistake')}</span> : null}
                  </div>
                  {subject.topicCount ? <Progress value={percent(subject.mastered, subject.topicCount)} aria-label={`${subject.name} topics mastered`} style={{ marginTop: 10, maxWidth: 360 }} /> : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty className={styles.emptyState}>
            <EmptyHeader>
              <EmptyMedia variant="icon"><GraduationCap aria-hidden="true" /></EmptyMedia>
              <EmptyTitle>No subjects yet</EmptyTitle>
              <EmptyDescription>Add a subject you are studying, then break it into topics and revision cards.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>

      {data.recentAssessments.length ? (
        <section className={styles.panel} aria-labelledby="assessments-heading">
          <div className={styles.sectionHeader}><div><p className={styles.kicker}>LATEST</p><h2 id="assessments-heading">Recent assessments</h2></div></div>
          <ul className={styles.itemList}>
            {data.recentAssessments.map((item) => (
              <li key={item.id} className={styles.checkItem} style={{ gridTemplateColumns: 'auto minmax(0, 1fr)' }}>
                <span className={styles.statusBadge}>{Math.round((item.score / item.max_score) * 1000) / 10}%</span>
                <Link href={`/academic/${item.subject_id}#assessments`} className={styles.itemTitle}>{item.title}<span className={styles.itemMeta}>{item.subjectName} · {dateLabel(item.assessed_on)} · {item.score} / {item.max_score}</span></Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={styles.panel} id="add-subject" aria-labelledby="add-subject-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>NEW</p><h2 id="add-subject-heading">Add a subject</h2></div></div>
        <form action={createSubjectAction} className={styles.editorForm}>
          <div className={styles.fieldGrid}>
            <Field><FieldLabel htmlFor="subject-name">Subject</FieldLabel><Input id="subject-name" name="name" required maxLength={ACADEMIC_LIMITS.subject} placeholder="Linear algebra" /></Field>
            <Field><FieldLabel htmlFor="subject-color">Colour</FieldLabel>
              <select id="subject-color" name="color" className={styles.nativeSelect} defaultValue="sage">
                {SUBJECT_COLORS.map((color) => <option key={color} value={color}>{color[0].toUpperCase() + color.slice(1)}</option>)}
              </select>
            </Field>
          </div>
          <div className={styles.editorFooter}><SubmitButton pendingLabel="Adding…"><Plus size={15} aria-hidden="true" /> Add subject</SubmitButton></div>
        </form>
      </section>
    </div>
  )
}
