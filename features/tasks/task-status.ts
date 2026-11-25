// Task status contract.
// The database is the source of truth: these values mirror the `tasks.status` check constraint in
// supabase/migrations/202611110001_lifeos_core.sql. tests/task-status.test.mjs fails if they drift apart.

export const TASK_STATUSES = ['todo', 'in_progress', 'done', 'cancelled'] as const

export type TaskStatus = (typeof TASK_STATUSES)[number]

/** Statuses shown in open-task lists. */
export const OPEN_TASK_STATUSES = ['todo', 'in_progress'] as const satisfies readonly TaskStatus[]

/** Status written when a task is completed. */
export const COMPLETED_TASK_STATUS = 'done' satisfies TaskStatus

/** Status written when a new task is created. */
export const DEFAULT_TASK_STATUS = 'todo' satisfies TaskStatus

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && (TASK_STATUSES as readonly string[]).includes(value)
}

export function isOpenTaskStatus(value: unknown): boolean {
  return typeof value === 'string' && (OPEN_TASK_STATUSES as readonly string[]).includes(value)
}

export type TaskStatusUpdate = {
  status: TaskStatus
  completed_at: string | null
  updated_at: string
}

/**
 * Builds the column values for moving a task to `status`.
 * `completed_at` is set only for `done`, and cleared for every other status, so a reopened or
 * cancelled task never keeps a stale completion timestamp. Unknown statuses are rejected.
 */
export function getTaskStatusUpdate(status: unknown, now: Date): TaskStatusUpdate {
  if (!isTaskStatus(status)) {
    throw new RangeError(`Unknown task status: ${String(status)}`)
  }
  const timestamp = now.toISOString()
  return {
    status,
    completed_at: status === COMPLETED_TASK_STATUS ? timestamp : null,
    updated_at: timestamp,
  }
}

export function filterOpenTasks<T extends { status: string }>(tasks: readonly T[]): T[] {
  return tasks.filter((task) => isOpenTaskStatus(task.status))
}
