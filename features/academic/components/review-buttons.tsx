import { SubmitButton } from '@/features/quests/components/submit-button'
import { reviewRevisionAction } from '../academic-actions'
import { REVISION_GRADES, REVISION_GRADE_LABELS } from '../academic-domain'

/** Four grade buttons for one revision card; each is its own form so a press sends exactly one grade. */
export function ReviewButtons({ itemId, returnTo }: { itemId: string; returnTo?: 'list' }) {
  return (
    <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>
      {REVISION_GRADES.map((grade) => (
        <form key={grade} action={reviewRevisionAction}>
          <input type="hidden" name="itemId" value={itemId} />
          <input type="hidden" name="grade" value={grade} />
          {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
          <SubmitButton variant={grade === 'good' ? 'default' : 'outline'} size="sm" pendingLabel="…">{REVISION_GRADE_LABELS[grade]}</SubmitButton>
        </form>
      ))}
    </span>
  )
}
