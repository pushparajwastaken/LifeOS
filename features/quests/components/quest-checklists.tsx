import { Check, Circle, Trash2 } from 'lucide-react'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  addMilestoneAction,
  addObjectiveAction,
  deleteMilestoneAction,
  deleteObjectiveAction,
  toggleMilestoneAction,
  toggleObjectiveAction,
  updateMilestoneAction,
  updateObjectiveAction,
} from '../quest-actions'
import { QUEST_LIMITS } from '../quest-domain'
import { formatDateKey, formatTimestamp } from '../quest-notices'
import type { QuestMilestone, QuestObjective } from '../quest-service'
import styles from '../quests.module.css'
import { SubmitButton } from './submit-button'

export function ObjectivesPanel({ questId, objectives, timeZone }: { questId: string; objectives: QuestObjective[]; timeZone: string }) {
  return (
    <section className={styles.panel} aria-labelledby="objectives-title">
      <div className={styles.sectionHeader}>
        <div><p className={styles.kicker}>WHAT “CAPABLE” MEANS</p><h2 id="objectives-title">Objectives</h2></div>
      </div>
      {objectives.length > 0 ? (
        <ul className={styles.itemList}>
          {objectives.map((objective) => {
            const done = objective.achieved_at !== null
            return (
              <li key={objective.id} className={styles.checkItem} data-done={done}>
                <form action={toggleObjectiveAction}>
                  <input type="hidden" name="questId" value={questId} />
                  <input type="hidden" name="objectiveId" value={objective.id} />
                  <input type="hidden" name="achieved" value={done ? 'false' : 'true'} />
                  <button type="submit" className={styles.iconButton} data-done={done} aria-label={done ? `Mark “${objective.title}” as not achieved` : `Mark “${objective.title}” as achieved`}>
                    {done ? <Check size={16} aria-hidden="true" /> : <Circle size={16} aria-hidden="true" />}
                  </button>
                </form>
                <details>
                  <summary className={styles.itemTitle}>
                    {objective.title}
                    {done ? <span className={styles.itemMeta}>Achieved {formatTimestamp(objective.achieved_at, timeZone)}</span> : null}
                  </summary>
                  <form action={updateObjectiveAction} className={styles.inlineForm}>
                    <input type="hidden" name="questId" value={questId} />
                    <input type="hidden" name="objectiveId" value={objective.id} />
                    <label className="sr-only" htmlFor={`objective-${objective.id}`}>Objective title</label>
                    <Input id={`objective-${objective.id}`} name="title" required maxLength={QUEST_LIMITS.objectiveTitle} defaultValue={objective.title} />
                    <SubmitButton variant="outline" pendingLabel="Saving…">Save</SubmitButton>
                  </form>
                </details>
                <form action={deleteObjectiveAction}>
                  <input type="hidden" name="questId" value={questId} />
                  <input type="hidden" name="objectiveId" value={objective.id} />
                  <button type="submit" className={styles.iconButton} aria-label={`Remove objective “${objective.title}”`}><Trash2 size={15} aria-hidden="true" /></button>
                </form>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className={styles.mutedNote}>No objectives yet. Objectives describe what you want to be able to do; they are optional for exploratory quests.</p>
      )}
      <form action={addObjectiveAction} className={styles.inlineForm}>
        <input type="hidden" name="questId" value={questId} />
        <label className="sr-only" htmlFor="new-objective">New objective</label>
        <Input id="new-objective" name="title" required maxLength={QUEST_LIMITS.objectiveTitle} placeholder="e.g. Explain how a cache miss is handled" />
        <SubmitButton variant="outline" pendingLabel="Adding…">Add objective</SubmitButton>
      </form>
    </section>
  )
}

export function MilestonesPanel({ questId, milestones, timeZone, structured }: { questId: string; milestones: QuestMilestone[]; timeZone: string; structured: boolean }) {
  return (
    <section className={styles.panel} aria-labelledby="milestones-title">
      <div className={styles.sectionHeader}>
        <div><p className={styles.kicker}>{structured ? 'YOUR LEARNING PATH' : 'OPTIONAL WAYPOINTS'}</p><h2 id="milestones-title">Milestones</h2></div>
      </div>
      {milestones.length > 0 ? (
        <ol className={styles.itemList}>
          {milestones.map((milestone) => {
            const done = milestone.completed_at !== null
            return (
              <li key={milestone.id} className={styles.checkItem} data-done={done}>
                <form action={toggleMilestoneAction}>
                  <input type="hidden" name="questId" value={questId} />
                  <input type="hidden" name="milestoneId" value={milestone.id} />
                  <input type="hidden" name="completed" value={done ? 'false' : 'true'} />
                  <button type="submit" className={styles.iconButton} data-done={done} aria-label={done ? `Mark “${milestone.title}” as not complete` : `Mark “${milestone.title}” as complete`}>
                    {done ? <Check size={16} aria-hidden="true" /> : <Circle size={16} aria-hidden="true" />}
                  </button>
                </form>
                <details>
                  <summary className={styles.itemTitle}>
                    {milestone.title}
                    <span className={styles.itemMeta}>
                      {[milestone.due_on ? `Due ${formatDateKey(milestone.due_on)}` : null, done ? `Completed ${formatTimestamp(milestone.completed_at, timeZone)}` : null].filter(Boolean).join(' · ') || 'No due date'}
                    </span>
                  </summary>
                  {milestone.description ? <p className={styles.description}>{milestone.description}</p> : null}
                  <MilestoneForm questId={questId} milestone={milestone} />
                </details>
                <form action={deleteMilestoneAction}>
                  <input type="hidden" name="questId" value={questId} />
                  <input type="hidden" name="milestoneId" value={milestone.id} />
                  <button type="submit" className={styles.iconButton} aria-label={`Remove milestone “${milestone.title}”`}><Trash2 size={15} aria-hidden="true" /></button>
                </form>
              </li>
            )
          })}
        </ol>
      ) : (
        <p className={styles.mutedNote}>
          {structured ? 'Add milestones to map the path; progress is the share of milestones completed.' : 'Exploratory quests do not need milestones. Add one only if a waypoint helps.'}
        </p>
      )}
      <details className={styles.createDetails}>
        <summary>Add a milestone</summary>
        <MilestoneForm questId={questId} />
      </details>
    </section>
  )
}

function MilestoneForm({ questId, milestone }: { questId: string; milestone?: QuestMilestone }) {
  const prefix = milestone ? `milestone-${milestone.id}` : 'new-milestone'
  return (
    <form action={milestone ? updateMilestoneAction : addMilestoneAction} className={styles.editorForm}>
      <input type="hidden" name="questId" value={questId} />
      {milestone ? <input type="hidden" name="milestoneId" value={milestone.id} /> : null}
      <div className={styles.fieldGrid}>
        <Field className={styles.fieldWide}>
          <FieldLabel htmlFor={`${prefix}-title`}>Milestone</FieldLabel>
          <Input id={`${prefix}-title`} name="title" required maxLength={QUEST_LIMITS.milestoneTitle} defaultValue={milestone?.title ?? ''} placeholder="e.g. Build a 5-stage pipelined CPU in a simulator" />
        </Field>
        <Field className={styles.fieldWide}>
          <FieldLabel htmlFor={`${prefix}-description`}>Details</FieldLabel>
          <Textarea id={`${prefix}-description`} name="description" maxLength={QUEST_LIMITS.milestoneDescription} defaultValue={milestone?.description ?? ''} />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${prefix}-due`}>Due date</FieldLabel>
          <Input id={`${prefix}-due`} name="dueOn" type="date" defaultValue={milestone?.due_on ?? ''} />
        </Field>
      </div>
      <div className={styles.editorFooter}>
        <SubmitButton variant={milestone ? 'outline' : 'default'} pendingLabel="Saving…">{milestone ? 'Save milestone' : 'Add milestone'}</SubmitButton>
      </div>
    </form>
  )
}
