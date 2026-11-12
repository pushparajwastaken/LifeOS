import Link from 'next/link'
import { ArrowUpRight, Clock3, Leaf } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { getHabitStreaks, getNextScheduledDate, getPeriodMetrics, formatDateKey, isHabitEnded, PILLAR_LABELS, type Habit, type HabitLog } from '../habit-domain'
import { HabitCheckInForm } from './habit-check-in-form'
import styles from '../habit-management.module.css'

export function HabitRow({
  habit,
  logs,
  today,
  origin = 'overview',
  showCheckIn = false,
}: {
  habit: Habit
  logs: HabitLog[]
  today: string
  origin?: 'dashboard' | 'overview'
  showCheckIn?: boolean
}) {
  const todayLog = logs.find((log) => log.habit_id === habit.id && log.log_date === today)
  const streak = getHabitStreaks(habit, logs.filter((log) => log.habit_id === habit.id), today)
  const last30 = getPeriodMetrics(habit, logs.filter((log) => log.habit_id === habit.id), `${today.slice(0, 7)}-01`, today, today)
  const progress = last30.percentage
  const nextScheduled = habit.active && !isHabitEnded(habit, today)
    ? getNextScheduledDate(habit, today)
    : null

  return (
    <li className={styles.habitRow}>
      <div className={styles.habitRowMain}>
        <Link href={`/habits/${habit.id}`} className={styles.habitRowTitle}>
          <span className={styles.habitMark}><Leaf size={16} aria-hidden="true" /></span>
          <span>
            <strong>{habit.name}</strong>
            <small>{PILLAR_LABELS[habit.pillar as keyof typeof PILLAR_LABELS] ?? 'Personal'} · {habit.schedule.daysOfWeek.length === 7 ? 'Daily' : `${habit.schedule.daysOfWeek.length} days a week`}</small>
          </span>
          <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
        <div className={styles.habitRowMeta}>
          {habit.schedule.timeOfDay ? <span><Clock3 size={13} aria-hidden="true" /> {habit.schedule.timeOfDay}</span> : null}
          {habit.schedule.location ? <span>{habit.schedule.location}</span> : null}
          {habit.schedule.behavior.isKeystone ? <Badge variant="secondary">Potential keystone</Badge> : null}
          {habit.target_value !== null ? <Badge variant="outline">Target {habit.target_value} {habit.unit}</Badge> : null}
          {!habit.active ? <Badge variant="outline">Archived</Badge> : isHabitEnded(habit, today) ? <Badge variant="outline">Ended</Badge> : null}
        </div>
        <div className={styles.habitRowProgress}>
          <Progress value={progress ?? 0} aria-label={`${habit.name} monthly completion`} className={styles.progress} />
          <span>{progress === null ? 'No scheduled check-ins yet' : `${progress}% this month`}</span>
        </div>
        <p className={styles.streakNote}>
          {streak.current > 0 ? `${streak.current} consecutive scheduled ${streak.current === 1 ? 'opportunity' : 'opportunities'} completed` : 'A fresh start is always available'}
          {nextScheduled ? ` · Next on ${formatDateKey(nextScheduled)}` : ''}
        </p>
      </div>
      {showCheckIn ? <HabitCheckInForm habit={habit} date={today} log={todayLog} origin={origin} compact /> : null}
    </li>
  )
}
