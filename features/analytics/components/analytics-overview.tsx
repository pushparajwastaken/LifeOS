import Link from 'next/link'
import styles from '@/features/quests/quests.module.css'
import a from '../analytics.module.css'
import {
  APPROXIMATION_NOTES,
  METRICS,
  METRIC_GROUP_LABELS,
  footnoteReasons,
  formatMinutes,
  type MetricId,
} from '../analytics-domain'
import type { AnalyticsData, AnalyticsGroupData, EventMetric, StateMetric } from '../analytics-service'
import { WeeklyBars } from './weekly-bars'

const EMPTY_LINKS: Record<AnalyticsGroupData['group'], { href: string; label: string }> = {
  productivity: { href: '/', label: 'Add a task on the overview' },
  habits: { href: '/habits', label: 'Set up a habit' },
  learning_effort: { href: '/learning', label: 'Log a learning session' },
  collection: { href: '/library', label: 'Save a resource' },
  learning_progress: { href: '/quests', label: 'Start a side quest' },
}

function unitOf(id: MetricId): 'minutes' | 'percent' | 'count' {
  const unit = (METRICS[id] as { unit?: 'minutes' | 'percent' }).unit
  return unit ?? 'count'
}

function formatValue(id: MetricId, value: number | null): string {
  if (value === null) return '—'
  const unit = unitOf(id)
  if (unit === 'percent') return `${value}%`
  if (unit === 'minutes') return formatMinutes(Math.round(value))
  return value.toLocaleString('en-US')
}

function weekLabel(key: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(new Date(`${key}T00:00:00Z`))
}

function summaryLabel(metric: EventMetric): string {
  const unit = unitOf(metric.id)
  if (metric.summary === null) return 'Nothing to measure in the last 12 weeks'
  return unit === 'percent' ? `${formatValue(metric.id, metric.summary)} over 12 weeks` : `${formatValue(metric.id, metric.summary)} in 12 weeks`
}

function comparisonLabel(metric: EventMetric): string | null {
  const comparison = metric.comparison
  if (!comparison) return null
  const usual = formatValue(metric.id, comparison.usual)
  const relation = comparison.direction === 'similar' ? `about the same as the usual ${usual}` : `${comparison.direction} than the usual ${usual}`
  return `Last full week ${formatValue(metric.id, comparison.lastWeek)}, ${relation} (4 weeks before)`
}

function EventCard({ metric, labels }: { metric: EventMetric; labels: string[] }) {
  const definition = METRICS[metric.id]
  const approximate = definition.kind === 'event_approximate'
  return (
    <div className={a.tile}>
      <span className={a.tileLabel}>{definition.label}{approximate ? ' *' : ''}</span>
      <strong className={a.tileValue}>{metric.summary === null ? '—' : formatValue(metric.id, metric.summary)}</strong>
      <span className={a.tileLabel}>{summaryLabel(metric)}</span>
      {comparisonLabel(metric) ? <span className={a.comparison}>{comparisonLabel(metric)}</span> : null}
      <WeeklyBars labels={labels.map(weekLabel)} values={metric.series} unit={unitOf(metric.id)} metricLabel={definition.label} />
      <div className="sr-only"><table>
        <caption>{definition.label} per week, Monday to Sunday</caption>
        <tbody>
          {labels.map((week, index) => <tr key={week}><th scope="row">Week of {weekLabel(week)}</th><td>{metric.series[index] === null ? 'No data' : formatValue(metric.id, metric.series[index])}</td></tr>)}
        </tbody>
      </table></div>
    </div>
  )
}

function StateCard({ metric }: { metric: StateMetric }) {
  const definition = METRICS[metric.id]
  return (
    <div className={a.tile}>
      <span className={a.tileLabel}>{definition.label}</span>
      <strong className={a.tileValue}>{formatValue(metric.id, metric.value)}</strong>
      {metric.detail ? <span className={a.tileLabel}>{metric.detail}</span> : null}
    </div>
  )
}

function GroupSection({ data, weeks }: { data: AnalyticsGroupData; weeks: string[] }) {
  const { title, summary } = METRIC_GROUP_LABELS[data.group]
  const reasons = footnoteReasons(data.events.map((metric) => metric.id))
  const headingId = `group-${data.group}`
  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      <div className={styles.sectionHeader}><div><p className={styles.kicker}>{title.toUpperCase()}</p><h2 id={headingId}>{title}</h2></div></div>
      <p className={styles.mutedNote} style={{ marginTop: 0 }}>{summary}</p>
      {!data.hasData ? (
        <p className={styles.mutedNote}>Nothing recorded here yet. <Link href={EMPTY_LINKS[data.group].href} className={styles.subtleLink}>{EMPTY_LINKS[data.group].label}</Link></p>
      ) : (
        <>
          <h3 className={a.zoneTitle}>RIGHT NOW · AS OF TODAY</h3>
          <div className={a.stateGrid}>
            {data.state.map((metric) => <StateCard key={metric.id} metric={metric} />)}
          </div>
          <h3 className={a.zoneTitle}>OVER TIME · LAST 12 WEEKS</h3>
          <div className={a.eventGrid}>
            {data.events.map((metric) => <EventCard key={metric.id} metric={metric} labels={weeks} />)}
          </div>
          {data.breakdowns?.some((item) => item.rows.length > 0) ? (
            <div className={a.breakdownGrid}>
              {data.breakdowns.filter((item) => item.rows.length > 0).map((item) => (
                <div key={item.title}>
                  <h3 className={a.zoneTitle} style={{ marginTop: 0 }}>{item.title.toUpperCase()} · 12 WEEKS</h3>
                  <dl className={styles.factList}>
                    {item.rows.map((row) => <div key={row.key} style={{ display: 'contents' }}><dt>{row.key}</dt><dd>{item.unit === 'minutes' ? formatMinutes(row.value) : row.value}</dd></div>)}
                  </dl>
                </div>
              ))}
            </div>
          ) : null}
          {reasons.length > 0 ? (
            <p className={a.footnote}>* Approximate: {reasons.map((reason) => APPROXIMATION_NOTES[reason]).join(' ')}</p>
          ) : null}
        </>
      )}
    </section>
  )
}

export function AnalyticsOverview({ data }: { data: AnalyticsData }) {
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>LIFE ANALYTICS · WEEKS RUN MONDAY TO SUNDAY · {data.timeZone.toUpperCase()}</p>
          <h1>Patterns, not a score.</h1>
          <p className={styles.heroCopy}>Five separate views of the last 12 weeks. They are never combined into one number. &ldquo;Right now&rdquo; figures describe today only; &ldquo;Over time&rdquo; charts count events. A blank week means there was nothing to measure, not zero. Where there is enough history, the last full week is compared with the four weeks before it.</p>
        </div>
      </header>
      {data.hasLoadError ? <p className={styles.errorNotice} role="alert">Some figures could not be loaded and may be incomplete. Refresh to try again.</p> : null}
      {data.truncated ? <p className={styles.notice} role="status">You have a lot of history; the oldest weeks may be undercounted.</p> : null}
      {data.groups.map((group) => <GroupSection key={group.group} data={group} weeks={data.weeks} />)}
    </div>
  )
}
