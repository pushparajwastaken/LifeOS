import Link from 'next/link'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { SessionForm } from '@/features/learning/components/session-form'
import { logSessionAction } from '@/features/learning/learning-actions'
import { SESSION_TYPE_LABELS, formatDuration, type SessionType } from '@/features/learning/learning-domain'
import { SubmitButton } from '@/features/quests/components/submit-button'
import { resolveNotice } from '@/features/quests/quest-notices'
import styles from '@/features/quests/quests.module.css'
import {
  attachResourceToQuestAction,
  deleteResourceAction,
  detachResourceFromQuestAction,
  setResourceStatusAction,
  updateResourceAction,
} from '../resource-actions'
import { RESOURCE_STATUSES, RESOURCE_STATUS_LABELS, RESOURCE_TYPE_LABELS } from '../resource-domain'
import type { ResourceDetailData } from '../resource-service'
import { ResourceForm } from './resource-form'

const ORIGIN_LABELS: Record<string, string> = {
  manual: 'Added by you',
  chrome_html: 'Chrome bookmarks import',
  chrome_extension: 'Chrome extension',
  youtube: 'YouTube',
  x: 'X',
}

export function ResourceDetail({ data, timeZone, today, notice }: { data: ResourceDetailData; timeZone: string; today: string; notice?: string }) {
  const { resource } = data
  const message = resolveNotice(notice)
  const returnTo = `/library/${resource.id}`
  const dateFormat = new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric', year: 'numeric' })
  return (
    <div className={styles.page}>
      <Link href="/library" className={styles.subtleLink}><ArrowLeft size={14} aria-hidden="true" /> Library</Link>
      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>{RESOURCE_TYPE_LABELS[resource.resource_type].toUpperCase()}{resource.category ? ` · ${resource.category.toUpperCase()}` : ''}</p>
          <h1>{resource.title}</h1>
          <a href={resource.url} target="_blank" rel="noopener noreferrer nofollow" className={styles.subtleLink}>{resource.url.length > 80 ? `${resource.url.slice(0, 80)}…` : resource.url} <ExternalLink size={13} aria-hidden="true" /></a>
        </div>
        <span className={styles.statusBadge} data-status={resource.status === 'completed' ? 'completed' : resource.status === 'in_progress' ? 'active' : resource.status}>{RESOURCE_STATUS_LABELS[resource.status]}</span>
      </header>

      {message ? <p className={message.tone === 'error' ? styles.errorNotice : styles.notice} role={message.tone === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
      {data.hasLoadError ? <p className={styles.errorNotice} role="alert">Some details could not be loaded. Refresh to try again.</p> : null}

      <div className={styles.detailGrid}>
        <div className={styles.stack}>
          <section className={styles.panel} aria-labelledby="resource-status-title">
            <div className={styles.sectionHeader}><div><p className={styles.kicker}>STATUS</p><h2 id="resource-status-title">{RESOURCE_STATUS_LABELS[resource.status]}</h2></div></div>
            <div className={styles.statusActions}>
              {RESOURCE_STATUSES.filter((status) => status !== resource.status).map((status) => (
                <form key={status} action={setResourceStatusAction}>
                  <input type="hidden" name="resourceId" value={resource.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <input type="hidden" name="status" value={status} />
                  <SubmitButton variant={status === 'completed' ? 'default' : 'outline'} pendingLabel="Saving…">{status === 'completed' ? 'Mark completed' : `Mark ${RESOURCE_STATUS_LABELS[status].toLowerCase()}`}</SubmitButton>
                </form>
              ))}
            </div>
            <dl className={styles.factList}>
              <dt>Saved</dt><dd>{dateFormat.format(new Date(resource.created_at))}</dd>
              {resource.completed_at ? <><dt>Completed</dt><dd>{dateFormat.format(new Date(resource.completed_at))}</dd></> : null}
              <dt>Origin</dt><dd>{ORIGIN_LABELS[resource.origin] ?? resource.origin}</dd>
              <dt>Learning time</dt><dd>{data.minutesAllTime ? `${formatDuration(data.minutesAllTime)} across ${data.sessions.length} session${data.sessions.length === 1 ? '' : 's'}` : 'No sessions logged yet'}</dd>
            </dl>
            {resource.notes ? <p className={styles.description}>{resource.notes}</p> : null}
          </section>

          <section className={styles.panel} aria-labelledby="resource-sessions-title">
            <div className={styles.sectionHeader}><div><p className={styles.kicker}>LEARNING EFFORT</p><h2 id="resource-sessions-title">Sessions with this resource</h2></div></div>
            {data.sessions.length > 0 ? (
              <ul className={styles.itemList}>
                {data.sessions.slice(0, 10).map((session) => (
                  <li key={session.id} className={styles.linkRow}>
                    <span>{session.topic ?? data.quests.find((quest) => quest.id === session.quest_id)?.title ?? 'Learning session'}<span className={styles.itemMeta}>{SESSION_TYPE_LABELS[session.session_type as SessionType] ?? session.session_type} · {dateFormat.format(new Date(session.started_at))}</span></span>
                    <span className={styles.statusBadge}>{formatDuration(session.duration_minutes)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className={styles.mutedNote}>Saving a resource is not learning time. Log a session when you study it.</p>}
            <details className={styles.createDetails}>
              <summary>Log a session with this resource</summary>
              <SessionForm action={logSessionAction} timeZone={timeZone} today={today} returnTo={returnTo} quests={data.quests.map((q) => ({ ...q, status: 'active' }))} fixedResourceId={resource.id} submitLabel="Log session" />
            </details>
          </section>

          <section className={styles.panel} aria-labelledby="edit-resource-title">
            <details className={styles.createDetails}>
              <summary id="edit-resource-title">Edit details</summary>
              <ResourceForm action={updateResourceAction} returnTo={returnTo} resource={resource} submitLabel="Save changes" />
            </details>
          </section>
        </div>

        <div className={styles.stack}>
          <section className={styles.panel} aria-labelledby="resource-quests-title">
            <div className={styles.sectionHeader}><div><p className={styles.kicker}>SIDE QUESTS</p><h2 id="resource-quests-title">Attached to</h2></div></div>
            {data.quests.length > 0 ? (
              <ul className={styles.itemList}>
                {data.quests.map((quest) => (
                  <li key={quest.id} className={styles.linkRow}>
                    <Link href={`/quests/${quest.id}`}>{quest.title}</Link>
                    <form action={detachResourceFromQuestAction}>
                      <input type="hidden" name="resourceId" value={resource.id} />
                      <input type="hidden" name="questId" value={quest.id} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <SubmitButton variant="ghost" size="sm" pendingLabel="Detaching…" ariaLabel={`Detach from “${quest.title}”`}>Detach</SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            ) : <p className={styles.mutedNote}>Not attached to any quest.</p>}
            {data.questOptions.length > 0 ? (
              <form action={attachResourceToQuestAction} className={styles.inlineForm}>
                <input type="hidden" name="resourceId" value={resource.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <label className="sr-only" htmlFor="attach-quest">Quest</label>
                <select id="attach-quest" name="questId" className={styles.nativeSelect} required defaultValue="">
                  <option value="" disabled>Choose a quest…</option>
                  {data.questOptions.map((quest) => <option key={quest.id} value={quest.id}>{quest.title}</option>)}
                </select>
                <SubmitButton variant="outline" pendingLabel="Attaching…">Attach</SubmitButton>
              </form>
            ) : null}
          </section>

          {data.sources.length > 0 ? (
            <section className={styles.panel} aria-labelledby="resource-sources-title">
              <div className={styles.sectionHeader}><div><p className={styles.kicker}>PROVENANCE</p><h2 id="resource-sources-title">Imported from</h2></div></div>
              <ul className={styles.itemList}>
                {data.sources.map((source) => (
                  <li key={`${source.provider}-${source.first_seen_at}`} className={styles.linkRow}>
                    <span>{ORIGIN_LABELS[source.provider] ?? source.provider}<span className={styles.itemMeta}>First seen {dateFormat.format(new Date(source.first_seen_at))}{source.sync_state !== 'active' ? ` · ${source.sync_state.replaceAll('_', ' ')}` : ''}</span></span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className={`${styles.panel} ${styles.dangerZone}`} aria-label="Delete resource">
            <details>
              <summary>Delete this resource</summary>
              <p className={styles.mutedNote}>Deleting removes it from your library and from {data.quests.length === 1 ? '1 quest' : `${data.quests.length} quests`}. Learning sessions that used it are kept; they just lose the link.</p>
              <form action={deleteResourceAction} className={styles.confirmRow}>
                <input type="hidden" name="resourceId" value={resource.id} />
                <label><input type="checkbox" name="confirm" value="delete" required /> I understand this cannot be undone</label>
                <SubmitButton variant="destructive" pendingLabel="Deleting…">Delete resource</SubmitButton>
              </form>
            </details>
          </section>
        </div>
      </div>
    </div>
  )
}
