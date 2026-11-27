import Link from 'next/link'
import { Trash2 } from 'lucide-react'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { WeeklyBars } from '@/features/analytics/components/weekly-bars'
import a from '@/features/analytics/analytics.module.css'
import { IconSubmitButton } from '@/features/quests/components/icon-submit-button'
import { SubmitButton } from '@/features/quests/components/submit-button'
import { resolveNotice } from '@/features/quests/quest-notices'
import styles from '@/features/quests/quests.module.css'
import { deletePhysicalEntryAction, logBodyAction, logRunAction, logSleepAction, logWorkoutAction } from '../physical-actions'
import { MEASUREMENT_FIELDS, PHYSICAL_LIMITS, describeMeasurements, formatClock, formatNumber, formatPace } from '../physical-domain'
import type { ActivityItem, PhysicalData } from '../physical-service'

type Props = { data: PhysicalData; today: string; timeZone: string; nowTime: string; notice?: string }

const weekLabel = (key: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(new Date(`${key}T00:00:00Z`))
const dayLabel = (key: string, today: string) => key === today ? 'Today' : new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${key}T00:00:00Z`))
const hours = (minutes: number) => `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ''}`

function Chart({ title, values, labels, unit, format }: { title: string; values: Array<number | null>; labels: string[]; unit: string; format: (value: number) => string }) {
  return (
    <div className={a.tile}>
      <span className={a.tileLabel}>{title}</span>
      <WeeklyBars labels={labels.map(weekLabel)} values={values} unit="count" metricLabel={title} />
      <div className="sr-only"><table>
        <caption>{title} per week, Monday to Sunday ({unit})</caption>
        <tbody>{labels.map((week, index) => <tr key={week}><th scope="row">Week of {weekLabel(week)}</th><td>{values[index] === null ? 'No data' : format(values[index] as number)}</td></tr>)}</tbody>
      </table></div>
    </div>
  )
}

function DateTimeFields({ prefix, today, nowTime, withTime = true }: { prefix: string; today: string; nowTime: string; withTime?: boolean }) {
  return (
    <>
      <Field>
        <FieldLabel htmlFor={`${prefix}-date`}>{withTime ? 'Date' : 'Night of'}</FieldLabel>
        <Input id={`${prefix}-date`} name="date" type="date" required max={today} defaultValue={withTime ? today : undefined} />
      </Field>
      {withTime ? (
        <Field>
          <FieldLabel htmlFor={`${prefix}-time`}>Time</FieldLabel>
          <Input id={`${prefix}-time`} name="time" type="time" defaultValue={nowTime} />
        </Field>
      ) : null}
    </>
  )
}

function describe(item: ActivityItem, timeZone: string): { title: string; meta: string; href?: string } {
  const time = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date(item.at))
  if (item.kind === 'workout') {
    return item.workout.rest_day
      ? { title: 'Rest day', meta: item.workout.notes ?? '' }
      : { title: item.workout.title, meta: [time, item.exerciseCount ? `${item.exerciseCount} ${item.exerciseCount === 1 ? 'exercise' : 'exercises'}` : 'No exercises logged'].join(' · '), href: `/physical/workouts/${item.id}` }
  }
  if (item.kind === 'run') return { title: `Run · ${formatNumber(item.run.distance, 2)} ${item.run.distance_unit}`, meta: [time, formatClock(item.run.duration_seconds), formatPace(item.run.duration_seconds, item.run.distance, item.run.distance_unit), item.run.notes].filter(Boolean).join(' · ') }
  if (item.kind === 'body') return { title: item.body.weight === null ? 'Measurements' : `Weight · ${formatNumber(item.body.weight)} ${item.body.weight_unit}`, meta: [time, describeMeasurements(item.body.measurements), item.body.notes].filter(Boolean).join(' · ') }
  return { title: `Sleep · ${hours(item.sleep.duration_minutes)}`, meta: [item.sleep.recovery_score !== null ? `Recovery ${item.sleep.recovery_score}/100` : null, item.sleep.notes].filter(Boolean).join(' · ') }
}

export function PhysicalOverview({ data, today, timeZone, nowTime, notice }: Props) {
  const message = resolveNotice(notice)
  const { thisWeek } = data
  const hasAny = data.activity.length > 0 || data.series.workouts.some(Boolean) || data.series.km.some(Boolean) || data.series.sleepHours.some((value) => value !== null)
  const groups = data.activity.reduce<Array<{ date: string; items: ActivityItem[] }>>((list, item) => {
    const last = list.at(-1)
    if (last && last.date === item.date) last.items.push(item)
    else list.push({ date: item.date, items: [item] })
    return list
  }, [])
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>PHYSICAL · WEEKS RUN MONDAY TO SUNDAY</p>
          <h1>Movement, recovery and rest.</h1>
          <p className={styles.heroCopy}>Log training, runs, sleep and weight. Nothing here is scored; the charts only show what you recorded.</p>
        </div>
        <div className={styles.inlineForm} style={{ marginTop: 0 }}><Link href="#log" className={styles.primaryLink}>Log something</Link></div>
      </header>

      {message ? <p className={message.tone === 'error' ? styles.errorNotice : styles.notice} role={message.tone === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
      {data.hasLoadError ? <p className={styles.errorNotice} role="alert">Some records could not be loaded. Refresh to try again; nothing was changed.</p> : null}
      {data.truncated ? <p className={styles.notice} role="status">You have a lot of recent history; the oldest weeks may be undercounted.</p> : null}

      <section className={styles.panel} aria-labelledby="week-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>THIS WEEK SO FAR</p><h2 id="week-heading">Right now</h2></div></div>
        <div className={a.stateGrid}>
          <div className={a.tile}><span className={a.tileLabel}>Workouts</span><strong className={a.tileValue}>{thisWeek.workouts}</strong>{thisWeek.restDays ? <span className={a.tileLabel}>{thisWeek.restDays} rest {thisWeek.restDays === 1 ? 'day' : 'days'}</span> : null}</div>
          <div className={a.tile}><span className={a.tileLabel}>Running</span><strong className={a.tileValue}>{formatNumber(thisWeek.km)} km</strong><span className={a.tileLabel}>{thisWeek.runs} {thisWeek.runs === 1 ? 'run' : 'runs'}</span></div>
          <div className={a.tile}><span className={a.tileLabel}>Average sleep</span><strong className={a.tileValue}>{thisWeek.sleepAverage === null ? '—' : `${formatNumber(thisWeek.sleepAverage)} h`}</strong><span className={a.tileLabel}>{thisWeek.sleepNights ? `${thisWeek.sleepNights} ${thisWeek.sleepNights === 1 ? 'night' : 'nights'} logged` : 'No nights logged'}</span></div>
          <div className={a.tile}><span className={a.tileLabel}>Latest weight</span><strong className={a.tileValue}>{data.latestWeight ? `${formatNumber(data.latestWeight.weight)} ${data.latestWeight.unit}` : '—'}</strong>
            <span className={a.tileLabel}>{data.weightChange ? `${data.weightChange.change > 0 ? '+' : ''}${formatNumber(data.weightChange.change)} ${data.weightChange.unit} since ${new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric' }).format(new Date(data.weightChange.sinceIso))}` : data.latestWeight ? 'Log again in a few weeks to see a change' : 'Not logged yet'}</span></div>
        </div>
        {hasAny ? (
          <>
            <h3 className={a.zoneTitle}>OVER TIME · LAST 8 WEEKS</h3>
            <div className={a.eventGrid}>
              <Chart title="Workouts" values={data.series.workouts} labels={data.weeks} unit="sessions" format={String} />
              <Chart title="Running distance (km)" values={data.series.km} labels={data.weeks} unit="km, miles converted" format={(value) => `${formatNumber(value)} km`} />
              <Chart title="Average sleep (hours)" values={data.series.sleepHours} labels={data.weeks} unit="hours per logged night" format={(value) => `${formatNumber(value)} h`} />
            </div>
            <p className={a.footnote}>Rest days are not counted as workouts. Weeks with no sleep logged are left blank, not zero.</p>
          </>
        ) : null}
      </section>

      <section className={styles.panel} id="log" aria-labelledby="log-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>LOG</p><h2 id="log-heading">Add an entry</h2></div></div>
        <div className={a.breakdownGrid} style={{ marginTop: 0 }}>
          <details className={a.tile} open>
            <summary className={styles.itemTitle}><strong>Workout or rest day</strong></summary>
            <form action={logWorkoutAction} className={styles.editorForm}>
              <Field><FieldLabel htmlFor="workout-title">Workout</FieldLabel><Input id="workout-title" name="title" maxLength={PHYSICAL_LIMITS.title} placeholder="Upper body, yoga, football…" /></Field>
              <DateTimeFields prefix="workout" today={today} nowTime={nowTime} />
              <label className={styles.itemMeta} style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" name="restDay" /> This was a planned rest day</label>
              <Field><FieldLabel htmlFor="workout-notes">Notes</FieldLabel><Textarea id="workout-notes" name="notes" maxLength={PHYSICAL_LIMITS.notes} rows={2} /></Field>
              <div className={styles.editorFooter}><SubmitButton pendingLabel="Saving…">Save</SubmitButton></div>
            </form>
          </details>
          <details className={a.tile}>
            <summary className={styles.itemTitle}><strong>Run</strong></summary>
            <form action={logRunAction} className={styles.editorForm}>
              <Field><FieldLabel htmlFor="run-distance">Distance</FieldLabel>
                <span style={{ display: 'flex', gap: 8 }}><Input id="run-distance" name="distance" inputMode="decimal" required maxLength={8} placeholder="5.2" />
                  <select name="unit" aria-label="Distance unit" className={styles.nativeSelect} style={{ width: 'auto' }} defaultValue="km"><option value="km">km</option><option value="mi">mi</option></select></span></Field>
              <Field><FieldLabel htmlFor="run-duration">Duration</FieldLabel><Input id="run-duration" name="duration" required maxLength={9} placeholder="28:45" /><FieldDescription>Minutes, m:ss or h:mm:ss.</FieldDescription></Field>
              <DateTimeFields prefix="run" today={today} nowTime={nowTime} />
              <Field><FieldLabel htmlFor="run-notes">Notes</FieldLabel><Textarea id="run-notes" name="notes" maxLength={PHYSICAL_LIMITS.notes} rows={2} /></Field>
              <div className={styles.editorFooter}><SubmitButton pendingLabel="Saving…">Save run</SubmitButton></div>
            </form>
          </details>
          <details className={a.tile}>
            <summary className={styles.itemTitle}><strong>Sleep</strong></summary>
            <form action={logSleepAction} className={styles.editorForm}>
              <DateTimeFields prefix="sleep" today={today} nowTime={nowTime} withTime={false} />
              <Field><FieldLabel htmlFor="sleep-hours">Duration</FieldLabel>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Input id="sleep-hours" name="hours" inputMode="numeric" required maxLength={2} placeholder="7" aria-label="Hours" style={{ width: 70 }} /> h
                  <Input name="minutes" inputMode="numeric" maxLength={2} placeholder="30" aria-label="Minutes" style={{ width: 70 }} /> min</span></Field>
              <Field><FieldLabel htmlFor="sleep-recovery">Recovery score (optional)</FieldLabel><Input id="sleep-recovery" name="recovery" inputMode="numeric" maxLength={3} placeholder="0–100" /><FieldDescription>From a wearable, or your own 0–100 rating.</FieldDescription></Field>
              <Field><FieldLabel htmlFor="sleep-notes">Notes</FieldLabel><Textarea id="sleep-notes" name="notes" maxLength={PHYSICAL_LIMITS.notes} rows={2} /></Field>
              <div className={styles.editorFooter}><p>One entry per night; saving the same night again replaces it.</p><SubmitButton pendingLabel="Saving…">Save sleep</SubmitButton></div>
            </form>
          </details>
          <details className={a.tile}>
            <summary className={styles.itemTitle}><strong>Body weight and measurements</strong></summary>
            <form action={logBodyAction} className={styles.editorForm}>
              <Field><FieldLabel htmlFor="body-weight">Weight</FieldLabel>
                <span style={{ display: 'flex', gap: 8 }}><Input id="body-weight" name="weight" inputMode="decimal" maxLength={8} placeholder="72.4" />
                  <select name="unit" aria-label="Weight unit" className={styles.nativeSelect} style={{ width: 'auto' }} defaultValue={data.latestWeight?.unit ?? 'kg'}><option value="kg">kg</option><option value="lb">lb</option></select></span></Field>
              <div className={styles.fieldGrid}>
                {MEASUREMENT_FIELDS.map(({ key, label }) => (
                  <Field key={key}><FieldLabel htmlFor={`body-${key}`}>{label}{key === 'body_fat' ? '' : ' (cm, or in with lb)'}</FieldLabel><Input id={`body-${key}`} name={key} inputMode="decimal" maxLength={6} /></Field>
                ))}
              </div>
              <DateTimeFields prefix="body" today={today} nowTime={nowTime} />
              <Field><FieldLabel htmlFor="body-notes">Notes</FieldLabel><Textarea id="body-notes" name="notes" maxLength={PHYSICAL_LIMITS.notes} rows={2} /></Field>
              <div className={styles.editorFooter}><SubmitButton pendingLabel="Saving…">Save weight</SubmitButton></div>
            </form>
          </details>
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="recent-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>LAST 14 DAYS</p><h2 id="recent-heading">Recent entries</h2></div></div>
        {groups.length ? groups.map((group) => (
          <div key={group.date}>
            <p className={styles.kicker} style={{ marginTop: 14 }}>{dayLabel(group.date, today).toUpperCase()}</p>
            <ul className={styles.itemList}>
              {group.items.map((item) => {
                const info = describe(item, timeZone)
                return (
                  <li key={`${item.kind}-${item.id}`} className={styles.checkItem}>
                    <span className={styles.statusBadge}>{item.kind === 'workout' ? (item.workout.rest_day ? 'Rest' : 'Workout') : item.kind === 'run' ? 'Run' : item.kind === 'body' ? 'Body' : 'Sleep'}</span>
                    <span className={styles.itemTitle}>{info.href ? <Link href={info.href}>{info.title}</Link> : info.title}{info.meta ? <span className={styles.itemMeta}>{info.meta}</span> : null}</span>
                    <form action={deletePhysicalEntryAction}>
                      <input type="hidden" name="kind" value={item.kind} />
                      <input type="hidden" name="entryId" value={item.id} />
                      <IconSubmitButton label={`Delete ${info.title} (${dayLabel(group.date, today)})`}><Trash2 size={14} aria-hidden="true" /></IconSubmitButton>
                    </form>
                  </li>
                )
              })}
            </ul>
          </div>
        )) : <p className={styles.mutedNote}>Nothing logged in the last two weeks. Start with whatever you did today, even a walk or a rest day.</p>}
      </section>
    </div>
  )
}
