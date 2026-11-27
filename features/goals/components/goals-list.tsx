import Link from 'next/link'
import { Goal, Plus } from 'lucide-react'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Progress } from '@/components/ui/progress'
import { SubmitButton } from '@/features/quests/components/submit-button'
import { resolveNotice } from '@/features/quests/quest-notices'
import styles from '@/features/quests/quests.module.css'
import { createGoalAction } from '../goal-actions'
import { GOAL_PILLAR_LABELS, GOAL_STATUSES, GOAL_STATUS_LABELS, formatGoalValue, periodPosition, type GoalPillar } from '../goal-domain'
import type { GoalSummary, GoalsFilter } from '../goal-service'
import { GoalFields } from './goal-fields'

type Props = {
  data: { goals: GoalSummary[]; counts: Record<string, number>; truncated: boolean; hasLoadError: boolean }
  filter: GoalsFilter
  today: string
  notice?: string
}

export function progressLabel(goal: GoalSummary): string {
  const progress = goal.progress
  if (progress.kind === 'target') {
    return progress.current === null
      ? `No progress logged yet · target ${formatGoalValue(progress.target, goal.unit)}`
      : `${formatGoalValue(progress.current, goal.unit)} of ${formatGoalValue(progress.target, goal.unit)} · ${progress.percent}%`
  }
  if (progress.kind === 'milestones') return `${progress.done} of ${progress.total} milestones · ${progress.percent}%`
  return 'No target or milestones yet'
}

export function periodLabel(startsOn: string, endsOn: string, today: string): string {
  const position = periodPosition(startsOn, endsOn, today)
  const end = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${endsOn}T00:00:00Z`))
  if (position.state === 'upcoming') return `Starts ${new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(new Date(`${startsOn}T00:00:00Z`))} · ends ${end}`
  if (position.state === 'ended') return `Period ended ${end}`
  return `Day ${position.day} of ${position.totalDays} · ends ${end}`
}

const TABS: GoalsFilter[] = [...GOAL_STATUSES, 'all']

export function GoalsList({ data, filter, today, notice }: Props) {
  const message = resolveNotice(notice)
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>GOALS · {data.counts.active ?? 0} ACTIVE</p>
          <h1>Longer-term directions, measured honestly.</h1>
          <p className={styles.heroCopy}>Each goal has a time frame and either a target you log readings against, or milestones you tick off. The period position is context, not a verdict.</p>
        </div>
        <div className={styles.inlineForm} style={{ marginTop: 0 }}>
          <Link href="#new-goal" className={styles.primaryLink}><Plus size={16} aria-hidden="true" /> New goal</Link>
        </div>
      </header>

      {message ? <p className={message.tone === 'error' ? styles.errorNotice : styles.notice} role={message.tone === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
      {data.hasLoadError ? <p className={styles.errorNotice} role="alert">Some goals could not be loaded. Refresh to try again; nothing was changed.</p> : null}
      {data.truncated ? <p className={styles.notice} role="status">Showing the first 200 goals in this view.</p> : null}

      <section className={styles.panel} aria-labelledby="goals-title">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>{filter === 'all' ? 'ALL GOALS' : GOAL_STATUS_LABELS[filter].toUpperCase()}</p><h2 id="goals-title">Your goals</h2></div></div>
        <nav className={styles.filterTabs} aria-label="Filter by status">
          {TABS.map((tab) => (
            <Link key={tab} href={tab === 'active' ? '/goals' : `/goals?status=${tab}`} className={styles.filterTab} aria-current={filter === tab ? 'page' : undefined}>
              {tab === 'all' ? 'All' : `${GOAL_STATUS_LABELS[tab]} (${data.counts[tab] ?? 0})`}
            </Link>
          ))}
        </nav>
        {data.goals.length > 0 ? (
          <ul className={styles.questList}>
            {data.goals.map((goal) => (
              <li key={goal.id} className={styles.questRow}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Link href={`/goals/${goal.id}`}><h3>{goal.title}</h3></Link>
                  <div className={styles.questMeta}>
                    <span>{GOAL_PILLAR_LABELS[goal.pillar as GoalPillar] ?? goal.pillar}</span>
                    <span>{periodLabel(goal.starts_on, goal.ends_on, today)}</span>
                  </div>
                  {goal.progress.kind !== 'none' ? <Progress value={goal.progress.percent} aria-label={`${goal.title} progress`} style={{ marginTop: 10, maxWidth: 360 }} /> : null}
                  <p className={styles.itemMeta}>{progressLabel(goal)}</p>
                </div>
                <div className={styles.questAside}>
                  <span className={styles.statusBadge} data-status={goal.status === 'completed' ? 'completed' : goal.status}>{GOAL_STATUS_LABELS[goal.status]}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty className={styles.emptyState}>
            <EmptyHeader>
              <EmptyMedia variant="icon"><Goal aria-hidden="true" /></EmptyMedia>
              <EmptyTitle>{filter === 'active' ? 'No active goals' : filter === 'all' ? 'No goals yet' : `No ${GOAL_STATUS_LABELS[filter].toLowerCase()} goals`}</EmptyTitle>
              <EmptyDescription>{filter === 'active' || filter === 'all' ? 'Set one direction when you are ready; a single goal you keep is worth more than five you forget.' : 'Goals appear here when you change their status.'}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>

      <section className={styles.panel} id="new-goal" aria-labelledby="create-goal-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>NEW</p><h2 id="create-goal-heading">Set a goal</h2></div></div>
        <form action={createGoalAction} className={styles.editorForm}>
          <GoalFields prefix="new-goal" today={today} />
          <div className={styles.editorFooter}><SubmitButton pendingLabel="Saving…"><Plus size={15} aria-hidden="true" /> Create goal</SubmitButton></div>
        </form>
      </section>
    </div>
  )
}
