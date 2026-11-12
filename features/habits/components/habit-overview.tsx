import Link from 'next/link'
import { ArrowRight, BookOpenCheck, CalendarDays, Check, CircleAlert, Leaf, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Progress } from '@/components/ui/progress'
import {
  addDateDays,
  getCommonFailureInsight,
  getLocalDateKey,
  getPeriodMetrics,
  isHabitEnded,
  getWeekStart,
  getWeeklySeries,
  isHabitScheduledOnDate,
  makeHabitLogMap,
  type Habit,
  type HabitLog,
} from '../habit-domain'
import type { HabitManagementData } from '../habit-service'
import { HabitEditorForm } from './habit-editor-form'
import { HabitRow } from './habit-row'
import { WeeklyConsistencyChart } from './habit-analytics'
import styles from '../habit-management.module.css'

const noticeMessages: Record<string, string> = {
  'habit-created': 'Your new practice is ready. Start with a version that fits the day you have.',
  'habit-updated': 'Your habit design was saved.',
  'habit-saved': 'Your check-in was saved to its local calendar date.',
  'habit-cleared': 'The check-in was undone; the day is open again.',
  'reflection-saved': 'Reflection saved. A missed day is useful information, not a judgment.',
  'habit-archived': 'Habit archived. Its check-in history is preserved.',
  'habit-restored': 'Habit restored to your active practices.',
  'input-invalid': 'Review the highlighted form details and try again. No records were changed.',
  'reference-invalid': 'A related habit could not be verified in your workspace. Refresh and try again.',
  'record-not-found': 'That habit could not be found in your private workspace.',
  'save-failed': 'That change could not be saved. Your existing check-ins were not replaced.',
  'date-not-available': 'That date is outside this habit’s active period.',
  'date-not-scheduled': 'That date was not scheduled for this habit, so no check-in was saved.',
  'already-logged': 'A check-in already exists for that date and was left unchanged.',
  'reason-required': 'Choose the closest reason before saving a missed-day reflection.',
  'minimum-not-set': 'Add a two-minute version in the habit design before using it.',
  'value-required': 'Enter the amount you completed.',
  'value-invalid': 'Enter a non-negative amount within one day’s limit.',
}

export function HabitOverview({ data, notice }: { data: HabitManagementData; notice?: string }) {
  const activeHabits = data.habits.filter((habit) => habit.active && !isHabitEnded(habit, data.today))
  const archivedHabits = data.habits.filter((habit) => !habit.active || isHabitEnded(habit, data.today))
  const logMap = makeHabitLogMap(data.logs)
  const todayHabits = activeHabits.filter((habit) => isHabitScheduledOnDate(habit, data.today))
  const todayCompleted = todayHabits.filter((habit) => logMap.get(`${habit.id}:${data.today}`)?.status === 'completed').length
  const todayPartial = todayHabits.filter((habit) => logMap.get(`${habit.id}:${data.today}`)?.status === 'partial').length
  const week = getWeeklySeries(activeHabits, data.logs, data.today, 1)[0]
  const needsAttention = activeHabits.filter((habit) => {
    const weekMetrics = getPeriodMetrics(habit, data.logs.filter((log) => log.habit_id === habit.id), getWeekStart(data.today), data.today, data.today)
    return weekMetrics.opportunities >= 3 && (weekMetrics.percentage ?? 0) < 50
  })
  const twoWeeksAgo = addDateDays(data.today, -13)
  const recentlyEstablished = activeHabits.filter((habit) => {
    const createdDate = getLocalDateKey(new Date(habit.created_at), data.timeZone)
    return createdDate >= twoWeeksAgo && createdDate <= data.today
  })
  const failureInsight = getCommonFailureInsight(data.logs)
  const recentPerformances = activeHabits
    .map((habit) => ({
      habit,
      metrics: getPeriodMetrics(habit, data.logs.filter((log) => log.habit_id === habit.id), addDateDays(data.today, -29), data.today, data.today),
    }))
    .filter(({ metrics }) => metrics.opportunities >= 4)
    .sort((a, b) => (b.metrics.percentage ?? 0) - (a.metrics.percentage ?? 0))
  const bestRecent = recentPerformances[0]
  const noticeText = notice ? noticeMessages[notice] : undefined

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>A BEHAVIORAL JOURNAL · {data.today}</p>
          <h1>Habits, built for real life.</h1>
          <p className={styles.heroCopy}>Notice the cues, shape the system, and keep returning without asking for perfection.</p>
        </div>
        <Link href="#create-habit" className={styles.primaryLink}><Plus size={16} aria-hidden="true" /> Design a habit</Link>
      </header>

      {noticeText ? <p className={styles.notice} role="status">{noticeText}</p> : null}
      {data.hasLoadError ? (
        <p className={styles.errorNotice} role="alert">Some habit records could not be loaded. Refresh to try again; no saved data has been changed.</p>
      ) : null}
      {!data.historyComplete ? (
        <p className={styles.notice} role="status">This workspace has a very large check-in history. The latest records are shown; long-range totals may be incomplete.</p>
      ) : null}

      <section className={styles.metrics} aria-label="Habit overview">
        <Metric label="Scheduled today" value={todayHabits.length} detail={todayHabits.length ? `${todayCompleted} full · ${todayPartial} partial` : 'No scheduled practice'} icon={<CalendarDays size={16} aria-hidden="true" />} />
        <Metric label="This week" value={week.percentage === null ? '—' : `${week.percentage}%`} detail={`${week.completed} full of ${week.opportunities} opportunities`} icon={<Check size={16} aria-hidden="true" />} />
        <Metric label="Active practices" value={activeHabits.length} detail="Saved in your workspace" icon={<Leaf size={16} aria-hidden="true" />} />
        <Metric label="Needs a gentler plan" value={needsAttention.length} detail="Based on at least three scheduled opportunities" icon={<CircleAlert size={16} aria-hidden="true" />} />
      </section>

      <div className={styles.overviewGrid}>
        <section className={styles.panel} aria-labelledby="today-habits-title">
          <div className={styles.sectionHeader}>
            <div><p className={styles.kicker}>TODAY, IN YOUR TIMEZONE</p><h2 id="today-habits-title">Today&apos;s scheduled habits</h2></div>
            <Link href="/" className={styles.subtleLink}>Dashboard <ArrowRight size={14} aria-hidden="true" /></Link>
          </div>
          <div className={styles.todayProgress}>
            <Progress value={todayHabits.length ? (todayCompleted / todayHabits.length) * 100 : 0} aria-label="Today’s full-target completion" className={styles.progress} />
            <span>{todayHabits.length ? `${todayCompleted} of ${todayHabits.length} full targets` : 'Nothing is due today'}</span>
          </div>
          {todayHabits.length ? (
            <ul className={styles.habitList}>
              {todayHabits.map((habit) => <HabitRow key={habit.id} habit={habit} logs={data.logs} today={data.today} showCheckIn />)}
            </ul>
          ) : (
            <Empty className={styles.emptyState}>
              <EmptyHeader>
                <EmptyMedia variant="icon"><BookOpenCheck aria-hidden="true" /></EmptyMedia>
                <EmptyTitle>A day without a scheduled habit</EmptyTitle>
                <EmptyDescription>Keep the space, or choose a rhythm that fits the week you actually have.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent><Link className={styles.subtleLink} href="#create-habit">Shape your next practice <ArrowRight size={14} aria-hidden="true" /></Link></EmptyContent>
            </Empty>
          )}
        </section>

        <section className={styles.panel} aria-labelledby="consistency-title">
          <div className={styles.sectionHeader}>
            <div><p className={styles.kicker}>PROGRESS WITHOUT PERFECT STREAKS</p><h2 id="consistency-title">A rhythm, not a score</h2></div>
          </div>
          <WeeklyConsistencyChart habits={activeHabits} logs={data.logs} today={data.today} />
          <Observation data={data} failureInsight={failureInsight} bestRecent={bestRecent} />
        </section>
      </div>

      {needsAttention.length ? (
        <section className={styles.panel} aria-labelledby="attention-title">
          <div className={styles.sectionHeader}>
            <div><p className={styles.kicker}>A SYSTEM TO ADJUST, NOT A PERSON TO BLAME</p><h2 id="attention-title">Habits asking for a closer look</h2></div>
          </div>
          <ul className={styles.attentionList}>
            {needsAttention.map((habit) => {
              const metrics = getPeriodMetrics(habit, data.logs.filter((log) => log.habit_id === habit.id), getWeekStart(data.today), data.today, data.today)
              return <li key={habit.id}><Link href={`/habits/${habit.id}`}>{habit.name}</Link><span>{metrics.completed} of {metrics.opportunities} full targets this week</span><Badge variant="outline">Consider a smaller cue or routine</Badge></li>
            })}
          </ul>
        </section>
      ) : null}

      {recentlyEstablished.length ? (
        <section className={styles.panel} aria-labelledby="recent-title">
          <div className={styles.sectionHeader}>
            <div><p className={styles.kicker}>NEW TO YOUR ROUTINE</p><h2 id="recent-title">Recently established</h2></div>
          </div>
          <ul className={styles.recentList}>
            {recentlyEstablished.slice(0, 6).map((habit) => (
              <li key={habit.id}><Link href={`/habits/${habit.id}`}>{habit.name}</Link><span>Started {getLocalDateKey(new Date(habit.created_at), data.timeZone)}</span></li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={styles.panel} aria-labelledby="all-habits-title">
        <div className={styles.sectionHeader}>
          <div><p className={styles.kicker}>YOUR PERSONAL SYSTEM</p><h2 id="all-habits-title">All active habits</h2></div>
          <span className={styles.mutedText}>{activeHabits.length} saved</span>
        </div>
        {activeHabits.length ? (
          <ul className={styles.habitList}>
            {activeHabits.map((habit) => <HabitRow key={habit.id} habit={habit} logs={data.logs} today={data.today} />)}
          </ul>
        ) : (
          <Empty className={styles.emptyState}>
            <EmptyHeader>
              <EmptyMedia variant="icon"><Leaf aria-hidden="true" /></EmptyMedia>
              <EmptyTitle>No habits yet</EmptyTitle>
              <EmptyDescription>Start with one small action that feels possible on an ordinary day. Nothing here is sample data.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent><Link href="#create-habit" className={styles.primaryLink}><Plus size={15} aria-hidden="true" /> Create your first habit</Link></EmptyContent>
          </Empty>
        )}
      </section>

      <details className={styles.createDetails} id="create-habit" open={activeHabits.length === 0 || undefined}>
        <summary><span><strong>{activeHabits.length ? 'Design another habit' : 'Build your first habit'}</strong><small>Start with the action, then add optional behavior design.</small></span><Plus size={17} aria-hidden="true" /></summary>
        <HabitEditorForm today={data.today} timeZone={data.timeZone} relatedHabits={data.relatedHabits} />
      </details>

      {archivedHabits.length ? (
        <details className={styles.archivedDetails}>
          <summary>Paused and archived habits <Badge variant="outline">{archivedHabits.length}</Badge></summary>
          <ul className={styles.habitList}>
            {archivedHabits.map((habit) => <HabitRow key={habit.id} habit={habit} logs={data.logs} today={data.today} />)}
          </ul>
          <p className={styles.mutedText}>Archiving stops new opportunities; saved history stays available.</p>
        </details>
      ) : null}

      <footer className={styles.pageFooter}>LifeOS / A practice, not a finish line. Misses are information; your history stays yours.</footer>
    </div>
  )
}

function Metric({ label, value, detail, icon }: { label: string; value: number | string; detail: string; icon: React.ReactNode }) {
  return (
    <div className={styles.metric}>
      <span className={styles.metricIcon}>{icon}</span>
      <span className={styles.metricLabel}>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  )
}

function Observation({
  data,
  failureInsight,
  bestRecent,
}: {
  data: HabitManagementData
  failureInsight: ReturnType<typeof getCommonFailureInsight>
  bestRecent: { habit: Habit; metrics: ReturnType<typeof getPeriodMetrics> } | undefined
}) {
  if (failureInsight) {
    return (
      <aside className={styles.observation} aria-label="Observed barrier and experiment">
        <Badge variant="outline">Observation · not a judgment</Badge>
        <p><strong>Most recorded barrier:</strong> {failureInsight.label.toLowerCase()} in {failureInsight.count} reflections.</p>
        <small>One experiment to consider: {failureInsight.suggestion}</small>
      </aside>
    )
  }
  if (bestRecent && bestRecent.metrics.opportunities >= 4) {
    return (
      <aside className={styles.observation} aria-label="Recent consistency observation">
        <Badge variant="outline">A small pattern in your records</Badge>
        <p><strong>{bestRecent.habit.name}</strong> has {bestRecent.metrics.completed} full completions across {bestRecent.metrics.opportunities} scheduled opportunities in the last 30 days.</p>
        <small>This is a description of your records, not a claim about what caused them.</small>
      </aside>
    )
  }
  return (
    <aside className={styles.observation} aria-label="Habit insight guidance">
      <Badge variant="outline">Observations appear with evidence</Badge>
      <p>After a few scheduled check-ins or reflections, this space can surface a useful pattern.</p>
      <small>Nothing is inferred from missing or invented activity.</small>
    </aside>
  )
}
