import Link from 'next/link'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDuration } from '@/features/learning/learning-domain'
import styles from '@/features/quests/quests.module.css'
import c from '../calendar-view.module.css'
import { KIND_LABELS, calendarHref, describeDay, shiftMonth, summarizeDays, type CalendarItem } from '../calendar-view-domain'

type Props = {
  month: string
  day: string
  today: string
  timeZone: string
  data: { grid: string[]; items: CalendarItem[]; truncated: boolean; hasLoadError: boolean }
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const monthLabel = (month: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(`${month}-01T00:00:00Z`))
const dayLabel = (day: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(`${day}T00:00:00Z`))

const KIND_ORDER: CalendarItem['kind'][] = ['goal_end', 'goal_milestone', 'quest_milestone', 'task_due', 'workout', 'run', 'rest', 'learning', 'task_done']

export function CalendarMonth({ month, day, today, timeZone, data }: Props) {
  const todayMonth = today.slice(0, 7)
  const summaries = summarizeDays(data.items)
  const weeks = Array.from({ length: 6 }, (_, index) => data.grid.slice(index * 7, index * 7 + 7))
  const dayItems = data.items
    .filter((item) => item.date === day)
    .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || (a.at && b.at ? Date.parse(a.at) - Date.parse(b.at) : 0))
  const timeFormat = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' })
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>CALENDAR · {timeZone.replaceAll('_', ' ').toUpperCase()}</p>
          <h1>{monthLabel(month)}</h1>
          <p className={styles.heroCopy}>Everything in LifeOS that has a date: tasks due and done, learning, training, goal and milestone dates. Choose a day to see it in full or plan it.</p>
        </div>
        <nav className={styles.inlineForm} aria-label="Change month" style={{ marginTop: 0 }}>
          <Link href={calendarHref(shiftMonth(month, -1), null, todayMonth)} className={styles.subtleLink}><ChevronLeft size={16} aria-hidden="true" /> {monthLabel(shiftMonth(month, -1)).split(' ')[0]}</Link>
          {month !== todayMonth ? <Link href="/calendar" className={styles.subtleLink}>This month</Link> : null}
          <Link href={calendarHref(shiftMonth(month, 1), null, todayMonth)} className={styles.subtleLink}>{monthLabel(shiftMonth(month, 1)).split(' ')[0]} <ChevronRight size={16} aria-hidden="true" /></Link>
        </nav>
      </header>

      {data.hasLoadError ? <p className={styles.errorNotice} role="alert">Some records could not be loaded. Refresh to try again.</p> : null}
      {data.truncated ? <p className={styles.notice} role="status">This month has a lot of records; some may be missing from the grid.</p> : null}

      <section className={styles.panel} aria-labelledby="month-heading">
        <h2 id="month-heading" className="sr-only">{monthLabel(month)}, Monday to Sunday</h2>
        <table className={c.grid}>
          <thead><tr>{WEEKDAYS.map((weekday) => <th key={weekday} scope="col">{weekday}</th>)}</tr></thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week[0]}>
                {week.map((date) => {
                  const summary = summaries.get(date)
                  const outside = !date.startsWith(month)
                  return (
                    <td key={date}>
                      <Link
                        href={calendarHref(month, date, todayMonth)}
                        className={c.cell}
                        data-outside={outside ? 'true' : undefined}
                        data-today={date === today ? 'true' : undefined}
                        data-selected={date === day ? 'true' : undefined}
                        aria-current={date === day ? 'date' : undefined}
                        aria-label={`${dayLabel(date)}${date === today ? ', today' : ''}: ${describeDay(summary)}`}
                      >
                        <span className={c.dayNumber}>{Number(date.slice(8))}</span>
                        {summary ? (
                          <span className={c.chips} aria-hidden="true">
                            {summary.deadlines ? <span className={c.chip} data-kind="deadline">{summary.deadlines} due date{summary.deadlines === 1 ? '' : 's'}</span> : null}
                            {summary.due ? <span className={c.chip} data-kind="due">{summary.due} to do</span> : null}
                            {summary.done ? <span className={c.chip}>{summary.done} done</span> : null}
                            {summary.training ? <span className={c.chip}>{summary.training} training</span> : null}
                            {summary.rest ? <span className={c.chip}>rest</span> : null}
                            {summary.learningMinutes ? <span className={c.chip}>{formatDuration(summary.learningMinutes)}</span> : null}
                          </span>
                        ) : null}
                      </Link>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className={c.legend}><span>“To do” = open tasks due that day</span><span>“Due dates” = goal ends and open milestones</span><span>Training = workouts and runs</span></p>
      </section>

      <section className={styles.panel} aria-labelledby="day-heading">
        <div className={styles.sectionHeader}>
          <div><p className={styles.kicker}>{day === today ? 'TODAY' : 'SELECTED DAY'}</p><h2 id="day-heading">{dayLabel(day)}</h2></div>
          <Link href={day === today ? '/planner' : `/planner?date=${day}`} className={styles.subtleLink}><CalendarDays size={14} aria-hidden="true" /> Open in planner</Link>
        </div>
        {dayItems.length ? (
          <ul className={styles.itemList}>
            {dayItems.map((item, index) => (
              <li key={`${item.kind}-${index}`} className={styles.checkItem} data-done={item.kind === 'task_done' ? 'true' : undefined}>
                <span className={styles.statusBadge} data-status={item.kind === 'task_done' ? 'completed' : item.kind === 'goal_end' || item.kind.endsWith('milestone') ? 'paused' : undefined}>{KIND_LABELS[item.kind]}</span>
                <span className={styles.itemTitle}>
                  {item.href ? <Link href={item.href}>{item.title}</Link> : item.title}
                  <span className={styles.itemMeta}>{[item.at ? timeFormat.format(new Date(item.at)) : null, item.minutes ? formatDuration(item.minutes) : null].filter(Boolean).join(' · ')}</span>
                </span>
                <span />
              </li>
            ))}
          </ul>
        ) : <p className={styles.mutedNote}>Nothing recorded for this day.</p>}
        <p className={styles.mutedNote}>Google Calendar events are not shown here yet; connect Google Calendar in <Link href="/settings" className={styles.subtleLink}>Settings</Link>.</p>
      </section>
    </div>
  )
}
