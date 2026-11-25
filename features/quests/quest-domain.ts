// Side Quest domain rules. Pure TypeScript (plus zod) so node:test can import it directly.
// Allowed values mirror the check constraints in supabase/migrations/20261126100000_side_quests_core.sql;
// tests/quest-domain.test.mjs fails if they drift apart.
import { z } from 'zod'

export const QUEST_STATUSES = ['backlog', 'active', 'paused', 'completed'] as const
export const QUEST_STRUCTURES = ['structured', 'exploratory'] as const
export const QUEST_DIFFICULTIES = ['intro', 'intermediate', 'advanced', 'expert'] as const
/** Same list and order as HABIT_PILLARS and the side_quests_pillar_check constraint. */
export const QUEST_PILLARS = ['physical', 'intellectual', 'academic', 'professional', 'communication', 'personal'] as const

export type QuestStatus = (typeof QUEST_STATUSES)[number]
export type QuestStructure = (typeof QUEST_STRUCTURES)[number]
export type QuestDifficulty = (typeof QUEST_DIFFICULTIES)[number]
export type QuestPillar = (typeof QUEST_PILLARS)[number]

export const QUEST_LIMITS = {
  title: 160,
  description: 4000,
  category: 60,
  objectiveTitle: 240,
  milestoneTitle: 180,
  milestoneDescription: 2000,
  weeklyTargetMinutes: 10080,
} as const

export const QUEST_STATUS_LABELS: Record<QuestStatus, string> = {
  backlog: 'Backlog',
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
}

export const QUEST_STRUCTURE_LABELS: Record<QuestStructure, string> = {
  structured: 'Structured',
  exploratory: 'Exploratory',
}

export const QUEST_DIFFICULTY_LABELS: Record<QuestDifficulty, string> = {
  intro: 'Intro',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  expert: 'Expert',
}

export const QUEST_PILLAR_LABELS: Record<QuestPillar, string> = {
  physical: 'Physical',
  intellectual: 'Intellectual',
  academic: 'Academic',
  professional: 'Professional',
  communication: 'Communication',
  personal: 'Personal',
}

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

const TRANSITIONS: Record<QuestStatus, readonly QuestStatus[]> = {
  backlog: ['active'],
  active: ['paused', 'completed'],
  paused: ['active', 'completed'],
  completed: ['active'],
}

export function canTransitionQuest(from: QuestStatus, to: QuestStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export function getAllowedQuestTransitions(from: QuestStatus): readonly QuestStatus[] {
  return TRANSITIONS[from]
}

export type QuestLifecycle = {
  status: QuestStatus
  started_at: string | null
  completed_at: string | null
}

/**
 * Column values for moving a quest to `to`. Returns null for a transition the rules do not allow.
 * Becoming active stamps started_at once; completing stamps completed_at; reopening clears it,
 * so a quest never keeps a stale completion timestamp (also enforced by side_quests_completion_check).
 */
export function getQuestStatusUpdate(current: QuestLifecycle, to: QuestStatus, now: Date): QuestLifecycle | null {
  if (!canTransitionQuest(current.status, to)) return null
  const timestamp = now.toISOString()
  const started_at = current.started_at ?? timestamp
  return {
    status: to,
    started_at,
    completed_at: to === 'completed' ? timestamp : null,
  }
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

export type QuestProgressInput = {
  structure: QuestStructure
  objectives: ReadonlyArray<{ achieved_at: string | null }>
  milestones: ReadonlyArray<{ completed_at: string | null }>
}

export type QuestProgress =
  | { kind: 'milestones'; completed: number; total: number; percent: number | null; objectivesAchieved: number; objectivesTotal: number }
  | { kind: 'exploratory'; milestonesCompleted: number; objectivesAchieved: number; objectivesTotal: number }

/**
 * Structured quests show milestone completion as a percentage (null when there are no milestones yet).
 * Exploratory quests never get a percentage: they report counts only.
 */
export function getQuestProgress(input: QuestProgressInput): QuestProgress {
  const objectivesAchieved = input.objectives.filter((o) => o.achieved_at !== null).length
  const objectivesTotal = input.objectives.length
  const completed = input.milestones.filter((m) => m.completed_at !== null).length
  if (input.structure === 'exploratory') {
    return { kind: 'exploratory', milestonesCompleted: completed, objectivesAchieved, objectivesTotal }
  }
  const total = input.milestones.length
  return {
    kind: 'milestones',
    completed,
    total,
    percent: total === 0 ? null : Math.round((completed / total) * 100),
    objectivesAchieved,
    objectivesTotal,
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

export function isDateKey(value: string): boolean {
  if (!DATE_KEY.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z.string().trim().max(max).nullable(),
  )

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess((value) => (value === '' || value === undefined ? null : value), z.enum(values).nullable())

const requiredTitle = (max: number) => z.string().trim().min(1, 'Enter a title.').max(max)

export const questInputSchema = z.object({
  title: requiredTitle(QUEST_LIMITS.title),
  description: optionalText(QUEST_LIMITS.description),
  category: optionalText(QUEST_LIMITS.category),
  difficulty: optionalEnum(QUEST_DIFFICULTIES),
  structure: z.enum(QUEST_STRUCTURES),
  pillar: z.enum(QUEST_PILLARS),
  weeklyTargetMinutes: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? null : Number(value)),
    z.number().int().min(1).max(QUEST_LIMITS.weeklyTargetMinutes).nullable(),
  ),
  targetDate: z.preprocess(
    (value) => (value === '' || value === undefined ? null : value),
    z.string().refine(isDateKey, 'Enter a valid date.').nullable(),
  ),
})

export type QuestInput = z.infer<typeof questInputSchema>

export const objectiveInputSchema = z.object({
  title: requiredTitle(QUEST_LIMITS.objectiveTitle),
})

export const milestoneInputSchema = z.object({
  title: requiredTitle(QUEST_LIMITS.milestoneTitle),
  description: optionalText(QUEST_LIMITS.milestoneDescription),
  dueOn: z.preprocess(
    (value) => (value === '' || value === undefined ? null : value),
    z.string().refine(isDateKey, 'Enter a valid date.').nullable(),
  ),
})

export const questStatusSchema = z.enum(QUEST_STATUSES)
export const uuidSchema = z.string().uuid()

/** Row values for inserting or updating a quest from validated input. */
export function questInputToRow(input: QuestInput) {
  return {
    title: input.title,
    description: input.description,
    category: input.category,
    difficulty: input.difficulty,
    structure: input.structure,
    pillar: input.pillar,
    weekly_target_minutes: input.weeklyTargetMinutes,
    target_date: input.targetDate,
  }
}

/** Position for an item appended to an ordered list. */
export function nextPosition(items: ReadonlyArray<{ position: number }>): number {
  return items.reduce((max, item) => Math.max(max, item.position + 1), 0)
}

// ---------------------------------------------------------------------------
// List filtering
// ---------------------------------------------------------------------------

export type QuestFilter = 'all' | QuestStatus

export function parseQuestFilter(value: string | undefined): QuestFilter {
  return value && (QUEST_STATUSES as readonly string[]).includes(value) ? (value as QuestStatus) : 'all'
}

const STATUS_ORDER: Record<QuestStatus, number> = { active: 0, paused: 1, backlog: 2, completed: 3 }

export function sortQuests<T extends { status: QuestStatus; updated_at: string }>(quests: readonly T[]): T[] {
  return [...quests].sort((a, b) =>
    STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.updated_at.localeCompare(a.updated_at))
}
