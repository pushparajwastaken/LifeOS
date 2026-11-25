import type { createClient } from '@/lib/supabase/server'
import { normalizeSearchQuery } from '@/features/notes/note-domain'
import {
  getQuestProgress,
  sortQuests,
  type QuestDifficulty,
  type QuestFilter,
  type QuestPillar,
  type QuestProgress,
  type QuestStatus,
  type QuestStructure,
} from './quest-domain'

type Supabase = Awaited<ReturnType<typeof createClient>>

export const QUEST_SELECT = 'id,title,description,category,difficulty,structure,status,pillar,weekly_target_minutes,target_date,started_at,completed_at,created_at,updated_at'

export type Quest = {
  id: string
  title: string
  description: string | null
  category: string | null
  difficulty: QuestDifficulty | null
  structure: QuestStructure
  status: QuestStatus
  pillar: QuestPillar
  weekly_target_minutes: number | null
  target_date: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type QuestObjective = { id: string; title: string; position: number; achieved_at: string | null }
export type QuestMilestone = { id: string; title: string; description: string | null; due_on: string | null; position: number; completed_at: string | null }
export type LinkedNote = { id: string; title: string; note_type: string; updated_at: string; linked_at: string }
export type NoteOption = { id: string; title: string; note_type: string }

export type QuestListItem = Quest & { progress: QuestProgress }

export type QuestListData = {
  quests: QuestListItem[]
  counts: Record<QuestFilter, number>
  hasLoadError: boolean
}

export async function getQuestListData(supabase: Supabase, userId: string, filter: QuestFilter): Promise<QuestListData> {
  const { data, error } = await supabase
    .from('side_quests')
    .select(QUEST_SELECT)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(500)
  const all = (data ?? []) as Quest[]
  const counts: Record<QuestFilter, number> = { all: all.length, backlog: 0, active: 0, paused: 0, completed: 0 }
  for (const quest of all) counts[quest.status] += 1
  const visible = filter === 'all' ? all : all.filter((quest) => quest.status === filter)
  const ids = visible.map((quest) => quest.id)

  let objectives: Array<{ quest_id: string; achieved_at: string | null }> = []
  let milestones: Array<{ quest_id: string; completed_at: string | null }> = []
  let childError = false
  if (ids.length > 0) {
    const [objectiveResult, milestoneResult] = await Promise.all([
      supabase.from('quest_objectives').select('quest_id,achieved_at').eq('user_id', userId).in('quest_id', ids),
      supabase.from('quest_milestones').select('quest_id,completed_at').eq('user_id', userId).in('quest_id', ids),
    ])
    objectives = objectiveResult.data ?? []
    milestones = milestoneResult.data ?? []
    childError = Boolean(objectiveResult.error || milestoneResult.error)
  }

  const quests = sortQuests(visible).map((quest) => ({
    ...quest,
    progress: getQuestProgress({
      structure: quest.structure,
      objectives: objectives.filter((o) => o.quest_id === quest.id),
      milestones: milestones.filter((m) => m.quest_id === quest.id),
    }),
  }))
  return { quests, counts, hasLoadError: Boolean(error) || childError }
}

export async function getOwnedQuest(supabase: Supabase, userId: string, questId: string): Promise<Quest | null> {
  const { data, error } = await supabase
    .from('side_quests')
    .select(QUEST_SELECT)
    .eq('id', questId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return null
  return data as Quest
}

export type QuestDetailData = {
  quest: Quest
  objectives: QuestObjective[]
  milestones: QuestMilestone[]
  notes: LinkedNote[]
  noteOptions: NoteOption[]
  noteQuery: string | null
  progress: QuestProgress
  hasLoadError: boolean
}

type LinkRow = { created_at: string; knowledge_notes: { id: string; title: string; note_type: string; updated_at: string } | null }

export async function getQuestDetailData(
  supabase: Supabase,
  userId: string,
  questId: string,
  rawNoteQuery?: string,
): Promise<QuestDetailData | null> {
  const quest = await getOwnedQuest(supabase, userId, questId)
  if (!quest) return null
  const noteQuery = normalizeSearchQuery(rawNoteQuery)

  let optionsQuery = supabase
    .from('knowledge_notes')
    .select('id,title,note_type')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(20)
  if (noteQuery) optionsQuery = optionsQuery.textSearch('search_document', noteQuery, { type: 'websearch', config: 'english' })

  const [objectiveResult, milestoneResult, linkResult, optionResult] = await Promise.all([
    supabase.from('quest_objectives').select('id,title,position,achieved_at').eq('quest_id', questId).eq('user_id', userId)
      .order('position', { ascending: true }).order('created_at', { ascending: true }),
    supabase.from('quest_milestones').select('id,title,description,due_on,position,completed_at').eq('quest_id', questId).eq('user_id', userId)
      .order('position', { ascending: true }).order('created_at', { ascending: true }),
    supabase.from('quest_notes').select('created_at,knowledge_notes(id,title,note_type,updated_at)').eq('quest_id', questId).eq('user_id', userId)
      .order('created_at', { ascending: false }),
    optionsQuery,
  ])

  const objectives = (objectiveResult.data ?? []) as QuestObjective[]
  const milestones = (milestoneResult.data ?? []) as QuestMilestone[]
  const notes = ((linkResult.data ?? []) as unknown as LinkRow[])
    .filter((row) => row.knowledge_notes !== null)
    .map((row) => ({ ...(row.knowledge_notes as NonNullable<LinkRow['knowledge_notes']>), linked_at: row.created_at }))
  const linkedIds = new Set(notes.map((note) => note.id))
  const noteOptions = ((optionResult.data ?? []) as NoteOption[]).filter((note) => !linkedIds.has(note.id))

  return {
    quest,
    objectives,
    milestones,
    notes,
    noteOptions,
    noteQuery,
    progress: getQuestProgress({ structure: quest.structure, objectives, milestones }),
    hasLoadError: Boolean(objectiveResult.error || milestoneResult.error || linkResult.error || optionResult.error),
  }
}
