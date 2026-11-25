import Link from 'next/link'
import { Compass, Map as MapIcon, Plus } from 'lucide-react'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Progress } from '@/components/ui/progress'
import { createQuestAction } from '../quest-actions'
import {
  QUEST_DIFFICULTY_LABELS,
  QUEST_PILLAR_LABELS,
  QUEST_STATUSES,
  QUEST_STATUS_LABELS,
  QUEST_STRUCTURE_LABELS,
  type QuestFilter,
} from '../quest-domain'
import { formatDateKey, formatMinutes, resolveNotice } from '../quest-notices'
import type { QuestListData, QuestListItem } from '../quest-service'
import styles from '../quests.module.css'
import { QuestEditorForm } from './quest-editor-form'

const FILTERS: Array<{ value: QuestFilter; label: string }> = [
  { value: 'all', label: 'All' },
  ...QUEST_STATUSES.map((status) => ({ value: status, label: QUEST_STATUS_LABELS[status] })),
]

export function QuestOverview({ data, filter, notice }: { data: QuestListData; filter: QuestFilter; notice?: string }) {
  const message = resolveNotice(notice)
  const activeCount = data.counts.active
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>SIDE QUESTS · CAPABILITIES IN PROGRESS</p>
          <h1>What are you becoming able to do?</h1>
          <p className={styles.heroCopy}>Side quests are skills you are developing, not chores to tick off. Give them structure when it helps, or keep them open-ended and exploratory.</p>
        </div>
        <Link href="#create-quest" className={styles.primaryLink}><Plus size={16} aria-hidden="true" /> New quest</Link>
      </header>

      {message ? <p className={message.tone === 'error' ? styles.errorNotice : styles.notice} role={message.tone === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
      {data.hasLoadError ? <p className={styles.errorNotice} role="alert">Some quest details could not be loaded. Refresh to try again; nothing was changed.</p> : null}

      <section className={styles.panel} aria-labelledby="quest-list-title">
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.kicker}>{activeCount === 1 ? '1 ACTIVE QUEST' : `${activeCount} ACTIVE QUESTS`}</p>
            <h2 id="quest-list-title">Your quests</h2>
          </div>
        </div>
        <nav className={styles.filterTabs} aria-label="Filter quests by status">
          {FILTERS.map(({ value, label }) => (
            <Link
              key={value}
              href={value === 'all' ? '/quests' : `/quests?status=${value}`}
              className={styles.filterTab}
              aria-current={filter === value ? 'page' : undefined}
            >
              {label} <span aria-hidden="true">{data.counts[value]}</span><span className="sr-only">{` (${data.counts[value]})`}</span>
            </Link>
          ))}
        </nav>

        {data.quests.length > 0 ? (
          <ul className={styles.questList}>
            {data.quests.map((quest) => <QuestRow key={quest.id} quest={quest} />)}
          </ul>
        ) : (
          <Empty className={styles.emptyState}>
            <EmptyHeader>
              <EmptyMedia variant="icon">{data.counts.all === 0 ? <MapIcon aria-hidden="true" /> : <Compass aria-hidden="true" />}</EmptyMedia>
              <EmptyTitle>{data.counts.all === 0 ? 'No side quests yet' : `No ${filter === 'all' ? '' : QUEST_STATUS_LABELS[filter as Exclude<QuestFilter, 'all'>].toLowerCase()} quests`}</EmptyTitle>
              <EmptyDescription>
                {data.counts.all === 0
                  ? 'Start with one skill you are curious about, such as graphics programming or cryptography.'
                  : 'Try another filter, or start something new.'}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent><Link className={styles.subtleLink} href="#create-quest">Start a quest</Link></EmptyContent>
          </Empty>
        )}
      </section>

      <section className={styles.panel} id="create-quest" aria-labelledby="create-quest-title">
        <div className={styles.sectionHeader}>
          <div><p className={styles.kicker}>NEW SIDE QUEST</p><h2 id="create-quest-title">Start something new</h2></div>
        </div>
        <QuestEditorForm action={createQuestAction} submitLabel="Create quest" pendingLabel="Creating…" />
      </section>
    </div>
  )
}

function QuestRow({ quest }: { quest: QuestListItem }) {
  const progress = quest.progress
  const meta = [
    QUEST_PILLAR_LABELS[quest.pillar],
    QUEST_STRUCTURE_LABELS[quest.structure],
    quest.category,
    quest.difficulty ? QUEST_DIFFICULTY_LABELS[quest.difficulty] : null,
    quest.target_date ? `Target ${formatDateKey(quest.target_date)}` : null,
    quest.weekly_target_minutes ? `${formatMinutes(quest.weekly_target_minutes)} / week` : null,
  ].filter(Boolean)

  return (
    <li className={styles.questRow}>
      <div>
        <Link href={`/quests/${quest.id}`}><h3>{quest.title}</h3></Link>
        <div className={styles.questMeta}>{meta.map((item) => <span key={item}>{item}</span>)}</div>
      </div>
      <div className={styles.questAside}>
        <span className={styles.statusBadge} data-status={quest.status}>{QUEST_STATUS_LABELS[quest.status]}</span>
        {progress.kind === 'milestones' ? (
          progress.total > 0 ? (
            <>
              <Progress value={progress.percent ?? 0} aria-label={`${quest.title} milestone progress`} className={styles.progress} />
              <span>{progress.completed} of {progress.total} milestones</span>
            </>
          ) : <span>No milestones yet</span>
        ) : (
          <span>
            {progress.objectivesTotal > 0 ? `${progress.objectivesAchieved} of ${progress.objectivesTotal} objectives` : 'Open exploration'}
          </span>
        )}
      </div>
    </li>
  )
}
