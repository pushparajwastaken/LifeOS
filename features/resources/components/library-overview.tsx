import Link from 'next/link'
import { BookMarked, ExternalLink, Plus, Search } from 'lucide-react'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { resolveNotice } from '@/features/quests/quest-notices'
import styles from '@/features/quests/quests.module.css'
import { createResourceAction } from '../resource-actions'
import { RESOURCE_STATUSES, RESOURCE_STATUS_LABELS, RESOURCE_TYPES, RESOURCE_TYPE_LABELS, type ResourceFilters } from '../resource-domain'
import type { LibraryData } from '../resource-service'
import { ResourceForm } from './resource-form'

function href(filters: ResourceFilters, patch: Partial<ResourceFilters>): string {
  const next = { ...filters, ...patch }
  const params = new URLSearchParams()
  if (next.status !== 'active') params.set('status', next.status)
  if (next.type !== 'all') params.set('type', next.type)
  if (next.questId) params.set('quest', next.questId)
  if (next.query) params.set('q', next.query)
  const search = params.toString()
  return search ? `/library?${search}` : '/library'
}

const STATUS_TABS: Array<{ value: ResourceFilters['status']; label: string }> = [
  { value: 'active', label: 'To learn' },
  ...RESOURCE_STATUSES.map((status) => ({ value: status, label: RESOURCE_STATUS_LABELS[status] })),
  { value: 'all', label: 'All' },
]

export function LibraryOverview({ data, filters, notice }: { data: LibraryData; filters: ResourceFilters; notice?: string }) {
  const message = resolveNotice(notice)
  const activeCount = data.counts.saved + data.counts.in_progress
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>RESOURCE LIBRARY · {activeCount} TO LEARN · {data.counts.completed} COMPLETED</p>
          <h1>Everything worth learning from, in one place.</h1>
          <p className={styles.heroCopy}>Save articles, videos, papers and courses, and attach them to the side quests they support. Saving is collecting; log a learning session when you actually study one.</p>
        </div>
        <div className={styles.inlineForm} style={{ marginTop: 0 }}>
          <Link href="/library/import" className={styles.subtleLink}>Import bookmarks</Link>
          <Link href="#add-resource" className={styles.primaryLink}><Plus size={16} aria-hidden="true" /> Add resource</Link>
        </div>
      </header>

      {message ? <p className={message.tone === 'error' ? styles.errorNotice : styles.notice} role={message.tone === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
      {data.hasLoadError ? <p className={styles.errorNotice} role="alert">Some resources could not be loaded. Refresh to try again; nothing was changed.</p> : null}
      {data.truncated ? <p className={styles.notice} role="status">Showing the 300 most recent matches. Search or filter to narrow the list.</p> : null}

      <section className={styles.panel} aria-labelledby="library-title">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>{data.resources.length === 1 ? '1 RESOURCE' : `${data.resources.length} RESOURCES`}</p><h2 id="library-title">Your library</h2></div></div>
        <form method="get" action="/library" className={styles.searchForm} role="search">
          {filters.status !== 'active' ? <input type="hidden" name="status" value={filters.status} /> : null}
          <label className="sr-only" htmlFor="library-search">Search resources</label>
          <Input id="library-search" name="q" defaultValue={filters.query ?? ''} placeholder="Search titles, categories and notes" />
          <label className="sr-only" htmlFor="library-type">Type</label>
          <select id="library-type" name="type" className={styles.nativeSelect} style={{ width: 'auto' }} defaultValue={filters.type}>
            <option value="all">All types</option>
            {RESOURCE_TYPES.map((type) => <option key={type} value={type}>{RESOURCE_TYPE_LABELS[type]}</option>)}
          </select>
          <label className="sr-only" htmlFor="library-quest">Quest</label>
          <select id="library-quest" name="quest" className={styles.nativeSelect} style={{ width: 'auto' }} defaultValue={filters.questId ?? ''}>
            <option value="">Any quest</option>
            {data.quests.map((quest) => <option key={quest.id} value={quest.id}>{quest.title}</option>)}
          </select>
          <button type="submit" className={styles.subtleLink}><Search size={14} aria-hidden="true" /> Apply</button>
        </form>
        <nav className={styles.filterTabs} aria-label="Filter by status" style={{ marginTop: 12 }}>
          {STATUS_TABS.map(({ value, label }) => (
            <Link key={value} href={href(filters, { status: value })} className={styles.filterTab} aria-current={filters.status === value ? 'page' : undefined}>{label}</Link>
          ))}
        </nav>

        {data.resources.length > 0 ? (
          <ul className={styles.questList}>
            {data.resources.map((resource) => (
              <li key={resource.id} className={styles.questRow}>
                <div>
                  <Link href={`/library/${resource.id}`}><h3>{resource.title}</h3></Link>
                  <div className={styles.questMeta}>
                    <span>{RESOURCE_TYPE_LABELS[resource.resource_type]}</span>
                    {resource.category ? <span>{resource.category}</span> : null}
                    <span>{new URL(resource.url).hostname.replace(/^www\./, '')}</span>
                    {resource.quests.length > 0 ? <span>{resource.quests.map((quest) => quest.title).join(', ')}</span> : null}
                  </div>
                </div>
                <div className={styles.questAside}>
                  <span className={styles.statusBadge} data-status={resource.status === 'completed' ? 'completed' : resource.status === 'in_progress' ? 'active' : resource.status}>{RESOURCE_STATUS_LABELS[resource.status]}</span>
                  <a href={resource.url} target="_blank" rel="noopener noreferrer nofollow" className={styles.subtleLink} aria-label={`Open ${resource.title} in a new tab`}>Open <ExternalLink size={13} aria-hidden="true" /></a>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty className={styles.emptyState}>
            <EmptyHeader>
              <EmptyMedia variant="icon"><BookMarked aria-hidden="true" /></EmptyMedia>
              <EmptyTitle>{filters.query || filters.type !== 'all' || filters.questId ? 'No resources match these filters' : 'Nothing saved here yet'}</EmptyTitle>
              <EmptyDescription>{filters.query || filters.type !== 'all' || filters.questId ? 'Try clearing a filter or searching for something else.' : 'Add a link you want to learn from.'}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>

      <section className={styles.panel} id="add-resource" aria-labelledby="add-resource-title">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>NEW RESOURCE</p><h2 id="add-resource-title">Add a resource</h2></div></div>
        <ResourceForm action={createResourceAction} returnTo="/library" submitLabel="Save resource" />
      </section>
    </div>
  )
}
