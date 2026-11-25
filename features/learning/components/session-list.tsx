import Link from 'next/link'
import { RotateCcw, Trash2 } from 'lucide-react'
import { SubmitButton } from '@/features/quests/components/submit-button'
import { QUEST_PILLAR_LABELS, type QuestPillar } from '@/features/quests/quest-domain'
import styles from '@/features/quests/quests.module.css'
import { deleteSessionAction, updateSessionAction } from '../learning-actions'
import { SESSION_TYPE_LABELS, formatDuration, groupByLocalDate } from '../learning-domain'
import type { QuestOption, SessionView } from '../learning-service'
import { SessionForm } from './session-form'

type SessionListProps = {
  sessions: SessionView[]
  timeZone: string
  today: string
  returnTo: string
  quests: QuestOption[]
  showQuest: boolean
}

function formatDay(dateKey: string, today: string): string {
  if (dateKey === today) return 'Today'
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${dateKey}T00:00:00Z`))
}

export function SessionList({ sessions, timeZone, today, returnTo, quests, showQuest }: SessionListProps) {
  const timeFormat = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' })
  return (
    <div>
      {groupByLocalDate(sessions).map((group) => (
        <div key={group.date}>
          <p className={styles.kicker} style={{ marginTop: 16 }}>
            {formatDay(group.date, today).toUpperCase()} · {formatDuration(group.items.reduce((t, s) => t + s.minutes, 0)).toUpperCase()}
          </p>
          <ul className={styles.itemList}>
            {group.items.map((session) => {
              const label = session.topic || session.questTitle || 'Learning session'
              return (
                <li key={session.id} className={styles.checkItem}>
                  <span className={styles.statusBadge}>{formatDuration(session.minutes)}</span>
                  <details>
                    <summary className={styles.itemTitle}>
                      {label}
                      <span className={styles.itemMeta}>
                        {[
                          SESSION_TYPE_LABELS[session.session_type],
                          timeFormat.format(new Date(session.started_at)),
                          showQuest && session.quest_id ? (session.questTitle ?? 'Quest') : null,
                          !session.quest_id ? 'Standalone' : null,
                          !session.quest_id && session.pillar ? QUEST_PILLAR_LABELS[session.pillar as QuestPillar] : null,
                        ].filter(Boolean).join(' · ')}
                      </span>
                    </summary>
                    {session.notes ? <p className={styles.description}>{session.notes}</p> : null}
                    {showQuest && session.quest_id ? <Link className={styles.subtleLink} href={`/quests/${session.quest_id}`}>Open quest</Link> : null}
                    <SessionForm
                      action={updateSessionAction}
                      timeZone={timeZone}
                      today={today}
                      returnTo={returnTo}
                      quests={quests}
                      session={session}
                      submitLabel="Save session"
                    />
                  </details>
                  <form action={deleteSessionAction}>
                    <input type="hidden" name="sessionId" value={session.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <button type="submit" className={styles.iconButton} aria-label={`Delete session “${label}”`}><Trash2 size={15} aria-hidden="true" /></button>
                  </form>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

export function UndoDeleteForm({ sessionId, returnTo, action }: { sessionId: string; returnTo: string; action: (formData: FormData) => Promise<void> }) {
  return (
    <form action={action} style={{ display: 'inline' }}>
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <SubmitButton variant="outline" size="sm" pendingLabel="Restoring…"><RotateCcw size={13} aria-hidden="true" /> Undo</SubmitButton>
    </form>
  )
}
