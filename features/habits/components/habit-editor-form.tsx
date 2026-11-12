import { Badge } from '@/components/ui/badge'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createHabitAction, updateHabitAction } from '../habit-actions'
import {
  HABIT_PILLARS,
  PILLAR_LABELS,
  WEEKDAYS,
  type Habit,
} from '../habit-domain'
import { HabitSubmitButton } from './habit-submit-button'
import styles from '../habit-management.module.css'

type RelatedHabit = { id: string; name: string; active: boolean }

export function HabitEditorForm({
  today,
  timeZone,
  habit,
  relatedHabits,
}: {
  today: string
  timeZone: string
  habit?: Habit
  relatedHabits: RelatedHabit[]
}) {
  const isEditing = Boolean(habit)
  const behavior = habit?.schedule.behavior
  const defaultDays = habit?.schedule.daysOfWeek ?? [0, 1, 2, 3, 4, 5, 6]
  const hasBehavior = Boolean(
    behavior && (
      behavior.identity || behavior.cue || behavior.craving || behavior.routine || behavior.reward ||
      behavior.stackAfterHabitId || behavior.twoMinuteVersion || behavior.smallestCompletion ||
      behavior.environmentPrep || behavior.friction || behavior.environmentChange || behavior.obvious ||
      behavior.attractive || behavior.easy || behavior.satisfying || behavior.isKeystone ||
      behavior.relatedHabitIds.length
    ),
  )

  return (
    <form action={habit ? updateHabitAction : createHabitAction} className={styles.editorForm}>
      {habit ? <input type="hidden" name="habitId" value={habit.id} /> : null}
      <section className={styles.editorSection} aria-labelledby="habit-basics-title">
        <div className={styles.sectionHeading}>
          <p className={styles.kicker}>START WITH THE PRACTICE</p>
          <h2 id="habit-basics-title">A habit that fits your life</h2>
          <p>Keep the first version small. You can refine the system as you learn what works.</p>
        </div>
        <FieldGroup className={styles.fieldGrid}>
          <Field className={styles.fieldWide}>
            <FieldLabel htmlFor="habit-name">Habit name</FieldLabel>
            <Input id="habit-name" name="name" maxLength={120} required defaultValue={habit?.name ?? ''} placeholder="e.g. Take a short walk" />
            <FieldDescription>Use a clear action you can picture doing.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="habit-pillar">Pillar</FieldLabel>
            <Select name="pillar" defaultValue={habit?.pillar ?? 'physical'}>
              <SelectTrigger id="habit-pillar" className={styles.selectTrigger}>
                <SelectValue placeholder="Choose a pillar" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {HABIT_PILLARS.map((pillar) => (
                    <SelectItem key={pillar} value={pillar}>{PILLAR_LABELS[pillar]}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="habit-tracking-type">How will you track it?</FieldLabel>
            <Select name="trackingType" defaultValue={habit?.tracking_type ?? 'boolean'}>
              <SelectTrigger id="habit-tracking-type" className={styles.selectTrigger}>
                <SelectValue placeholder="Choose a tracking method" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="boolean">A simple check-in</SelectItem>
                  <SelectItem value="numeric">A measured amount</SelectItem>
                  <SelectItem value="duration">Time spent</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="habit-target">Full target</FieldLabel>
            <Input
              id="habit-target"
              name="targetValue"
              type="number"
              min="0.001"
              max="1000000"
              step="any"
              defaultValue={habit?.target_value ?? ''}
              placeholder="e.g. 20"
            />
            <FieldDescription>Required when tracking an amount or duration.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="habit-unit">Measurement unit</FieldLabel>
            <Input id="habit-unit" name="unit" maxLength={32} defaultValue={habit?.unit ?? ''} placeholder="pages, minutes, glasses" />
          </Field>
          <Field className={styles.fieldWide}>
            <FieldLabel htmlFor="habit-description">Description</FieldLabel>
            <Textarea id="habit-description" name="description" maxLength={2000} defaultValue={habit?.description ?? ''} placeholder="Why this practice matters, or what a good session looks like." />
          </Field>
        </FieldGroup>
      </section>

      <section className={styles.editorSection} aria-labelledby="habit-schedule-title">
        <div className={styles.sectionHeading}>
          <p className={styles.kicker}>MAKE THE CUE PREDICTABLE</p>
          <h2 id="habit-schedule-title">When it belongs in your week</h2>
        </div>
        <FieldSet className={styles.weekdaySet}>
          <FieldLegend variant="label">Choose your scheduled days</FieldLegend>
          <FieldDescription>Only scheduled days count toward consistency. An unscheduled day is simply a day off.</FieldDescription>
          <FieldGroup className={styles.weekdayGroup}>
            {WEEKDAYS.map((day) => {
              const id = `habit-day-${day.value}`
              return (
                <Field key={day.value} orientation="horizontal" className={styles.weekdayField}>
                  <Checkbox id={id} name="daysOfWeek" value={String(day.value)} defaultChecked={defaultDays.includes(day.value)} aria-label={day.long} />
                  <FieldContent><FieldLabel htmlFor={id}>{day.short}</FieldLabel></FieldContent>
                </Field>
              )
            })}
          </FieldGroup>
        </FieldSet>
        <FieldGroup className={styles.fieldGrid}>
          <Field>
            <FieldLabel htmlFor="habit-start-date">Start date</FieldLabel>
            <Input id="habit-start-date" name="startDate" type="date" required defaultValue={habit?.schedule.startDate ?? today} />
          </Field>
          <Field>
            <FieldLabel htmlFor="habit-end-date">End date <Badge variant="outline">Optional</Badge></FieldLabel>
            <Input id="habit-end-date" name="endDate" type="date" defaultValue={habit?.schedule.endDate ?? ''} />
            <FieldDescription>Leave blank for an open-ended practice.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="habit-time">A useful time</FieldLabel>
            <Input id="habit-time" name="timeOfDay" type="time" defaultValue={habit?.schedule.timeOfDay ?? ''} />
            <FieldDescription>Displayed in your profile timezone ({timeZone}).</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="habit-location">A useful place</FieldLabel>
            <Input id="habit-location" name="location" maxLength={160} defaultValue={habit?.schedule.location ?? ''} placeholder="A place that makes starting easier" />
          </Field>
        </FieldGroup>
      </section>

      <details className={styles.advancedDetails} open={hasBehavior || undefined}>
        <summary>
          <span>
            <strong>Design the behavior</strong>
            <small>Optional: identity, cues, friction, rewards and relationships</small>
          </span>
          <span className={styles.detailsMark} aria-hidden="true">+</span>
        </summary>
        <div className={styles.advancedBody}>
          <section className={styles.editorSection} aria-labelledby="identity-title">
            <div className={styles.sectionHeading}>
              <p className={styles.kicker}>IDENTITY BEFORE INTENSITY</p>
              <h3 id="identity-title">The person you are becoming</h3>
            </div>
            <FieldGroup className={styles.fieldGrid}>
              <Field className={styles.fieldWide}>
                <FieldLabel htmlFor="habit-identity">Identity</FieldLabel>
                <Input id="habit-identity" name="identity" maxLength={500} defaultValue={behavior?.identity ?? ''} placeholder="I am someone who..." />
                <FieldDescription>What identity does this practice help you reinforce?</FieldDescription>
              </Field>
              <Field className={styles.fieldWide}>
                <FieldLabel htmlFor="habit-cue">Trigger or cue</FieldLabel>
                <Textarea id="habit-cue" name="cue" maxLength={500} defaultValue={behavior?.cue ?? ''} placeholder="After I..., I will..." />
                <FieldDescription>Name the event or situation that will remind you to begin.</FieldDescription>
              </Field>
              <Field className={styles.fieldWide}>
                <FieldLabel htmlFor="habit-craving">What you hope to feel or get</FieldLabel>
                <Textarea id="habit-craving" name="craving" maxLength={500} defaultValue={behavior?.craving ?? ''} placeholder="The feeling or outcome I am looking for..." />
              </Field>
              <Field className={styles.fieldWide}>
                <FieldLabel htmlFor="habit-routine">The routine</FieldLabel>
                <Textarea id="habit-routine" name="routine" maxLength={500} defaultValue={behavior?.routine ?? ''} placeholder="The smallest clear action I will take..." />
              </Field>
              <Field className={styles.fieldWide}>
                <FieldLabel htmlFor="habit-reward">Immediate reward</FieldLabel>
                <Input id="habit-reward" name="reward" maxLength={500} defaultValue={behavior?.reward ?? ''} placeholder="A small reward that makes finishing satisfying" />
              </Field>
              <Field className={styles.fieldWide}>
                <FieldLabel htmlFor="habit-stack">After which existing routine?</FieldLabel>
                <Select name="stackAfterHabitId" defaultValue={behavior?.stackAfterHabitId || undefined}>
                  <SelectTrigger id="habit-stack" className={styles.selectTrigger}>
                    <SelectValue placeholder="No habit stack yet" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {relatedHabits.filter((item) => item.id !== habit?.id).map((item) => (
                        <SelectItem key={item.id} value={item.id}>{item.name}{item.active ? '' : ' (archived)'}</SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>Place a new action after a routine that already happens.</FieldDescription>
              </Field>
            </FieldGroup>
          </section>

          <section className={styles.editorSection} aria-labelledby="make-easy-title">
            <div className={styles.sectionHeading}>
              <p className={styles.kicker}>REDUCE THE STARTING COST</p>
              <h3 id="make-easy-title">Make the next attempt easier</h3>
            </div>
            <FieldGroup className={styles.fieldGrid}>
              <Field className={styles.fieldWide}>
                <FieldLabel htmlFor="habit-two-minute">Two-minute version</FieldLabel>
                <Input id="habit-two-minute" name="twoMinuteVersion" maxLength={500} defaultValue={behavior?.twoMinuteVersion ?? ''} placeholder="Read one page instead of twenty" />
                <FieldDescription>A small start keeps the routine available on difficult days.</FieldDescription>
              </Field>
              <Field className={styles.fieldWide}>
                <FieldLabel htmlFor="habit-smallest">Smallest acceptable completion</FieldLabel>
                <Input id="habit-smallest" name="smallestCompletion" maxLength={500} defaultValue={behavior?.smallestCompletion ?? ''} placeholder="What still feels like keeping the promise?" />
              </Field>
              <Field className={styles.fieldWide}>
                <FieldLabel htmlFor="habit-prep">What can you prepare beforehand?</FieldLabel>
                <Textarea id="habit-prep" name="environmentPrep" maxLength={500} defaultValue={behavior?.environmentPrep ?? ''} placeholder="Put the shoes by the door, open the book..." />
              </Field>
              <Field>
                <FieldLabel htmlFor="habit-friction">What friction gets in the way?</FieldLabel>
                <Textarea id="habit-friction" name="friction" maxLength={500} defaultValue={behavior?.friction ?? ''} />
              </Field>
              <Field>
                <FieldLabel htmlFor="habit-environment-change">What could change in your environment?</FieldLabel>
                <Textarea id="habit-environment-change" name="environmentChange" maxLength={500} defaultValue={behavior?.environmentChange ?? ''} />
              </Field>
            </FieldGroup>
          </section>

          <section className={styles.editorSection} aria-labelledby="four-laws-title">
            <div className={styles.sectionHeading}>
              <p className={styles.kicker}>A PRACTICAL CHECK, NOT A SCORE</p>
              <h3 id="four-laws-title">Four ways to improve the system</h3>
              <p>Each prompt is optional. Add one useful adjustment rather than trying to optimize everything at once.</p>
            </div>
            <FieldGroup className={styles.fieldGrid}>
              <Field>
                <FieldLabel htmlFor="habit-obvious">Make it obvious</FieldLabel>
                <Textarea id="habit-obvious" name="obvious" maxLength={500} defaultValue={behavior?.obvious ?? ''} placeholder="Make the cue visible or specific" />
              </Field>
              <Field>
                <FieldLabel htmlFor="habit-attractive">Make it attractive</FieldLabel>
                <Textarea id="habit-attractive" name="attractive" maxLength={500} defaultValue={behavior?.attractive ?? ''} placeholder="Pair it with something enjoyable" />
              </Field>
              <Field>
                <FieldLabel htmlFor="habit-easy">Make it easy</FieldLabel>
                <Textarea id="habit-easy" name="easy" maxLength={500} defaultValue={behavior?.easy ?? ''} placeholder="Reduce the first step or friction" />
              </Field>
              <Field>
                <FieldLabel htmlFor="habit-satisfying">Make it satisfying</FieldLabel>
                <Textarea id="habit-satisfying" name="satisfying" maxLength={500} defaultValue={behavior?.satisfying ?? ''} placeholder="Choose a small immediate reward" />
              </Field>
            </FieldGroup>
          </section>

          <section className={styles.editorSection} aria-labelledby="relationships-title">
            <div className={styles.sectionHeading}>
              <p className={styles.kicker}>SYSTEMS CAN SUPPORT EACH OTHER</p>
              <h3 id="relationships-title">Relationships and keystone potential</h3>
              <p>These are your chosen connections, not claims that one habit causes another.</p>
            </div>
            <FieldSet className={styles.relationshipSet}>
              <Field orientation="horizontal" className={styles.keystoneField}>
                <Checkbox id="habit-keystone" name="isKeystone" defaultChecked={behavior?.isKeystone ?? false} value="on" />
                <FieldContent>
                  <FieldLabel htmlFor="habit-keystone">Mark as a potential keystone habit</FieldLabel>
                  <FieldDescription>A practice you believe may support other parts of your routine.</FieldDescription>
                </FieldContent>
              </Field>
              {relatedHabits.filter((item) => item.id !== habit?.id).length > 0 ? (
                <FieldSet>
                  <FieldLegend variant="label">Related habits</FieldLegend>
                  <FieldDescription>Choose any habits you want to review alongside this one.</FieldDescription>
                  <FieldGroup className={styles.relatedHabitGroup}>
                    {relatedHabits.filter((item) => item.id !== habit?.id).map((item) => {
                      const id = `related-${item.id}`
                      return (
                        <Field key={item.id} orientation="horizontal" className={styles.relatedHabitField}>
                          <Checkbox id={id} name="relatedHabitIds" value={item.id} defaultChecked={behavior?.relatedHabitIds.includes(item.id) ?? false} />
                          <FieldContent><FieldLabel htmlFor={id}>{item.name}{item.active ? '' : ' (archived)'}</FieldLabel></FieldContent>
                        </Field>
                      )
                    })}
                  </FieldGroup>
                </FieldSet>
              ) : (
                <p className={styles.mutedNote}>Create another habit when you are ready to add a user-defined relationship.</p>
              )}
            </FieldSet>
          </section>
        </div>
      </details>

      <div className={styles.editorFooter}>
        <p>Changes are saved to your private habit record. Check-ins stay attached to their original local dates.</p>
        <HabitSubmitButton pendingLabel={isEditing ? 'Saving changes…' : 'Creating habit…'}>
          {isEditing ? 'Save changes' : 'Create habit'}
        </HabitSubmitButton>
      </div>
    </form>
  )
}
