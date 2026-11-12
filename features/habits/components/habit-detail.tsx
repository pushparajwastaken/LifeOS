import Link from 'next/link'
import { ArrowLeft, ArrowUpRight, CalendarDays, Leaf, Pause, RotateCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { HabitAnalytics } from './habit-analytics'
import { HabitCheckInForm } from './habit-check-in-form'
import { HabitEditorForm } from './habit-editor-form'
import { HabitReflectionForm } from './habit-reflection-form'
import { HabitSubmitButton } from './habit-submit-button'
import { archiveHabitAction, restoreHabitAction } from '../habit-actions'
import {
  addDateDays,
  displayHabitLogNote,
  formatDateKey,
  getCommonFailureInsight,
  getFailureReasonLabel,
  getHabitStreaks,
  getLocalDateKey,
  getRelatedHabitObservation,
  isHabitEnded,
  isHabitScheduledOnDate,
  parseHabitReflection,
  PILLAR_LABELS,
  type Habit,
} from '../habit-domain'
import type { HabitManagementData } from '../habit-service'
import styles from '../habit-management.module.css'

const noticeMessages: Record<string, string> = {
  'habit-created': 'Your new practice is ready. Start with a version that fits the day you have.',
  'habit-updated': 'Your habit design was saved.',
  'habit-saved': 'Your check-in was saved to its local calendar date.',
  'habit-cleared': 'The check-in was undone; the day is open again.',
  'reflection-saved': 'Reflection saved. A missed day is useful information, not a judgment.',
  'habit-archived': 'Habit archived. Its check-in history is preserved.',
  'habit-restored': 'Habit restored to your active practices.',
  'input-invalid': 'Review the form details and try again. No records were changed.',
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

const laws = [
  { key: 'obvious' as const, title: 'Make it obvious', prompt: 'Choose a visible cue, a clear time, or a specific implementation intention.' },
  { key: 'attractive' as const, title: 'Make it attractive', prompt: 'Pair the routine with something enjoyable or a reward you value.' },
  { key: 'easy' as const, title: 'Make it easy', prompt: 'Prepare the environment, reduce friction, or use the two-minute version.' },
  { key: 'satisfying' as const, title: 'Make it satisfying', prompt: 'Notice the check-in or choose a small immediate reward.' },
]

export function HabitDetail({
  habit,
  data,
  notice,
}: {
  habit: Habit
  data: HabitManagementData
  notice?: string
}) {
  const habitLogs = data.logs.filter((log) => log.habit_id === habit.id)
  const todayLog = habitLogs.find((log) => log.log_date === data.today)
  const streaks = getHabitStreaks(habit, habitLogs, data.today)
  const failureInsight = getCommonFailureInsight(habitLogs)
  const relatedIds = new Set(habit.schedule.behavior.relatedHabitIds)
  const related = data.relatedHabits.filter(({ id }) => relatedIds.has(id))
  const stackAfter = data.relatedHabits.find(({ id }) => id === habit.schedule.behavior.stackAfterHabitId)
  const relatedStart = addDateDays(data.today, -89)
  const noticeText = notice ? noticeMessages[notice] : undefined
  const canCheckInToday = habit.active && !isHabitEnded(habit, data.today) && isHabitScheduledOnDate(habit, data.today)
  const displayDescription = habit.description?.trim()

  return (
    <div className={styles.page}>
      <Link className={styles.subtleLink} href="/habits"><ArrowLeft size={14} aria-hidden="true" /> All habits</Link>
      {noticeText ? <p className={styles.notice} role="status">{noticeText}</p> : null}
      {data.hasLoadError ? <p className={styles.errorNotice} role="alert">Some related or historical records could not be loaded. Refresh to try again.</p> : null}
      {!data.historyComplete ? <p className={styles.notice} role="status">This habit has a large history; older records may be omitted from these totals.</p> : null}

      <header className={styles.detailHero}>
        <div>
          <p className={styles.kicker}>{PILLAR_LABELS[habit.pillar as keyof typeof PILLAR_LABELS] ?? 'Personal'} · {!habit.active ? 'ARCHIVED PRACTICE' : isHabitEnded(habit, data.today) ? 'ENDED PRACTICE' : 'ACTIVE PRACTICE'}</p>
          <h1>{habit.name}</h1>
          {displayDescription ? <p>{displayDescription}</p> : null}
          {habit.schedule.behavior.identity ? <p><strong>Becoming:</strong> {habit.schedule.behavior.identity}</p> : null}
          <p>
            {habit.schedule.daysOfWeek.length === 7 ? 'Every day' : habit.schedule.daysOfWeek.length === 1 ? 'Weekly' : `${habit.schedule.daysOfWeek.length} selected days each week`}
            {habit.schedule.timeOfDay ? ` · ${habit.schedule.timeOfDay}` : ''}
            {habit.schedule.location ? ` · ${habit.schedule.location}` : ''}
            {habit.target_value !== null ? ` · Target ${habit.target_value} ${habit.unit ?? ''}` : ''}
          </p>
          <p>Dates follow your configured timezone: {data.timeZone}. Started {formatDateKey(habit.schedule.startDate, { month: 'long', day: 'numeric', year: 'numeric' })}{habit.schedule.endDate ? ` · Ends ${formatDateKey(habit.schedule.endDate, { month: 'long', day: 'numeric', year: 'numeric' })}` : ''}.</p>
        </div>
        <div className={styles.detailActions}>
          <Link className={styles.subtleLink} href="#edit-habit">Edit design <ArrowUpRight size={14} aria-hidden="true" /></Link>
          {habit.active ? (
            <details className={styles.archiveDetails}>
              <summary><Pause size={13} aria-hidden="true" /> Archive</summary>
              <form action={archiveHabitAction} className={styles.archiveConfirm}>
                <input type="hidden" name="habitId" value={habit.id} />
                <p>Pause future check-ins? Saved history and reflections will remain available.</p>
                <HabitSubmitButton pendingLabel="Archiving…" variant="outline">Archive habit</HabitSubmitButton>
              </form>
            </details>
          ) : (
            <form action={restoreHabitAction} className={styles.detailActionForm}>
              <input type="hidden" name="habitId" value={habit.id} />
              <HabitSubmitButton pendingLabel="Restoring…" variant="outline"><RotateCcw data-icon="inline-start" aria-hidden="true" /> Restore</HabitSubmitButton>
            </form>
          )}
        </div>
      </header>

      <section className={styles.detailMetrics} aria-label="Habit consistency summary">
        <DetailMetric label="Current streak" value={streaks.current} note="consecutive scheduled completions" />
        <DetailMetric label="Longest streak" value={streaks.longest} note="completed opportunities in a row" />
        <DetailMetric label="Saved check-ins" value={habitLogs.length} note="actual records, including reflections" />
        <DetailMetric label="Two-minute version" value={habit.schedule.behavior.twoMinuteVersion ? 'Ready' : 'Not set'} note={habit.schedule.behavior.twoMinuteVersion || 'Add a small version in the design form'} />
      </section>

      {canCheckInToday ? (
        <section className={styles.detailPanel} aria-labelledby="today-checkin-title">
          <div className={styles.sectionHeader}>
            <div><p className={styles.kicker}>A CHECK-IN, NOT A TEST</p><h2 id="today-checkin-title">Today&apos;s practice</h2></div>
            {todayLog ? <Badge variant={todayLog.status === 'completed' ? 'secondary' : 'outline'}>{todayLog.status === 'completed' ? 'Full target' : todayLog.status === 'partial' ? 'Partial' : todayLog.status === 'skipped' ? 'Reflected' : 'Rest'}</Badge> : null}
          </div>
          <HabitCheckInForm habit={habit} date={data.today} log={todayLog} origin="detail" />
        </section>
      ) : (
        <section className={styles.detailPanel} aria-labelledby="today-checkin-title">
          <div className={styles.sectionHeader}><div><p className={styles.kicker}>NO CHECK-IN REQUIRED</p><h2 id="today-checkin-title">Today is not a scheduled opportunity</h2></div><CalendarDays size={18} aria-hidden="true" /></div>
          <p>Your schedule stays intact on unscheduled days. Check-ins are available only on the days you chose.</p>
        </section>
      )}

      <HabitAnalytics habit={habit} logs={data.logs} today={data.today} />

      <div className={styles.detailGrid}>
        <section className={styles.detailPanel} aria-labelledby="loop-title">
          <div className={styles.sectionHeader}><div><p className={styles.kicker}>CUE → ROUTINE → REWARD</p><h2 id="loop-title">The habit loop</h2></div><Leaf size={17} aria-hidden="true" /></div>
          <p>Use the current routine to understand the reward you seek. If you want to change a behavior, keep its useful cue and reward while experimenting with a different routine.</p>
          <dl className={styles.loopTable}>
            <LoopItem label="Cue" value={habit.schedule.behavior.cue || habit.schedule.timeOfDay || 'Not recorded yet'} />
            <LoopItem label="Craving" value={habit.schedule.behavior.craving || 'Not recorded yet'} />
            <LoopItem label="Routine" value={habit.schedule.behavior.routine || habit.name} />
            <LoopItem label="Reward" value={habit.schedule.behavior.reward || 'Not recorded yet'} />
            <LoopItem label="After this routine" value={stackAfter?.name || 'Not recorded yet'} />
            <LoopItem label="Potential keystone" value={habit.schedule.behavior.isKeystone ? 'Marked by you as potentially supportive' : 'Not marked'} />
          </dl>
        </section>

        <section className={styles.detailPanel} aria-labelledby="laws-title">
          <div className={styles.sectionHeader}><div><p className={styles.kicker}>SMALL SYSTEM ADJUSTMENTS</p><h2 id="laws-title">Four useful levers</h2></div></div>
          <ul className={styles.lawList}>
            {laws.map((law) => (
              <li key={law.key}><strong>{law.title}</strong><span>{habit.schedule.behavior[law.key] || law.prompt}</span></li>
            ))}
          </ul>
          {habit.schedule.behavior.environmentPrep || habit.schedule.behavior.friction || habit.schedule.behavior.environmentChange || habit.schedule.behavior.smallestCompletion ? (
            <div className={styles.environmentNotes}>
              <h3>Environment and minimum</h3>
              {habit.schedule.behavior.environmentPrep ? <p><strong>Prepare:</strong> {habit.schedule.behavior.environmentPrep}</p> : null}
              {habit.schedule.behavior.friction ? <p><strong>Friction:</strong> {habit.schedule.behavior.friction}</p> : null}
              {habit.schedule.behavior.environmentChange ? <p><strong>Change:</strong> {habit.schedule.behavior.environmentChange}</p> : null}
              {habit.schedule.behavior.smallestCompletion ? <p><strong>Smallest acceptable completion:</strong> {habit.schedule.behavior.smallestCompletion}</p> : null}
            </div>
          ) : null}
        </section>
      </div>

      <section className={styles.detailPanel} aria-labelledby="relationship-title">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>USER-DEFINED CONNECTIONS</p><h2 id="relationship-title">Related practices</h2></div></div>
        {related.length ? (
          <ul className={styles.relationshipList}>
            {related.map((item) => {
              const observation = getRelatedHabitObservation(habit.id, item.id, data.habits, data.logs, relatedStart, data.today)
              return (
                <li key={item.id}>
                  <Link href={`/habits/${item.id}`}>{item.name}{item.active ? '' : ' (archived)'} <ArrowUpRight size={12} aria-hidden="true" /></Link>
                  {observation ? <p className={styles.observationText}>{observation}</p> : <p className={styles.mutedText}>More overlapping saved opportunities are needed before a pattern is shown.</p>}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className={styles.mutedText}>No related habits chosen. Add a user-defined relationship in the edit form.</p>
        )}
        {habit.schedule.behavior.isKeystone ? <p className={styles.observationText}>You marked this as a potential keystone habit. LifeOS does not infer that it causes changes in related habits.</p> : null}
      </section>

      <section className={styles.detailPanel} aria-labelledby="reflections-title">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>MISSED DAYS ARE INFORMATION</p><h2 id="reflections-title">Failure analysis and recovery</h2></div></div>
        {failureInsight ? (
          <div className={styles.observation}>
            <Badge variant="outline">Recorded observation</Badge>
            <p><strong>Most recorded barrier:</strong> {failureInsight.label.toLowerCase()} in {failureInsight.count} check-ins.</p>
            <small>A possible experiment: {failureInsight.suggestion}</small>
          </div>
        ) : <p className={styles.mutedText}>Patterns are shown only after repeated saved reflections. No missed days are silently written as failures.</p>}
        {habit.active && !isHabitEnded(habit, data.today) ? <HabitReflectionForm habit={habit} logs={habitLogs} today={data.today} origin="detail" /> : null}
        <ol className={styles.historyList}>
          {habitLogs.filter((log) => log.status === 'skipped' || parseHabitReflection(log.note)).slice().reverse().map((log) => {
            const reflection = parseHabitReflection(log.note)
            return (
              <li className={styles.historyItem} key={log.id}>
                <time dateTime={log.log_date}>{formatDateKey(log.log_date, { month: 'long', day: 'numeric', year: 'numeric' })}</time>
                <div className={styles.historyBody}>
                  <Badge variant="outline">{log.status === 'skipped' ? getFailureReasonLabel(log.skipped_reason) : 'Reflection retained'}</Badge>
                  {reflection?.prevented ? <p><strong>What got in the way:</strong> {reflection.prevented}</p> : null}
                  {reflection?.systemArea ? <p><strong>System area:</strong> {reflection.systemArea}</p> : null}
                  {reflection?.adjustment ? <p><strong>Next experiment:</strong> {reflection.adjustment}</p> : null}
                  {reflection?.additionalNote ? <p>{reflection.additionalNote}</p> : null}
                  {displayHabitLogNote(log.note) ? <p>{displayHabitLogNote(log.note)}</p> : null}
                </div>
              </li>
            )
          })}
        </ol>
      </section>

      <details className={styles.createDetails} id="edit-habit">
        <summary><span><strong>Edit habit design</strong><small>Update its schedule, target or behavior plan. Past check-ins stay attached to their dates.</small></span><ArrowUpRight size={16} aria-hidden="true" /></summary>
        <HabitEditorForm today={data.today} timeZone={data.timeZone} habit={habit} relatedHabits={data.relatedHabits} />
      </details>

      <section className={styles.detailPanel} aria-labelledby="history-title">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>NO FABRICATED ACTIVITY</p><h2 id="history-title">Saved check-in history</h2></div><Badge variant="outline">{habitLogs.length} records</Badge></div>
        {habitLogs.length ? (
          <details className={styles.fullHistory}>
            <summary>View all check-ins</summary>
            <ol className={styles.historyList}>
              {habitLogs.slice().reverse().map((log) => {
                const reflection = parseHabitReflection(log.note)
                return (
                  <li className={styles.historyItem} key={log.id}>
                    <time dateTime={log.log_date}>{formatDateKey(log.log_date, { month: 'long', day: 'numeric', year: 'numeric' })}</time>
                    <div className={styles.historyBody}>
                      <Badge variant={log.status === 'completed' ? 'secondary' : 'outline'}>{log.status === 'completed' ? 'Full target' : log.status === 'partial' ? 'Partial progress' : log.status === 'skipped' ? getFailureReasonLabel(log.skipped_reason) : 'Intentional rest'}</Badge>
                      {log.value !== null ? <p>{log.value} {habit.unit}</p> : null}
                      {log.duration_seconds !== null ? <p>{formatDuration(log.duration_seconds)}</p> : null}
                      {reflection?.prevented ? <p><strong>What got in the way:</strong> {reflection.prevented}</p> : null}
                      {reflection?.systemArea ? <p><strong>System area:</strong> {reflection.systemArea}</p> : null}
                      {reflection?.adjustment ? <p><strong>Next experiment:</strong> {reflection.adjustment}</p> : null}
                      {reflection?.additionalNote ? <p>{reflection.additionalNote}</p> : null}
                      {displayHabitLogNote(log.note) ? <p>{displayHabitLogNote(log.note)}</p> : null}
                    </div>
                  </li>
                )
              })}
            </ol>
          </details>
        ) : <p className={styles.mutedText}>There are no saved check-ins yet. A scheduled day without a record is never added to history automatically.</p>}
      </section>

      <footer className={styles.pageFooter}>A practice, not a finish line. Your saved history remains yours when you pause this habit.</footer>
    </div>
  )
}

function DetailMetric({ label, value, note }: { label: string; value: number | string; note: string }) {
  return <div className={styles.detailMetric}><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
}

function LoopItem({ label, value }: { label: string; value: string }) {
  return <div className={styles.loopItem}><dt>{label}</dt><dd>{value}</dd></div>
}

function formatDuration(seconds: number): string {
  if (seconds >= 3600) return `${Math.round((seconds / 3600) * 100) / 100} hours`
  if (seconds >= 60) return `${Math.round((seconds / 60) * 100) / 100} minutes`
  return `${seconds} seconds`
}
