import Link from 'next/link'
import { FolderKanban, Plus, Rocket, Trash2 } from 'lucide-react'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import a from '@/features/analytics/analytics.module.css'
import { WeeklyBars } from '@/features/analytics/components/weekly-bars'
import { formatMinutes, plural } from '@/features/pillars/pillar-domain'
import { IconSubmitButton } from '@/features/quests/components/icon-submit-button'
import { SubmitButton } from '@/features/quests/components/submit-button'
import { resolveNotice } from '@/features/quests/quest-notices'
import styles from '@/features/quests/quests.module.css'
import { createProjectAction, deleteProfessionalEntryAction, logCodingAction, logDsaAction, logShippedAction } from '../professional-actions'
import { DSA_DIFFICULTIES, DSA_OUTCOMES, DSA_OUTCOME_LABELS, PROFESSIONAL_LIMITS, PROJECT_STATUSES, PROJECT_STATUS_LABELS, type DsaOutcome, type ProjectStatus } from '../professional-domain'
import type { getProfessionalData } from '../professional-service'

type Data = Awaited<ReturnType<typeof getProfessionalData>>
type Filter = ProjectStatus | 'all'

const weekLabel = (key: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(new Date(`${key}T00:00:00Z`))

export function ProjectSelect({ id, projects, defaultValue = '' }: { id: string; projects: Data['projects']; defaultValue?: string }) {
  return (
    <select id={id} name="projectId" className={styles.nativeSelect} defaultValue={defaultValue}>
      <option value="">No project</option>
      {projects.filter((project) => project.status === 'active' || project.id === defaultValue).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
    </select>
  )
}

export function DeleteEntry({ kind, id, label, projectId }: { kind: 'coding' | 'shipped' | 'dsa'; id: string; label: string; projectId?: string }) {
  return (
    <form action={deleteProfessionalEntryAction}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="entryId" value={id} />
      {projectId ? <input type="hidden" name="returnProject" value={projectId} /> : null}
      <IconSubmitButton label={label}><Trash2 size={14} aria-hidden="true" /></IconSubmitButton>
    </form>
  )
}

export function ProfessionalOverview({ data, filter, today, timeZone, nowTime, notice }: { data: Data; filter: Filter; today: string; timeZone: string; nowTime: string; notice?: string }) {
  const message = resolveNotice(notice)
  const listed = filter === 'all' ? data.projects : data.projects.filter((project) => project.status === filter)
  const time = new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  const day = new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric' })
  const counts = Object.fromEntries(PROJECT_STATUSES.map((status) => [status, data.projects.filter((project) => project.status === status).length])) as Record<ProjectStatus, number>
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>DEVELOPMENT PILLAR · PROFESSIONAL</p>
          <h1>Move real work forward.</h1>
          <p className={styles.heroCopy}>Projects broken into milestones and tasks, the hours you put into building, what you actually shipped, and problem-solving practice.</p>
        </div>
        <div className={styles.inlineForm} style={{ marginTop: 0 }}><Link href="#add-project" className={styles.primaryLink}><Plus size={16} aria-hidden="true" /> New project</Link></div>
      </header>

      {message ? <p className={message.tone === 'error' ? styles.errorNotice : styles.notice} role={message.tone === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
      {data.hasLoadError ? <p className={styles.errorNotice} role="alert">Some professional records could not be loaded. Refresh to try again; nothing was changed.</p> : null}

      <section className={styles.panel} aria-labelledby="week-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>THIS WEEK SO FAR</p><h2 id="week-heading">Right now</h2></div></div>
        <div className={a.stateGrid}>
          <div className={a.tile}><span className={a.tileLabel}>Active projects</span><strong className={a.tileValue}>{counts.active}</strong><span className={a.tileLabel}>{plural(counts.paused, 'paused project')}</span></div>
          <div className={a.tile}><span className={a.tileLabel}>Building time</span><strong className={a.tileValue}>{formatMinutes(data.thisWeek.codingMinutes)}</strong><span className={a.tileLabel}>coding sessions</span></div>
          <div className={a.tile}><span className={a.tileLabel}>Shipped</span><strong className={a.tileValue}>{data.thisWeek.shipped}</strong><span className={a.tileLabel}>things this week</span></div>
          <div className={a.tile}><span className={a.tileLabel}>Problems solved</span><strong className={a.tileValue}>{data.thisWeek.solved}</strong><span className={a.tileLabel}>of {plural(data.thisWeek.practiced, 'attempt')}</span></div>
        </div>
        {data.codingSeries.some(Boolean) ? (
          <>
            <h3 className={a.zoneTitle}>OVER TIME · LAST 8 WEEKS</h3>
            <div className={a.tile}>
              <span className={a.tileLabel}>Building time per week</span>
              <WeeklyBars labels={data.weeks.map(weekLabel)} values={data.codingSeries} unit="minutes" metricLabel="Coding" />
              <div className="sr-only"><table><caption>Coding minutes per week</caption><tbody>{data.weeks.map((week, index) => <tr key={week}><th scope="row">Week of {weekLabel(week)}</th><td>{formatMinutes(data.codingSeries[index])}</td></tr>)}</tbody></table></div>
            </div>
          </>
        ) : null}
      </section>

      <section className={styles.panel} aria-labelledby="projects-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>{plural(data.projects.length, 'PROJECT').toUpperCase()}</p><h2 id="projects-heading">Projects</h2></div></div>
        <nav className={styles.filterTabs} aria-label="Filter projects by status">
          {(['all', ...PROJECT_STATUSES] as Filter[]).map((tab) => (
            <Link key={tab} href={tab === 'all' ? '/professional' : `/professional?status=${tab}`} className={styles.filterTab} aria-current={filter === tab ? 'page' : undefined}>
              {tab === 'all' ? `All (${data.projects.length})` : `${PROJECT_STATUS_LABELS[tab]} (${counts[tab]})`}
            </Link>
          ))}
        </nav>
        {listed.length ? (
          <ul className={styles.questList}>
            {listed.map((project) => (
              <li key={project.id} className={styles.questRow}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Link href={`/professional/${project.id}`}><h3 style={{ overflowWrap: 'anywhere' }}>{project.name}</h3></Link>
                  <div className={styles.questMeta}>
                    <span>{project.progress.total ? `${project.progress.done} of ${plural(project.progress.total, 'task')} done` : 'No tasks yet'}</span>
                    {project.progress.blocked ? <span>{project.progress.blocked} blocked</span> : null}
                    {project.due_on ? <span>Due {day.format(new Date(`${project.due_on}T12:00:00Z`))}</span> : null}
                  </div>
                  {project.progress.percent !== null ? <Progress value={project.progress.percent} aria-label={`${project.name} progress`} style={{ marginTop: 10, maxWidth: 360 }} /> : null}
                </div>
                <div className={styles.questAside}><span className={styles.statusBadge} data-status={project.status === 'completed' ? 'completed' : project.status === 'active' ? 'active' : 'paused'}>{PROJECT_STATUS_LABELS[project.status]}</span></div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty className={styles.emptyState}>
            <EmptyHeader>
              <EmptyMedia variant="icon"><FolderKanban aria-hidden="true" /></EmptyMedia>
              <EmptyTitle>{filter === 'all' ? 'No projects yet' : `No ${PROJECT_STATUS_LABELS[filter as ProjectStatus].toLowerCase()} projects`}</EmptyTitle>
              <EmptyDescription>Start with the one piece of work you most want to finish.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>

      <section className={styles.panel} id="coding" aria-labelledby="coding-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>BUILDING TIME</p><h2 id="coding-heading">Log a coding session</h2></div></div>
        <form action={logCodingAction} className={styles.editorForm}>
          <div className={styles.fieldGrid}>
            <Field><FieldLabel htmlFor="coding-minutes">Minutes</FieldLabel><Input id="coding-minutes" name="minutes" inputMode="numeric" required maxLength={4} /></Field>
            <Field><FieldLabel htmlFor="coding-project">Project</FieldLabel><ProjectSelect id="coding-project" projects={data.projects} /></Field>
            <Field><FieldLabel htmlFor="coding-date">Date</FieldLabel><Input id="coding-date" name="date" type="date" required max={today} defaultValue={today} /></Field>
            <Field><FieldLabel htmlFor="coding-time">Start time</FieldLabel><Input id="coding-time" name="time" type="time" defaultValue={nowTime} /></Field>
            <Field style={{ gridColumn: '1 / -1' }}><FieldLabel htmlFor="coding-notes">What you worked on</FieldLabel><Input id="coding-notes" name="notes" maxLength={PROFESSIONAL_LIMITS.notes} /></Field>
          </div>
          <div className={styles.editorFooter}><SubmitButton pendingLabel="Saving…"><Plus size={15} aria-hidden="true" /> Log session</SubmitButton></div>
        </form>
        {data.recentCoding.length ? (
          <ul className={styles.itemList}>
            {data.recentCoding.map((session) => (
              <li key={session.id} className={styles.checkItem}>
                <span className={styles.statusBadge}>{formatMinutes(session.duration_minutes)}</span>
                <span className={styles.itemTitle} style={{ overflowWrap: 'anywhere' }}>{session.notes || (session.project_id ? data.projectName.get(session.project_id) : null) || 'Coding session'}<span className={styles.itemMeta}>{[time.format(new Date(session.started_at)), session.project_id ? data.projectName.get(session.project_id) : null].filter(Boolean).join(' · ')}</span></span>
                <DeleteEntry kind="coding" id={session.id} label={`Delete the coding session from ${time.format(new Date(session.started_at))}`} />
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className={styles.panel} id="shipped" aria-labelledby="shipped-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>OUTPUT</p><h2 id="shipped-heading">Shipping log</h2></div></div>
        <p className={styles.mutedNote} style={{ marginTop: 0 }}>Write down anything you put out into the world: a release, a pull request merged, a post, a demo.</p>
        <form action={logShippedAction} className={styles.editorForm}>
          <div className={styles.fieldGrid}>
            <Field style={{ gridColumn: '1 / -1' }}><FieldLabel htmlFor="shipped-title">What shipped</FieldLabel><Input id="shipped-title" name="title" required maxLength={PROFESSIONAL_LIMITS.shipped} /></Field>
            <Field><FieldLabel htmlFor="shipped-project">Project</FieldLabel><ProjectSelect id="shipped-project" projects={data.projects} /></Field>
            <Field><FieldLabel htmlFor="shipped-date">Date</FieldLabel><Input id="shipped-date" name="date" type="date" required max={today} defaultValue={today} /></Field>
            <Field style={{ gridColumn: '1 / -1' }}><FieldLabel htmlFor="shipped-description">Details (optional)</FieldLabel><Textarea id="shipped-description" name="description" maxLength={PROFESSIONAL_LIMITS.notes} rows={2} /></Field>
          </div>
          <div className={styles.editorFooter}><SubmitButton pendingLabel="Saving…"><Rocket size={15} aria-hidden="true" /> Log it</SubmitButton></div>
        </form>
        {data.shipped.length ? (
          <ul className={styles.itemList}>
            {data.shipped.map((item) => (
              <li key={item.id} className={styles.checkItem}>
                <Rocket size={15} aria-hidden="true" />
                <span className={styles.itemTitle} style={{ overflowWrap: 'anywhere' }}>{item.title}<span className={styles.itemMeta}>{[day.format(new Date(item.shipped_at)), item.project_id ? data.projectName.get(item.project_id) : null, item.description].filter(Boolean).join(' · ')}</span></span>
                <DeleteEntry kind="shipped" id={item.id} label={`Delete “${item.title}” from the shipping log`} />
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className={styles.panel} id="dsa" aria-labelledby="dsa-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>PRACTICE · {data.dsaTotals.solved} SOLVED OF {data.dsaTotals.total}</p><h2 id="dsa-heading">Problem solving</h2></div></div>
        <form action={logDsaAction} className={styles.editorForm}>
          <div className={styles.fieldGrid}>
            <Field style={{ gridColumn: '1 / -1' }}><FieldLabel htmlFor="dsa-problem">Problem</FieldLabel><Input id="dsa-problem" name="problem" required maxLength={PROFESSIONAL_LIMITS.problem} placeholder="Two Sum" /></Field>
            <Field><FieldLabel htmlFor="dsa-outcome">Outcome</FieldLabel>
              <select id="dsa-outcome" name="outcome" className={styles.nativeSelect} defaultValue="solved">{DSA_OUTCOMES.map((outcome) => <option key={outcome} value={outcome}>{DSA_OUTCOME_LABELS[outcome]}</option>)}</select>
            </Field>
            <Field><FieldLabel htmlFor="dsa-difficulty">Difficulty</FieldLabel>
              <select id="dsa-difficulty" name="difficulty" className={styles.nativeSelect} defaultValue=""><option value="">Not set</option>{DSA_DIFFICULTIES.map((difficulty) => <option key={difficulty} value={difficulty}>{difficulty[0].toUpperCase() + difficulty.slice(1)}</option>)}</select>
            </Field>
            <Field><FieldLabel htmlFor="dsa-platform">Platform</FieldLabel><Input id="dsa-platform" name="platform" maxLength={PROFESSIONAL_LIMITS.platform} placeholder="LeetCode" /></Field>
            <Field><FieldLabel htmlFor="dsa-date">Date</FieldLabel><Input id="dsa-date" name="date" type="date" required max={today} defaultValue={today} /></Field>
            <Field style={{ gridColumn: '1 / -1' }}><FieldLabel htmlFor="dsa-url">Link (optional)</FieldLabel><Input id="dsa-url" name="url" type="url" maxLength={2048} placeholder="https://" /></Field>
            <Field style={{ gridColumn: '1 / -1' }}><FieldLabel htmlFor="dsa-notes">Approach or takeaway</FieldLabel><Input id="dsa-notes" name="notes" maxLength={PROFESSIONAL_LIMITS.notes} /></Field>
          </div>
          <div className={styles.editorFooter}><SubmitButton pendingLabel="Saving…"><Plus size={15} aria-hidden="true" /> Log problem</SubmitButton></div>
        </form>
        {data.dsa.length ? (
          <ul className={styles.itemList}>
            {data.dsa.map((item) => (
              <li key={item.id} className={styles.checkItem}>
                <span className={styles.statusBadge} data-status={item.outcome === 'solved' ? 'completed' : 'paused'}>{DSA_OUTCOME_LABELS[item.outcome as DsaOutcome] ?? item.outcome}</span>
                <span className={styles.itemTitle} style={{ overflowWrap: 'anywhere' }}>
                  {item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer nofollow">{item.problem}</a> : item.problem}
                  <span className={styles.itemMeta}>{[day.format(new Date(item.practiced_at)), item.platform, item.difficulty ? item.difficulty[0].toUpperCase() + item.difficulty.slice(1) : null, item.notes].filter(Boolean).join(' · ')}</span>
                </span>
                <DeleteEntry kind="dsa" id={item.id} label={`Delete “${item.problem}”`} />
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className={styles.panel} id="add-project" aria-labelledby="add-project-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>NEW</p><h2 id="add-project-heading">Start a project</h2></div></div>
        <form action={createProjectAction} className={styles.editorForm}>
          <div className={styles.fieldGrid}>
            <Field style={{ gridColumn: '1 / -1' }}><FieldLabel htmlFor="project-name">Project</FieldLabel><Input id="project-name" name="name" required maxLength={PROFESSIONAL_LIMITS.name} /></Field>
            <Field><FieldLabel htmlFor="project-start">Started</FieldLabel><Input id="project-start" name="startedOn" type="date" defaultValue={today} /></Field>
            <Field><FieldLabel htmlFor="project-due">Due (optional)</FieldLabel><Input id="project-due" name="dueOn" type="date" /></Field>
            <Field style={{ gridColumn: '1 / -1' }}><FieldLabel htmlFor="project-repo">Repository or link (optional)</FieldLabel><Input id="project-repo" name="repositoryUrl" type="url" maxLength={2048} placeholder="https://" /></Field>
            <Field style={{ gridColumn: '1 / -1' }}><FieldLabel htmlFor="project-description">What it is</FieldLabel><Textarea id="project-description" name="description" maxLength={PROFESSIONAL_LIMITS.description} rows={3} /></Field>
          </div>
          <div className={styles.editorFooter}><SubmitButton pendingLabel="Saving…"><Plus size={15} aria-hidden="true" /> Create project</SubmitButton></div>
        </form>
      </section>
    </div>
  )
}
