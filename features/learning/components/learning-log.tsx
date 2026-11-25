import { CalendarDays, Clock, Timer } from 'lucide-react'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { SubmitButton } from '@/features/quests/components/submit-button'
import { resolveNotice } from '@/features/quests/quest-notices'
import styles from '@/features/quests/quests.module.css'
import { logSessionAction, purgeSessionAction, restoreSessionAction } from '../learning-actions'
import { SESSION_TYPE_LABELS, formatDuration, restoreDeadline } from '../learning-domain'
import type { LearningLogData } from '../learning-service'
import { SessionForm } from './session-form'
import { SessionList, UndoDeleteForm } from './session-list'

type LearningLogProps = { data: LearningLogData; timeZone: string; notice?: string; undoId?: string }

export function LearningLog({ data, timeZone, notice, undoId }: LearningLogProps) {
  const message = resolveNotice(notice)
  const dateFormat = new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric' })
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>LEARNING LOG · WEEK OF {dateFormat.format(new Date(`${data.week.weekStart}T12:00:00Z`)).toUpperCase()}</p>
          <h1>Time you actually spent learning.</h1>
          <p className={styles.heroCopy}>Log study, practice and building, with or without a side quest. Saving resources is collecting; only sessions count as learning effort.</p>
        </div>
      </header>

      {message ? (
        <div className={message.tone === 'error' ? styles.errorNotice : styles.notice} role={message.tone === 'error' ? 'alert' : 'status'}>
          {message.text}{' '}
          {notice === 'session-deleted' && undoId ? <UndoDeleteForm sessionId={undoId} returnTo="/learning" action={restoreSessionAction} /> : null}
        </div>
      ) : null}
      {data.hasLoadError ? <p className={styles.errorNotice} role="alert">Some sessions could not be loaded. Refresh to try again; nothing was changed.</p> : null}

      <section className={`${styles.metrics} ${styles.compactMetrics}`} aria-label="This week">
        <Metric icon={<Timer size={16} aria-hidden="true" />} label="This week" value={formatDuration(data.week.minutes)} detail="Monday to Sunday, your timezone" />
        <Metric icon={<Clock size={16} aria-hidden="true" />} label="Sessions" value={String(data.week.sessions)} detail="Logged this week" />
        <Metric icon={<CalendarDays size={16} aria-hidden="true" />} label="Active days" value={`${data.week.activeDays} / 7`} detail="Days with at least one session" />
      </section>

      <section className={styles.panel} aria-labelledby="log-session-title">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>NEW SESSION</p><h2 id="log-session-title">Log a learning session</h2></div></div>
        <SessionForm action={logSessionAction} timeZone={timeZone} today={data.week.today} returnTo="/learning" quests={data.quests} resources={data.resources} submitLabel="Log session" />
      </section>

      <section className={styles.panel} aria-labelledby="history-title">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>HISTORY</p><h2 id="history-title">Your sessions</h2></div></div>
        {data.sessions.length > 0 ? (
          <SessionList sessions={data.sessions} timeZone={timeZone} today={data.week.today} returnTo="/learning" quests={data.quests} resources={data.resources} showQuest />
        ) : (
          <Empty className={styles.emptyState}>
            <EmptyHeader>
              <EmptyMedia variant="icon"><Timer aria-hidden="true" /></EmptyMedia>
              <EmptyTitle>No learning sessions yet</EmptyTitle>
              <EmptyDescription>Log the next time you study, practise or build something, even for ten minutes.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>

      <section className={styles.panel} aria-labelledby="deleted-title">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>KEPT FOR 30 DAYS</p><h2 id="deleted-title">Recently deleted</h2></div></div>
        {data.deleted.length > 0 ? (
          <ul className={styles.itemList}>
            {data.deleted.map((session) => (
              <li key={session.id} className={styles.linkRow}>
                <span>
                  {session.topic || session.questTitle || 'Learning session'} · {formatDuration(session.duration_minutes)} · {SESSION_TYPE_LABELS[session.session_type]}
                  <span className={styles.itemMeta}>Restorable until {dateFormat.format(restoreDeadline(session.deleted_at))}</span>
                </span>
                <span className={styles.statusActions}>
                  <UndoDeleteForm sessionId={session.id} returnTo="/learning" action={restoreSessionAction} />
                  <form action={purgeSessionAction} className={styles.confirmRow} style={{ marginTop: 0 }}>
                    <input type="hidden" name="sessionId" value={session.id} />
                    <input type="hidden" name="returnTo" value="/learning" />
                    <input type="hidden" name="confirm" value="purge" />
                    <SubmitButton variant="ghost" size="sm" pendingLabel="Deleting…" ariaLabel="Delete permanently">Delete permanently</SubmitButton>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        ) : <p className={styles.mutedNote}>Nothing here. Deleted sessions can be restored for 30 days.</p>}
      </section>
    </div>
  )
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <article className={styles.metric}>
      <span className={styles.metricIcon}>{icon}</span>
      <span className={styles.metricLabel}>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}
