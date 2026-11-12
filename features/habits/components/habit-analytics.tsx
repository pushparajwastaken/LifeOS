import { Progress } from '@/components/ui/progress'
import {
  addDateDays,
  formatDateKey,
  getCalendarDays,
  getHabitStreaks,
  getMonthlySeries,
  getPeriodMetrics,
  getWeekStart,
  getWeekdayPerformance,
  getWeeklySeries,
  getWeekdayIndex,
  type Habit,
  type HabitLog,
} from '../habit-domain'
import styles from '../habit-management.module.css'

export function WeeklyConsistencyChart({ habits, logs, today }: { habits: Habit[]; logs: HabitLog[]; today: string }) {
  const weeks = getWeeklySeries(habits, logs, today, 8)
  const hasData = weeks.some((week) => week.opportunities > 0)
  return (
    <div className={styles.chartSection}>
      <div className={styles.chartHeading}>
        <div><p className={styles.kicker}>SCHEDULED OPPORTUNITIES</p><h3>Weekly consistency</h3></div>
        <p>{hasData ? 'Full-target completions only' : 'No saved check-ins yet'}</p>
      </div>
      {hasData ? (
        <div className={styles.weekChart} role="img" aria-label={`Weekly completion over the last eight weeks: ${weeks.map((week) => `${week.label} ${week.percentage ?? 0} percent from ${week.opportunities} scheduled opportunities`).join('; ')}`}>
          {weeks.map((week) => (
            <div className={styles.weekColumn} key={week.startDate}>
              <div className={styles.weekBarTrack}>
                <span className={styles.weekBar} style={{ height: `${week.percentage ?? 0}%` }} />
              </div>
              <span className={styles.weekPercent}>{week.percentage === null ? '—' : `${week.percentage}%`}</span>
              <span className={styles.weekLabel}>{week.label}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.chartEmpty}>Consistency trends appear after scheduled check-ins are recorded.</p>
      )}
    </div>
  )
}

export function HabitCalendar({ habit, logs, today }: { habit: Habit; logs: HabitLog[]; today: string }) {
  const days = getCalendarDays(habit, logs, today, 182)
  const counts = days.reduce<Record<string, number>>((total, day) => {
    total[day.status] = (total[day.status] ?? 0) + 1
    return total
  }, {})
  const leading = (getWeekdayIndex(days[0]?.date ?? today) + 6) % 7
  const calendarCells = [
    ...Array.from({ length: leading }, (_, index) => <span key={`pad-${index}`} className={styles.calendarPad} aria-hidden="true" />),
    ...days.map((day) => (
      <span
        key={day.date}
        className={`${styles.calendarDay} ${styles[`calendar-${day.status}`] ?? ''}`}
        title={`${formatDateKey(day.date, { weekday: 'long', month: 'short', day: 'numeric' })}: ${statusLabel(day.status)}`}
        aria-hidden="true"
      />
    )),
  ]
  return (
    <div className={styles.calendarSection}>
      <div className={styles.chartHeading}>
        <div><p className={styles.kicker}>LAST 26 WEEKS</p><h3>Completion calendar</h3></div>
        <p>{counts.completed ?? 0} full completions · {counts.partial ?? 0} partial</p>
      </div>
      <div className={styles.calendarLayout}>
        <div className={styles.weekdayLabels} aria-hidden="true">
          <span>Mon</span><span>Wed</span><span>Fri</span>
        </div>
        <div className={styles.calendarGrid} role="img" aria-label={`Completion calendar for the last 26 weeks. ${counts.completed ?? 0} full completions, ${counts.partial ?? 0} partial sessions, ${counts.missed ?? 0} missed scheduled days, ${counts.skipped ?? 0} reflected missed days. Each square is a local calendar date.`}>
          {calendarCells}
        </div>
      </div>
      <ul className={styles.calendarLegend} aria-label="Calendar legend">
        <li><span className={`${styles.calendarKey} ${styles['calendar-completed']}`} />Completed</li>
        <li><span className={`${styles.calendarKey} ${styles['calendar-partial']}`} />Partial</li>
        <li><span className={`${styles.calendarKey} ${styles['calendar-missed']}`} />No check-in</li>
        <li><span className={`${styles.calendarKey} ${styles['calendar-skipped']}`} />Reflected</li>
      </ul>
    </div>
  )
}

export function HabitAnalytics({ habit, logs, today }: { habit: Habit; logs: HabitLog[]; today: string }) {
  const habitLogs = logs.filter((log) => log.habit_id === habit.id)
  const weeks = getWeeklySeries([habit], habitLogs, today, 12)
  const months = getMonthlySeries(habit, habitLogs, today, 6)
  const weekdays = getWeekdayPerformance(habit, habitLogs, today, 180)
  const monthStart = `${today.slice(0, 7)}-01`
  const monthMetrics = getPeriodMetrics(habit, habitLogs, monthStart, today, today)
  const streaks = getHabitStreaks(habit, habitLogs, today)
  const bestWeekday = weekdays
    .filter((day) => day.opportunities >= 4 && day.percentage !== null)
    .sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0))[0]
  const hasHistory = weeks.some((week) => week.opportunities > 0)

  return (
    <section className={styles.analyticsSection} aria-labelledby="habit-analytics-title">
      <div className={styles.sectionHeading}>
        <p className={styles.kicker}>LEARN FROM THE RECORD</p>
        <h2 id="habit-analytics-title">Consistency, not perfection</h2>
        <p>Only saved check-ins and scheduled opportunities are included. Partial sessions stay distinct from full targets.</p>
      </div>
      <div className={styles.analyticsMetrics}>
        <div><span>Current streak</span><strong>{streaks.current}</strong><small>scheduled opportunities</small></div>
        <div><span>Longest streak</span><strong>{streaks.longest}</strong><small>full targets in a row</small></div>
        <div><span>This month</span><strong>{monthMetrics.percentage === null ? '—' : `${monthMetrics.percentage}%`}</strong><small>{monthMetrics.completed} of {monthMetrics.opportunities} opportunities</small></div>
      </div>
      <div className={styles.analyticsGrid}>
        <div className={styles.analyticsPanel}>
          <div className={styles.chartHeading}><div><p className={styles.kicker}>12-WEEK TREND</p><h3>Weekly completion</h3></div></div>
          {hasHistory ? (
            <div className={styles.weekChart} role="img" aria-label={`Weekly full-target completion for ${habit.name}: ${weeks.map((week) => `${week.label}, ${week.percentage ?? 0} percent`).join('; ')}`}>
              {weeks.map((week) => (
                <div className={styles.weekColumn} key={week.startDate}>
                  <div className={styles.weekBarTrack}><span className={styles.weekBar} style={{ height: `${week.percentage ?? 0}%` }} /></div>
                  <span className={styles.weekPercent}>{week.percentage === null ? '—' : `${week.percentage}%`}</span>
                  <span className={styles.weekLabel}>{week.label}</span>
                </div>
              ))}
            </div>
          ) : <p className={styles.chartEmpty}>A trend will appear when scheduled opportunities have check-ins.</p>}
        </div>
        <div className={styles.analyticsPanel}>
          <div className={styles.chartHeading}><div><p className={styles.kicker}>LAST SIX MONTHS</p><h3>Monthly consistency</h3></div></div>
          <div className={styles.monthList}>
            {months.map((month) => (
              <div className={styles.monthRow} key={month.startDate}>
                <span>{month.label}</span>
                <Progress value={month.percentage ?? 0} aria-label={`${month.label} completion`} className={styles.progress} />
                <strong>{month.percentage === null ? '—' : `${month.percentage}%`}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
      <HabitCalendar habit={habit} logs={habitLogs} today={today} />
      <div className={styles.weekdayPanel}>
        <div className={styles.chartHeading}><div><p className={styles.kicker}>SCHEDULED DAYS ONLY</p><h3>Completion by weekday</h3></div></div>
        <div className={styles.weekdayList}>
          {weekdays.map((day) => (
            <div className={styles.weekdayRow} key={day.value}>
              <span>{day.long}</span>
              <Progress value={day.percentage ?? 0} aria-label={`${day.long} completion`} className={styles.progress} />
              <strong>{day.opportunities ? `${day.completed}/${day.opportunities}` : '—'}</strong>
            </div>
          ))}
        </div>
        {bestWeekday ? (
          <p className={styles.observationText}>
            Observation, not a cause: {bestWeekday.completed} of {bestWeekday.opportunities} scheduled {bestWeekday.long.toLowerCase()} sessions were completed.
          </p>
        ) : (
          <p className={styles.chartEmpty}>A weekday pattern is shown after at least four opportunities on a weekday.</p>
        )}
      </div>
    </section>
  )
}

export function WeeklySummary({ habits, logs, today }: { habits: Habit[]; logs: HabitLog[]; today: string }) {
  const startDate = addDateDays(getWeekStart(today), 0)
  const weeks = getWeeklySeries(habits, logs, today, 1)
  const current = weeks[0]
  return (
    <div className={styles.weeklySummary}>
      <span>Since {formatDateKey(startDate)}</span>
      <strong>{current.percentage === null ? 'No scheduled check-ins yet' : `${current.percentage}% full-target completion`}</strong>
      <small>{current.completed} completed · {current.partial} partial · {current.missed} missed opportunities</small>
    </div>
  )
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    completed: 'full target completed',
    partial: 'partial progress',
    skipped: 'missed and reflected',
    rest: 'intentional rest',
    missed: 'no check-in recorded',
    upcoming: 'today is still open',
    unscheduled: 'not scheduled',
  }
  return labels[status] ?? status
}
