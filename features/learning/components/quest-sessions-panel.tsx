import Link from 'next/link'
import { Progress } from '@/components/ui/progress'
import { restoreSessionAction } from '@/features/learning/learning-actions'
import styles from '@/features/quests/quests.module.css'
import { logSessionAction } from '../learning-actions'
import { formatDuration, weeklyTargetAttainment } from '../learning-domain'
import type { QuestSessionSummary } from '../learning-service'
import { SessionForm } from './session-form'
import { SessionList, UndoDeleteForm } from './session-list'

type QuestSessionsPanelProps = {
  quest: { id: string; title: string; status: string; weekly_target_minutes: number | null }
  summary: QuestSessionSummary
  timeZone: string
  undoId?: string
}

export function QuestSessionsPanel({ quest, summary, timeZone, undoId }: QuestSessionsPanelProps) {
  const returnTo = `/quests/${quest.id}`
  const target = weeklyTargetAttainment(summary.minutesThisWeek, quest.weekly_target_minutes)
  return (
    <section className={styles.panel} aria-labelledby="quest-sessions-title">
      <div className={styles.sectionHeader}>
        <div><p className={styles.kicker}>LEARNING EFFORT</p><h2 id="quest-sessions-title">Learning sessions</h2></div>
        <Link href="/learning" className={styles.subtleLink}>Learning log</Link>
      </div>
      {undoId ? <div className={styles.notice} role="status">Session deleted. <UndoDeleteForm sessionId={undoId} returnTo={returnTo} action={restoreSessionAction} /></div> : null}

      {target.target ? (
        <>
          <Progress value={Math.min(target.percent ?? 0, 100)} aria-label="Weekly learning target" className={styles.progress} />
          <p className={styles.mutedNote}>
            This week: {formatDuration(target.minutes)} of {formatDuration(target.target)} ({target.percent}%). Weeks run Monday to Sunday in your timezone.
          </p>
        </>
      ) : (
        <p className={styles.mutedNote}>This week: {target.minutes ? formatDuration(target.minutes) : 'no sessions yet'}. Set a weekly target in the quest details to track it.</p>
      )}
      <p className={styles.mutedNote}>All time: {summary.minutesAllTime ? formatDuration(summary.minutesAllTime) : '0 min'} across {summary.sessionCount} session{summary.sessionCount === 1 ? '' : 's'}.</p>

      {summary.recent.length > 0 ? (
        <SessionList
          sessions={summary.recent}
          timeZone={timeZone}
          today={summary.week.today}
          returnTo={returnTo}
          quests={[{ id: quest.id, title: quest.title, status: quest.status }]}
          showQuest={false}
        />
      ) : null}

      <details className={styles.createDetails}>
        <summary>Log a session for this quest</summary>
        <SessionForm action={logSessionAction} timeZone={timeZone} today={summary.week.today} returnTo={returnTo} fixedQuestId={quest.id} submitLabel="Log session" />
      </details>
    </section>
  )
}
