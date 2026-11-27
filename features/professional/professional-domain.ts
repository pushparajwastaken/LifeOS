// Professional pillar: projects (milestones, tasks), coding sessions, shipping log and DSA practice
// (core tables projects, project_milestones, project_tasks, coding_sessions, shipping_logs, dsa_logs).
import { z } from 'zod'
import { dateKey, optionalDateKey, optionalText, optionalWebUrl, requiredText, timeOfDay, wholeNumber } from '../pillars/pillar-domain.ts'

export const PROJECT_STATUSES = ['active', 'paused', 'completed', 'archived'] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = { active: 'Active', paused: 'Paused', completed: 'Completed', archived: 'Archived' }

export const MILESTONE_STATUSES = ['todo', 'in_progress', 'done'] as const
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number]
export const PROJECT_TASK_STATUSES = ['todo', 'in_progress', 'blocked', 'done'] as const
export type ProjectTaskStatus = (typeof PROJECT_TASK_STATUSES)[number]
export const WORK_STATUS_LABELS: Record<ProjectTaskStatus, string> = { todo: 'To do', in_progress: 'In progress', blocked: 'Blocked', done: 'Done' }
export const PRIORITIES = ['high', 'medium', 'low'] as const

export const DSA_DIFFICULTIES = ['easy', 'medium', 'hard'] as const
export const DSA_OUTCOMES = ['solved', 'attempted', 'reviewed'] as const
export type DsaOutcome = (typeof DSA_OUTCOMES)[number]
export const DSA_OUTCOME_LABELS: Record<DsaOutcome, string> = { solved: 'Solved', attempted: 'Attempted', reviewed: 'Reviewed' }

export const PROFESSIONAL_LIMITS = { name: 180, description: 4000, milestone: 180, task: 200, notes: 2000, shipped: 180, problem: 200, platform: 60, maxMinutes: 1440 } as const

export const projectInputSchema = z.object({
  name: requiredText(PROFESSIONAL_LIMITS.name),
  description: optionalText(PROFESSIONAL_LIMITS.description),
  repositoryUrl: optionalWebUrl,
  startedOn: optionalDateKey,
  dueOn: optionalDateKey,
}).refine((input) => !input.startedOn || !input.dueOn || input.dueOn >= input.startedOn, { message: 'Due before start', path: ['dueOn'] })

export const milestoneInputSchema = z.object({ title: requiredText(PROFESSIONAL_LIMITS.milestone), dueOn: optionalDateKey })
export const projectTaskInputSchema = z.object({ title: requiredText(PROFESSIONAL_LIMITS.task), priority: z.enum(PRIORITIES), dueOn: optionalDateKey })

export const codingSessionSchema = z.object({ date: dateKey, time: timeOfDay, minutes: wholeNumber(1, PROFESSIONAL_LIMITS.maxMinutes), notes: optionalText(PROFESSIONAL_LIMITS.notes) })
export const shippingInputSchema = z.object({ title: requiredText(PROFESSIONAL_LIMITS.shipped), description: optionalText(PROFESSIONAL_LIMITS.notes), date: dateKey })
export const dsaInputSchema = z.object({
  problem: requiredText(PROFESSIONAL_LIMITS.problem),
  platform: optionalText(PROFESSIONAL_LIMITS.platform),
  difficulty: z.union([z.enum(DSA_DIFFICULTIES), z.literal('')]).transform((value) => (value === '' ? null : value)),
  outcome: z.enum(DSA_OUTCOMES),
  url: optionalWebUrl,
  notes: optionalText(PROFESSIONAL_LIMITS.notes),
  date: dateKey,
})

/** completed_at follows the milestone status: set when it becomes done, cleared otherwise. */
export function milestoneCompletion(status: MilestoneStatus, now: Date): { status: MilestoneStatus; completed_at: string | null } {
  return { status, completed_at: status === 'done' ? now.toISOString() : null }
}

export type ProjectProgress = { done: number; total: number; percent: number | null; blocked: number }

export function projectProgress(tasks: ReadonlyArray<{ status: string }>): ProjectProgress {
  const total = tasks.length
  const done = tasks.filter((task) => task.status === 'done').length
  return { done, total, percent: total ? Math.round((done / total) * 100) : null, blocked: tasks.filter((task) => task.status === 'blocked').length }
}
