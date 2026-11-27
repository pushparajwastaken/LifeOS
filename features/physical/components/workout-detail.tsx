import Link from 'next/link'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { IconSubmitButton } from '@/features/quests/components/icon-submit-button'
import { SubmitButton } from '@/features/quests/components/submit-button'
import { resolveNotice } from '@/features/quests/quest-notices'
import styles from '@/features/quests/quests.module.css'
import { addExerciseAction, addSetAction, deleteExerciseAction, deletePhysicalEntryAction, deleteSetAction } from '../physical-actions'
import { PHYSICAL_LIMITS, formatNumber } from '../physical-domain'
import type { getWorkoutDetail } from '../physical-service'

type Detail = NonNullable<Awaited<ReturnType<typeof getWorkoutDetail>>>

export function WorkoutDetail({ data, timeZone, notice }: { data: Detail; timeZone: string; notice?: string }) {
  const { workout, exercises } = data
  const message = resolveNotice(notice)
  const when = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(workout.performed_at))
  const totalSets = exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0)
  return (
    <div className={styles.page}>
      <Link href="/physical" className={styles.subtleLink}><ArrowLeft size={14} aria-hidden="true" /> Physical</Link>
      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>WORKOUT · {exercises.length} {exercises.length === 1 ? 'EXERCISE' : 'EXERCISES'} · {totalSets} {totalSets === 1 ? 'SET' : 'SETS'}</p>
          <h1>{workout.title}</h1>
          <p className={styles.heroCopy}>{when}{workout.notes ? ` · ${workout.notes}` : ''}</p>
        </div>
      </header>

      {message ? <p className={message.tone === 'error' ? styles.errorNotice : styles.notice} role={message.tone === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
      {data.hasLoadError ? <p className={styles.errorNotice} role="alert">Some exercises could not be loaded. Refresh to try again.</p> : null}

      {exercises.map((exercise) => (
        <section key={exercise.id} className={styles.panel} aria-labelledby={`exercise-${exercise.id}`}>
          <div className={styles.sectionHeader}>
            <div><p className={styles.kicker}>EXERCISE {exercise.order_index + 1}</p><h2 id={`exercise-${exercise.id}`}>{exercise.name}</h2></div>
            <form action={deleteExerciseAction}>
              <input type="hidden" name="workoutId" value={workout.id} />
              <input type="hidden" name="exerciseId" value={exercise.id} />
              <IconSubmitButton label={`Delete exercise “${exercise.name}” and its sets`}><Trash2 size={14} aria-hidden="true" /></IconSubmitButton>
            </form>
          </div>
          {exercise.sets.length ? (
            <ul className={styles.itemList}>
              {exercise.sets.map((set) => (
                <li key={set.id} className={styles.checkItem}>
                  <span className={styles.statusBadge}>Set {set.set_number}</span>
                  <span className={styles.itemTitle}>{[set.reps !== null ? `${set.reps} reps` : null, set.weight !== null ? `${formatNumber(set.weight, 2)} ${set.unit}` : null].filter(Boolean).join(' × ')}</span>
                  <form action={deleteSetAction}>
                    <input type="hidden" name="workoutId" value={workout.id} />
                    <input type="hidden" name="setId" value={set.id} />
                    <IconSubmitButton label={`Delete set ${set.set_number} of ${exercise.name}`}><Trash2 size={14} aria-hidden="true" /></IconSubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          ) : <p className={styles.mutedNote}>No sets yet.</p>}
          <form action={addSetAction} className={styles.searchForm} style={{ marginTop: 10 }}>
            <input type="hidden" name="workoutId" value={workout.id} />
            <input type="hidden" name="exerciseId" value={exercise.id} />
            <Input name="reps" inputMode="numeric" maxLength={5} placeholder="Reps" aria-label={`Reps for the next set of ${exercise.name}`} style={{ width: 90 }} />
            <Input name="weight" inputMode="decimal" maxLength={8} placeholder="Weight" aria-label={`Weight for the next set of ${exercise.name}`} style={{ width: 100 }} defaultValue={exercise.sets.at(-1)?.weight ?? ''} />
            <select name="unit" aria-label="Weight unit" className={styles.nativeSelect} style={{ width: 'auto' }} defaultValue={exercise.sets.at(-1)?.unit ?? 'kg'}><option value="kg">kg</option><option value="lb">lb</option></select>
            <SubmitButton variant="outline" size="sm" pendingLabel="Adding…"><Plus size={14} aria-hidden="true" /> Add set</SubmitButton>
          </form>
        </section>
      ))}

      <section className={styles.panel} aria-labelledby="add-exercise-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>BUILD THE WORKOUT</p><h2 id="add-exercise-heading">Add an exercise</h2></div></div>
        <form action={addExerciseAction} className={styles.searchForm}>
          <input type="hidden" name="workoutId" value={workout.id} />
          <label className="sr-only" htmlFor="exercise-name">Exercise name</label>
          <Input id="exercise-name" name="name" required maxLength={PHYSICAL_LIMITS.exerciseName} placeholder="Bench press, squats, plank…" />
          <SubmitButton variant="outline" size="sm" pendingLabel="Adding…"><Plus size={14} aria-hidden="true" /> Add exercise</SubmitButton>
        </form>
      </section>

      <section className={styles.panel} aria-labelledby="delete-workout-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>DANGER ZONE</p><h2 id="delete-workout-heading">Delete workout</h2></div></div>
        <form action={deletePhysicalEntryAction} className={styles.inlineForm}>
          <input type="hidden" name="kind" value="workout" />
          <input type="hidden" name="entryId" value={workout.id} />
          <p className={styles.mutedNote} style={{ margin: 0 }}>Removes the workout with all its exercises and sets.</p>
          <SubmitButton variant="outline" size="sm" pendingLabel="Deleting…"><Trash2 size={13} aria-hidden="true" /> Delete workout</SubmitButton>
        </form>
      </section>
    </div>
  )
}
