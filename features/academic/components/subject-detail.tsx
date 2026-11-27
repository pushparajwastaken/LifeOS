import Link from 'next/link'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { percent, plural } from '@/features/pillars/pillar-domain'
import { IconSubmitButton } from '@/features/quests/components/icon-submit-button'
import { SubmitButton } from '@/features/quests/components/submit-button'
import { resolveNotice } from '@/features/quests/quest-notices'
import styles from '@/features/quests/quests.module.css'
import {
  addAssessmentAction, addErrorAction, addRevisionAction, addTopicAction, deleteAssessmentAction, deleteErrorAction,
  deleteRevisionAction, deleteSubjectAction, deleteTopicAction, setErrorStatusAction, setRevisionStatusAction,
  setTopicStatusAction, updateSubjectAction,
} from '../academic-actions'
import { ACADEMIC_LIMITS, ERROR_STATUSES, ERROR_STATUS_LABELS, SUBJECT_COLORS, TOPIC_STATUSES, TOPIC_STATUS_LABELS, isDue, scorePercent } from '../academic-domain'
import type { getSubjectDetail } from '../academic-service'
import { SubjectDot } from './academic-overview'
import { ReviewButtons } from './review-buttons'

type Detail = NonNullable<Awaited<ReturnType<typeof getSubjectDetail>>>
const dateLabel = (key: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${key}T00:00:00Z`))

function Hidden({ subjectId }: { subjectId: string }) {
  return <input type="hidden" name="subjectId" value={subjectId} />
}

function nextReviewLabel(iso: string | null, now: Date, timeZone: string): string {
  if (!iso) return 'New card'
  const days = Math.round((Date.parse(iso) - now.getTime()) / 86_400_000)
  if (days <= 0) return 'Due now'
  if (days === 1) return 'Due tomorrow'
  return `Due ${new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric' }).format(new Date(iso))}`
}

export function SubjectDetail({ data, today, timeZone, notice }: { data: Detail; today: string; timeZone: string; notice?: string }) {
  const { subject } = data
  const message = resolveNotice(notice)
  const now = new Date()
  const mastered = data.topics.filter((topic) => topic.status === 'mastered').length
  const topicName = new Map(data.topics.map((topic) => [topic.id, topic.name]))
  const dueCount = data.revisions.filter((item) => isDue(item, now)).length
  return (
    <div className={styles.page}>
      <Link href="/academic" className={styles.subtleLink}><ArrowLeft size={14} aria-hidden="true" /> Academic</Link>
      <header className={styles.hero}>
        <div>
          <p className={styles.kicker} style={{ display: 'flex', alignItems: 'center', gap: 8 }}><SubjectDot color={subject.color} /> SUBJECT</p>
          <h1 style={{ overflowWrap: 'anywhere' }}>{subject.name}</h1>
          <p className={styles.heroCopy}>{[data.topics.length ? `${mastered} of ${plural(data.topics.length, 'topic')} mastered` : 'No topics yet', plural(dueCount, 'card') + ' due', data.average !== null ? `average ${data.average}% across ${plural(data.assessments.length, 'assessment')}` : null].filter(Boolean).join(' · ')}</p>
        </div>
      </header>

      {message ? <p className={message.tone === 'error' ? styles.errorNotice : styles.notice} role={message.tone === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
      {data.hasLoadError ? <p className={styles.errorNotice} role="alert">Part of this subject could not be loaded. Refresh to try again.</p> : null}

      <section className={styles.panel} id="topics" aria-labelledby="topics-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>TOPICS · {data.topics.length}</p><h2 id="topics-heading">What to learn</h2></div></div>
        {data.topics.length ? <Progress value={percent(mastered, data.topics.length)} aria-label="Topics mastered" style={{ maxWidth: 420, marginBottom: 12 }} /> : null}
        {data.topics.length ? (
          <ul className={styles.itemList}>
            {data.topics.map((topic) => (
              <li key={topic.id} className={styles.checkItem} data-done={topic.status === 'mastered' ? 'true' : undefined} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto auto' }}>
                <span className={styles.itemTitle} style={{ overflowWrap: 'anywhere' }}>{topic.name}</span>
                <form action={setTopicStatusAction} style={{ display: 'flex', gap: 6 }}>
                  <Hidden subjectId={subject.id} />
                  <input type="hidden" name="topicId" value={topic.id} />
                  <label className="sr-only" htmlFor={`topic-status-${topic.id}`}>Status of {topic.name}</label>
                  <select id={`topic-status-${topic.id}`} name="status" className={styles.nativeSelect} defaultValue={topic.status} style={{ width: 'auto' }}>
                    {TOPIC_STATUSES.map((status) => <option key={status} value={status}>{TOPIC_STATUS_LABELS[status]}</option>)}
                  </select>
                  <SubmitButton variant="outline" size="sm" pendingLabel="…">Set</SubmitButton>
                </form>
                <form action={deleteTopicAction}>
                  <Hidden subjectId={subject.id} />
                  <input type="hidden" name="topicId" value={topic.id} />
                  <IconSubmitButton label={`Delete topic “${topic.name}”`}><Trash2 size={14} aria-hidden="true" /></IconSubmitButton>
                </form>
              </li>
            ))}
          </ul>
        ) : <p className={styles.mutedNote}>Break the subject into topics to track what you have mastered.</p>}
        <form action={addTopicAction} className={styles.searchForm} style={{ marginTop: 12 }}>
          <Hidden subjectId={subject.id} />
          <label className="sr-only" htmlFor="topic-name">New topic</label>
          <Input id="topic-name" name="name" required maxLength={ACADEMIC_LIMITS.topic} placeholder="Add a topic" />
          <SubmitButton variant="outline" size="sm" pendingLabel="Adding…"><Plus size={14} aria-hidden="true" /> Add topic</SubmitButton>
        </form>
      </section>

      <section className={styles.panel} id="revision" aria-labelledby="revision-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>SPACED REVISION · {plural(dueCount, 'CARD').toUpperCase()} DUE</p><h2 id="revision-heading">Revision cards</h2></div></div>
        {data.revisions.length ? (
          <ul className={styles.itemList}>
            {data.revisions.map((item) => (
              <li key={item.id} className={styles.checkItem} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
                <span className={styles.itemTitle} style={{ overflowWrap: 'anywhere' }}>{item.title}
                  <span className={styles.itemMeta}>{[item.topic_id ? topicName.get(item.topic_id) : null, item.status === 'active' ? nextReviewLabel(item.next_review_at, now, timeZone) : item.status === 'mastered' ? 'Mastered' : 'Paused', item.status === 'active' && item.next_review_at ? `every ${plural(item.interval_days, 'day')}` : null].filter(Boolean).join(' · ')}</span>
                </span>
                <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                  {isDue(item, now) ? <ReviewButtons itemId={item.id} /> : null}
                  <form action={setRevisionStatusAction}>
                    <Hidden subjectId={subject.id} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <input type="hidden" name="status" value={item.status === 'active' ? 'suspended' : 'active'} />
                    <SubmitButton variant="outline" size="sm" pendingLabel="…">{item.status === 'active' ? 'Pause' : 'Resume'}</SubmitButton>
                  </form>
                  <form action={deleteRevisionAction}>
                    <Hidden subjectId={subject.id} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <IconSubmitButton label={`Delete card “${item.title}”`}><Trash2 size={14} aria-hidden="true" /></IconSubmitButton>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        ) : <p className={styles.mutedNote}>Add a question or fact you want to remember; it comes back for review right away, then at growing intervals.</p>}
        <form action={addRevisionAction} className={styles.searchForm} style={{ marginTop: 12 }}>
          <Hidden subjectId={subject.id} />
          <label className="sr-only" htmlFor="revision-title">New card</label>
          <Input id="revision-title" name="title" required maxLength={ACADEMIC_LIMITS.revision} placeholder="What is an eigenvector?" />
          {data.topics.length ? (
            <>
              <label className="sr-only" htmlFor="revision-topic">Topic</label>
              <select id="revision-topic" name="topicId" className={styles.nativeSelect} style={{ width: 'auto' }} defaultValue="">
                <option value="">No topic</option>
                {data.topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
              </select>
            </>
          ) : null}
          <SubmitButton variant="outline" size="sm" pendingLabel="Adding…"><Plus size={14} aria-hidden="true" /> Add card</SubmitButton>
        </form>
      </section>

      <section className={styles.panel} id="assessments" aria-labelledby="assessments-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>ASSESSMENTS · {data.assessments.length}</p><h2 id="assessments-heading">{data.average === null ? 'Tests and quizzes' : `Average ${data.average}%`}</h2></div></div>
        {data.assessments.length ? (
          <ul className={styles.itemList}>
            {data.assessments.map((item) => (
              <li key={item.id} className={styles.checkItem}>
                <span className={styles.statusBadge}>{scorePercent(item.score, item.max_score)}%</span>
                <span className={styles.itemTitle} style={{ overflowWrap: 'anywhere' }}>{item.title}<span className={styles.itemMeta}>{[dateLabel(item.assessed_on), `${item.score} / ${item.max_score}`, item.question_count ? plural(item.question_count, 'question') : null, item.notes].filter(Boolean).join(' · ')}</span></span>
                <form action={deleteAssessmentAction}>
                  <Hidden subjectId={subject.id} />
                  <input type="hidden" name="assessmentId" value={item.id} />
                  <IconSubmitButton label={`Delete assessment “${item.title}”`}><Trash2 size={14} aria-hidden="true" /></IconSubmitButton>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
        <form action={addAssessmentAction} className={styles.editorForm}>
          <Hidden subjectId={subject.id} />
          <div className={styles.fieldGrid}>
            <Field style={{ gridColumn: '1 / -1' }}><FieldLabel htmlFor="assessment-title">Assessment</FieldLabel><Input id="assessment-title" name="title" required maxLength={ACADEMIC_LIMITS.assessment} placeholder="Midterm practice paper" /></Field>
            <Field><FieldLabel htmlFor="assessment-date">Date</FieldLabel><Input id="assessment-date" name="date" type="date" required max={today} defaultValue={today} /></Field>
            <Field><FieldLabel htmlFor="assessment-questions">Questions (optional)</FieldLabel><Input id="assessment-questions" name="questions" inputMode="numeric" maxLength={5} /></Field>
            <Field><FieldLabel htmlFor="assessment-score">Score</FieldLabel><Input id="assessment-score" name="score" inputMode="decimal" required maxLength={10} /></Field>
            <Field><FieldLabel htmlFor="assessment-max">Out of</FieldLabel><Input id="assessment-max" name="maxScore" inputMode="decimal" required maxLength={10} defaultValue="100" /></Field>
            <Field style={{ gridColumn: '1 / -1' }}><FieldLabel htmlFor="assessment-notes">Notes</FieldLabel><Input id="assessment-notes" name="notes" maxLength={ACADEMIC_LIMITS.notes} /></Field>
          </div>
          <div className={styles.editorFooter}><SubmitButton pendingLabel="Saving…"><Plus size={15} aria-hidden="true" /> Add assessment</SubmitButton></div>
        </form>
      </section>

      <section className={styles.panel} id="errors" aria-labelledby="errors-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>ERROR LOG · {plural(data.errors.filter((item) => item.status !== 'resolved').length, 'OPEN MISTAKE').toUpperCase()}</p><h2 id="errors-heading">Mistakes to learn from</h2></div></div>
        {data.errors.length ? (
          <ul className={styles.itemList}>
            {data.errors.map((item) => (
              <li key={item.id} className={styles.checkItem} data-done={item.status === 'resolved' ? 'true' : undefined} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto auto', alignItems: 'start' }}>
                <span className={styles.itemTitle} style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{item.prompt}<span className={styles.itemMeta} style={{ whiteSpace: 'pre-wrap' }}>{[item.topic_id ? topicName.get(item.topic_id) : null, item.correction ? `Fix: ${item.correction}` : 'No correction written yet'].filter(Boolean).join(' · ')}</span></span>
                <form action={setErrorStatusAction} style={{ display: 'flex', gap: 6 }}>
                  <Hidden subjectId={subject.id} />
                  <input type="hidden" name="itemId" value={item.id} />
                  <label className="sr-only" htmlFor={`error-status-${item.id}`}>Status</label>
                  <select id={`error-status-${item.id}`} name="status" className={styles.nativeSelect} defaultValue={item.status} style={{ width: 'auto' }}>
                    {ERROR_STATUSES.map((status) => <option key={status} value={status}>{ERROR_STATUS_LABELS[status]}</option>)}
                  </select>
                  <SubmitButton variant="outline" size="sm" pendingLabel="…">Set</SubmitButton>
                </form>
                <form action={deleteErrorAction}>
                  <Hidden subjectId={subject.id} />
                  <input type="hidden" name="itemId" value={item.id} />
                  <IconSubmitButton label="Delete this mistake"><Trash2 size={14} aria-hidden="true" /></IconSubmitButton>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
        <form action={addErrorAction} className={styles.editorForm}>
          <Hidden subjectId={subject.id} />
          <div className={styles.fieldGrid}>
            <Field style={{ gridColumn: '1 / -1' }}><FieldLabel htmlFor="error-prompt">What went wrong</FieldLabel><Textarea id="error-prompt" name="prompt" required maxLength={ACADEMIC_LIMITS.prompt} rows={2} /></Field>
            <Field style={{ gridColumn: '1 / -1' }}><FieldLabel htmlFor="error-correction">The correct idea (optional)</FieldLabel><Textarea id="error-correction" name="correction" maxLength={ACADEMIC_LIMITS.correction} rows={2} /></Field>
            {data.topics.length ? (
              <Field><FieldLabel htmlFor="error-topic">Topic</FieldLabel>
                <select id="error-topic" name="topicId" className={styles.nativeSelect} defaultValue="">
                  <option value="">No topic</option>
                  {data.topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
                </select>
              </Field>
            ) : null}
          </div>
          <div className={styles.editorFooter}><SubmitButton pendingLabel="Saving…"><Plus size={15} aria-hidden="true" /> Log mistake</SubmitButton></div>
        </form>
      </section>

      <section className={styles.panel} aria-labelledby="edit-heading">
        <details>
          <summary className={styles.sectionHeader}><div><p className={styles.kicker}>DETAILS</p><h2 id="edit-heading">Edit subject</h2></div></summary>
          <form action={updateSubjectAction} className={styles.editorForm}>
            <Hidden subjectId={subject.id} />
            <div className={styles.fieldGrid}>
              <Field><FieldLabel htmlFor="edit-subject-name">Subject</FieldLabel><Input id="edit-subject-name" name="name" required maxLength={ACADEMIC_LIMITS.subject} defaultValue={subject.name} /></Field>
              <Field><FieldLabel htmlFor="edit-subject-color">Colour</FieldLabel>
                <select id="edit-subject-color" name="color" className={styles.nativeSelect} defaultValue={subject.color}>
                  {SUBJECT_COLORS.map((color) => <option key={color} value={color}>{color[0].toUpperCase() + color.slice(1)}</option>)}
                </select>
              </Field>
            </div>
            <div className={styles.editorFooter}><SubmitButton pendingLabel="Saving…">Save subject</SubmitButton></div>
          </form>
        </details>
      </section>

      <section className={styles.panel} id="delete" aria-labelledby="delete-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>DANGER ZONE</p><h2 id="delete-heading">Delete subject</h2></div></div>
        <form action={deleteSubjectAction} className={styles.inlineForm}>
          <Hidden subjectId={subject.id} />
          <label className={styles.itemMeta} style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 0 }}><input type="checkbox" name="confirm" value="delete" required /> Delete with its topics, cards, assessments and mistakes</label>
          <SubmitButton variant="outline" size="sm" pendingLabel="Deleting…"><Trash2 size={13} aria-hidden="true" /> Delete subject</SubmitButton>
        </form>
      </section>
    </div>
  )
}
