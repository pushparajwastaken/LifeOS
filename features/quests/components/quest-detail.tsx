import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { deleteQuestAction, setQuestStatusAction, updateQuestAction } from '../quest-actions'
import {
  QUEST_DIFFICULTY_LABELS,
  QUEST_PILLAR_LABELS,
  QUEST_STATUS_LABELS,
  QUEST_STRUCTURE_LABELS,
  getAllowedQuestTransitions,
  type QuestStatus,
} from '../quest-domain'
import { formatDateKey, formatMinutes, formatTimestamp, resolveNotice } from '../quest-notices'
import type { QuestDetailData } from '../quest-service'
import styles from '../quests.module.css'
import { MilestonesPanel, ObjectivesPanel } from './quest-checklists'
import { QuestEditorForm } from './quest-editor-form'
import { QuestNotesPanel } from './quest-notes-panel'
import { SubmitButton } from './submit-button'

const TRANSITION_LABELS: Record<QuestStatus, string> = {
  backlog: 'Move to backlog',
  active: 'Start',
  paused: 'Pause',
  completed: 'Mark completed',
}

export function QuestDetail({ data, timeZone, notice }: { data: QuestDetailData; timeZone: string; notice?: string }) {
  const { quest, progress } = data
  const message = resolveNotice(notice)
  const transitions = getAllowedQuestTransitions(quest.status)
  const facts: Array<[string, string]> = [
    ['Structure', QUEST_STRUCTURE_LABELS[quest.structure]],
    ['Pillar', QUEST_PILLAR_LABELS[quest.pillar]],
    ...(quest.category ? [['Category', quest.category] as [string, string]] : []),
    ...(quest.difficulty ? [['Difficulty', QUEST_DIFFICULTY_LABELS[quest.difficulty]] as [string, string]] : []),
    ...(quest.weekly_target_minutes ? [['Weekly target', `${formatMinutes(quest.weekly_target_minutes)}`] as [string, string]] : []),
    ...(quest.target_date ? [['Target date', formatDateKey(quest.target_date) ?? '']] as Array<[string, string]> : []),
    ...(quest.started_at ? [['Started', formatTimestamp(quest.started_at, timeZone) ?? '']] as Array<[string, string]> : []),
    ...(quest.completed_at ? [['Completed', formatTimestamp(quest.completed_at, timeZone) ?? '']] as Array<[string, string]> : []),
  ]

  return (
    <div className={styles.page}>
      <Link href="/quests" className={styles.subtleLink}><ArrowLeft size={14} aria-hidden="true" /> All quests</Link>
      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>{QUEST_PILLAR_LABELS[quest.pillar].toUpperCase()} · {QUEST_STRUCTURE_LABELS[quest.structure].toUpperCase()} QUEST</p>
          <h1>{quest.title}</h1>
          {quest.description ? <p className={styles.description}>{quest.description}</p> : null}
        </div>
        <span className={styles.statusBadge} data-status={quest.status}>{QUEST_STATUS_LABELS[quest.status]}</span>
      </header>

      {message ? <p className={message.tone === 'error' ? styles.errorNotice : styles.notice} role={message.tone === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
      {data.hasLoadError ? <p className={styles.errorNotice} role="alert">Some parts of this quest could not be loaded. Refresh to try again; nothing was changed.</p> : null}

      <div className={styles.detailGrid}>
        <div className={styles.stack}>
          <section className={styles.panel} aria-labelledby="progress-title">
            <div className={styles.sectionHeader}>
              <div><p className={styles.kicker}>PROGRESS</p><h2 id="progress-title">{progress.kind === 'milestones' ? 'Path progress' : 'Exploration so far'}</h2></div>
            </div>
            {progress.kind === 'milestones' ? (
              progress.total > 0 ? (
                <>
                  <Progress value={progress.percent ?? 0} aria-label="Milestone progress" className={styles.progress} />
                  <p className={styles.mutedNote}>{progress.completed} of {progress.total} milestones complete ({progress.percent}%) · {progress.objectivesAchieved} of {progress.objectivesTotal} objectives achieved</p>
                </>
              ) : <p className={styles.mutedNote}>Add milestones to see path progress.</p>
            ) : (
              <p className={styles.mutedNote}>
                Exploratory quests have no percentage. {progress.objectivesAchieved} of {progress.objectivesTotal} objectives achieved · {progress.milestonesCompleted} waypoint{progress.milestonesCompleted === 1 ? '' : 's'} reached.
              </p>
            )}
          </section>
          <ObjectivesPanel questId={quest.id} objectives={data.objectives} timeZone={timeZone} />
          <MilestonesPanel questId={quest.id} milestones={data.milestones} timeZone={timeZone} structured={quest.structure === 'structured'} />
        </div>

        <div className={styles.stack}>
          <section className={styles.panel} aria-labelledby="status-title">
            <div className={styles.sectionHeader}>
              <div><p className={styles.kicker}>STATUS</p><h2 id="status-title">{QUEST_STATUS_LABELS[quest.status]}</h2></div>
            </div>
            <div className={styles.statusActions}>
              {transitions.map((to) => (
                <form key={to} action={setQuestStatusAction}>
                  <input type="hidden" name="questId" value={quest.id} />
                  <input type="hidden" name="status" value={to} />
                  <SubmitButton variant={to === 'completed' || (to === 'active' && quest.status === 'backlog') ? 'default' : 'outline'} pendingLabel="Saving…">
                    {to === 'active' && quest.status === 'paused' ? 'Resume' : to === 'active' && quest.status === 'completed' ? 'Reopen' : TRANSITION_LABELS[to]}
                  </SubmitButton>
                </form>
              ))}
            </div>
            <dl className={styles.factList}>
              {facts.map(([label, value]) => (
                <div key={label} style={{ display: 'contents' }}><dt>{label}</dt><dd>{value}</dd></div>
              ))}
            </dl>
          </section>

          <QuestNotesPanel questId={quest.id} notes={data.notes} noteOptions={data.noteOptions} noteQuery={data.noteQuery} />

          <section className={styles.panel} aria-labelledby="edit-quest-title">
            <details className={styles.createDetails}>
              <summary id="edit-quest-title">Edit quest details</summary>
              <QuestEditorForm action={updateQuestAction} quest={quest} submitLabel="Save changes" pendingLabel="Saving…" />
            </details>
          </section>

          <section className={`${styles.panel} ${styles.dangerZone}`} aria-label="Delete quest">
            <details>
              <summary>Delete this quest</summary>
              <p className={styles.mutedNote}>
                Deleting removes the quest with its objectives, milestones and their completion history. Linked notes are kept in your knowledge vault. To keep the history, pause or complete the quest instead.
              </p>
              <form action={deleteQuestAction} className={styles.confirmRow}>
                <input type="hidden" name="questId" value={quest.id} />
                <label><input type="checkbox" name="confirm" value="delete" required /> I understand this cannot be undone</label>
                <SubmitButton variant="destructive" pendingLabel="Deleting…">Delete quest</SubmitButton>
              </form>
            </details>
          </section>
        </div>
      </div>
    </div>
  )
}
