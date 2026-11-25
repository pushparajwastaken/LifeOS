// Messages for the ?notice= codes that quest and note actions redirect with.
export const QUEST_NOTICES: Record<string, { text: string; tone: 'info' | 'error' }> = {
  'quest-created': { text: 'Your side quest is ready. Add objectives or milestones if you want structure, or just start exploring.', tone: 'info' },
  'quest-updated': { text: 'Quest details saved.', tone: 'info' },
  'quest-active': { text: 'Quest is active.', tone: 'info' },
  'quest-paused': { text: 'Quest paused. Nothing was lost; resume whenever you are ready.', tone: 'info' },
  'quest-completed': { text: 'Quest completed. Well done.', tone: 'info' },
  'quest-deleted': { text: 'Quest deleted. Its notes are still in your Notes page, and its learning sessions remain in your learning log.', tone: 'info' },
  'session-logged': { text: 'Learning session logged.', tone: 'info' },
  'session-updated': { text: 'Learning session saved.', tone: 'info' },
  'session-deleted': { text: 'Session moved to Recently deleted. You can restore it for 30 days.', tone: 'info' },
  'session-restored': { text: 'Session restored.', tone: 'info' },
  'session-purged': { text: 'Session permanently deleted.', tone: 'info' },
  'restore-expired': { text: 'That session was deleted more than 30 days ago and can no longer be restored.', tone: 'error' },
  'session-needs-topic': { text: 'A session that is not part of a quest needs a topic. Nothing was saved.', tone: 'error' },
  'objective-added': { text: 'Objective added.', tone: 'info' },
  'objective-updated': { text: 'Objective saved.', tone: 'info' },
  'objective-achieved': { text: 'Objective achieved.', tone: 'info' },
  'objective-reopened': { text: 'Objective reopened.', tone: 'info' },
  'objective-deleted': { text: 'Objective removed.', tone: 'info' },
  'milestone-added': { text: 'Milestone added.', tone: 'info' },
  'milestone-updated': { text: 'Milestone saved.', tone: 'info' },
  'milestone-completed': { text: 'Milestone completed.', tone: 'info' },
  'milestone-reopened': { text: 'Milestone reopened.', tone: 'info' },
  'milestone-deleted': { text: 'Milestone removed.', tone: 'info' },
  'note-created': { text: 'Note saved.', tone: 'info' },
  'note-created-unlinked': { text: 'The note was saved but could not be linked to this quest. You can find it under Unlinked notes.', tone: 'error' },
  'note-updated': { text: 'Note saved.', tone: 'info' },
  'note-deleted': { text: 'Note deleted.', tone: 'info' },
  'note-linked': { text: 'Note linked.', tone: 'info' },
  'note-already-linked': { text: 'That note is already linked.', tone: 'info' },
  'note-unlinked': { text: 'Note unlinked. The note itself is kept.', tone: 'info' },
  'invalid-transition': { text: 'That status change is not available from the current status. Refresh and try again.', tone: 'error' },
  'delete-unconfirmed': { text: 'Nothing was deleted. Tick the confirmation box to delete.', tone: 'error' },
  'input-invalid': { text: 'Some details were missing or invalid. No records were changed.', tone: 'error' },
  'record-not-found': { text: 'That record could not be found in your workspace.', tone: 'error' },
  'save-failed': { text: 'That change could not be saved. Try again in a moment.', tone: 'error' },
}

export function resolveNotice(raw: string | string[] | undefined) {
  const code = Array.isArray(raw) ? raw[0] : raw
  return code ? QUEST_NOTICES[code] ?? null : null
}

export function formatDateKey(value: string | null): string | null {
  if (!value) return null
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T00:00:00Z`))
}

export function formatTimestamp(value: string | null, timeZone: string): string | null {
  if (!value) return null
  return new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
}

export function formatMinutes(minutes: number | null): string | null {
  if (!minutes) return null
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} min`
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}
