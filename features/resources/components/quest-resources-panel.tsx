import Link from 'next/link'
import { SubmitButton } from '@/features/quests/components/submit-button'
import styles from '@/features/quests/quests.module.css'
import { attachResourceToQuestAction, createResourceAction, detachResourceFromQuestAction } from '../resource-actions'
import { RESOURCE_STATUS_LABELS, RESOURCE_TYPE_LABELS } from '../resource-domain'
import type { QuestResourceData } from '../resource-service'
import { ResourceForm } from './resource-form'

export function QuestResourcesPanel({ questId, data }: { questId: string; data: QuestResourceData }) {
  const returnTo = `/quests/${questId}`
  const completed = data.attached.filter((r) => r.status === 'completed').length
  return (
    <section className={styles.panel} aria-labelledby="quest-resources-title">
      <div className={styles.sectionHeader}>
        <div><p className={styles.kicker}>FROM YOUR LIBRARY</p><h2 id="quest-resources-title">Resources</h2></div>
        <Link href={`/library?quest=${questId}&status=all`} className={styles.subtleLink}>In library</Link>
      </div>
      {data.attached.length > 0 ? (
        <>
          <p className={styles.mutedNote}>{completed} of {data.attached.length} completed.</p>
          <ul className={styles.itemList}>
            {data.attached.map((resource) => (
              <li key={resource.id} className={styles.linkRow}>
                <span>
                  <Link href={`/library/${resource.id}`}>{resource.title}</Link>
                  <span className={styles.itemMeta}>{RESOURCE_TYPE_LABELS[resource.resource_type]} · {RESOURCE_STATUS_LABELS[resource.status]}</span>
                </span>
                <form action={detachResourceFromQuestAction}>
                  <input type="hidden" name="resourceId" value={resource.id} />
                  <input type="hidden" name="questId" value={questId} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <SubmitButton variant="ghost" size="sm" pendingLabel="Detaching…" ariaLabel={`Detach “${resource.title}”`}>Detach</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </>
      ) : <p className={styles.mutedNote}>No resources attached. Attaching a resource does not count as learning time.</p>}

      {data.options.length > 0 ? (
        <form action={attachResourceToQuestAction} className={styles.inlineForm}>
          <input type="hidden" name="questId" value={questId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <label className="sr-only" htmlFor="attach-resource">Resource</label>
          <select id="attach-resource" name="resourceId" className={styles.nativeSelect} required defaultValue="">
            <option value="" disabled>Attach a saved resource…</option>
            {data.options.map((resource) => <option key={resource.id} value={resource.id}>{resource.title}</option>)}
          </select>
          <SubmitButton variant="outline" pendingLabel="Attaching…">Attach</SubmitButton>
        </form>
      ) : null}

      <details className={styles.createDetails}>
        <summary>Add a new link to this quest</summary>
        <ResourceForm action={createResourceAction} returnTo={returnTo} questId={questId} submitLabel="Save and attach" compact />
      </details>
    </section>
  )
}
