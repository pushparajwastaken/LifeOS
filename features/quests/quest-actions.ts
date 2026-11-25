'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  getQuestStatusUpdate,
  milestoneInputSchema,
  nextPosition,
  objectiveInputSchema,
  questInputSchema,
  questInputToRow,
  questStatusSchema,
  uuidSchema,
} from './quest-domain'
import { getOwnedQuest } from './quest-service'

function formString(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value : ''
}

function questPath(questId?: string): string {
  return questId ? `/quests/${questId}` : '/quests'
}

function redirectWithNotice(path: string, notice: string): never {
  revalidatePath('/quests')
  if (path !== '/quests') revalidatePath(path)
  redirect(`${path}?notice=${notice}`)
}

async function getContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return { supabase, userId: user.id }
}

function readQuestInput(formData: FormData) {
  return questInputSchema.safeParse({
    title: formString(formData, 'title'),
    description: formString(formData, 'description'),
    category: formString(formData, 'category'),
    difficulty: formString(formData, 'difficulty'),
    structure: formString(formData, 'structure'),
    pillar: formString(formData, 'pillar'),
    weeklyTargetMinutes: formString(formData, 'weeklyTargetMinutes'),
    targetDate: formString(formData, 'targetDate'),
  })
}

/** Validates the quest id and confirms the signed-in user owns it. */
async function requireOwnedQuest(formData: FormData) {
  const questId = formString(formData, 'questId')
  if (!uuidSchema.safeParse(questId).success) redirectWithNotice('/quests', 'record-not-found')
  const context = await getContext()
  const quest = await getOwnedQuest(context.supabase, context.userId, questId)
  if (!quest) redirectWithNotice('/quests', 'record-not-found')
  return { ...context, quest }
}

// ---------------------------------------------------------------------------
// Quests
// ---------------------------------------------------------------------------

export async function createQuestAction(formData: FormData): Promise<void> {
  const parsed = readQuestInput(formData)
  if (!parsed.success) redirectWithNotice('/quests', 'input-invalid')
  const { supabase, userId } = await getContext()
  const { data, error } = await supabase
    .from('side_quests')
    .insert({ user_id: userId, ...questInputToRow(parsed.data) })
    .select('id')
    .single()
  if (error || !data) redirectWithNotice('/quests', 'save-failed')
  redirectWithNotice(questPath(data.id), 'quest-created')
}

export async function updateQuestAction(formData: FormData): Promise<void> {
  const { supabase, userId, quest } = await requireOwnedQuest(formData)
  const parsed = readQuestInput(formData)
  if (!parsed.success) redirectWithNotice(questPath(quest.id), 'input-invalid')
  const { data, error } = await supabase
    .from('side_quests')
    .update(questInputToRow(parsed.data))
    .eq('id', quest.id)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()
  redirectWithNotice(questPath(quest.id), error || !data ? 'save-failed' : 'quest-updated')
}

export async function setQuestStatusAction(formData: FormData): Promise<void> {
  const { supabase, userId, quest } = await requireOwnedQuest(formData)
  const target = questStatusSchema.safeParse(formString(formData, 'status'))
  if (!target.success) redirectWithNotice(questPath(quest.id), 'invalid-transition')
  const update = getQuestStatusUpdate(quest, target.data, new Date())
  if (!update) redirectWithNotice(questPath(quest.id), 'invalid-transition')
  // Only apply the change if the status has not moved since the page was loaded.
  const { data, error } = await supabase
    .from('side_quests')
    .update(update)
    .eq('id', quest.id)
    .eq('user_id', userId)
    .eq('status', quest.status)
    .select('id')
    .maybeSingle()
  redirectWithNotice(questPath(quest.id), error || !data ? 'save-failed' : `quest-${target.data}`)
}

export async function deleteQuestAction(formData: FormData): Promise<void> {
  const { supabase, userId, quest } = await requireOwnedQuest(formData)
  if (formString(formData, 'confirm') !== 'delete') redirectWithNotice(questPath(quest.id), 'delete-unconfirmed')
  // Objectives, milestones and note links cascade; knowledge notes themselves are kept.
  const { data, error } = await supabase
    .from('side_quests')
    .delete()
    .eq('id', quest.id)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()
  if (error || !data) redirectWithNotice(questPath(quest.id), 'save-failed')
  revalidatePath('/knowledge')
  redirectWithNotice('/quests', 'quest-deleted')
}

// ---------------------------------------------------------------------------
// Objectives
// ---------------------------------------------------------------------------

export async function addObjectiveAction(formData: FormData): Promise<void> {
  const { supabase, userId, quest } = await requireOwnedQuest(formData)
  const parsed = objectiveInputSchema.safeParse({ title: formString(formData, 'title') })
  if (!parsed.success) redirectWithNotice(questPath(quest.id), 'input-invalid')
  const { data: existing } = await supabase.from('quest_objectives').select('position').eq('quest_id', quest.id).eq('user_id', userId)
  const { error } = await supabase.from('quest_objectives').insert({
    user_id: userId,
    quest_id: quest.id,
    title: parsed.data.title,
    position: nextPosition(existing ?? []),
  })
  redirectWithNotice(questPath(quest.id), error ? 'save-failed' : 'objective-added')
}

export async function updateObjectiveAction(formData: FormData): Promise<void> {
  const { supabase, userId, quest } = await requireOwnedQuest(formData)
  const objectiveId = formString(formData, 'objectiveId')
  const parsed = objectiveInputSchema.safeParse({ title: formString(formData, 'title') })
  if (!uuidSchema.safeParse(objectiveId).success || !parsed.success) redirectWithNotice(questPath(quest.id), 'input-invalid')
  const { data, error } = await supabase.from('quest_objectives').update({ title: parsed.data.title })
    .eq('id', objectiveId).eq('quest_id', quest.id).eq('user_id', userId).select('id').maybeSingle()
  redirectWithNotice(questPath(quest.id), error || !data ? 'save-failed' : 'objective-updated')
}

export async function toggleObjectiveAction(formData: FormData): Promise<void> {
  const { supabase, userId, quest } = await requireOwnedQuest(formData)
  const objectiveId = formString(formData, 'objectiveId')
  if (!uuidSchema.safeParse(objectiveId).success) redirectWithNotice(questPath(quest.id), 'record-not-found')
  const achieved = formString(formData, 'achieved') === 'true'
  const { data, error } = await supabase.from('quest_objectives')
    .update({ achieved_at: achieved ? new Date().toISOString() : null })
    .eq('id', objectiveId).eq('quest_id', quest.id).eq('user_id', userId).select('id').maybeSingle()
  redirectWithNotice(questPath(quest.id), error || !data ? 'save-failed' : achieved ? 'objective-achieved' : 'objective-reopened')
}

export async function deleteObjectiveAction(formData: FormData): Promise<void> {
  const { supabase, userId, quest } = await requireOwnedQuest(formData)
  const objectiveId = formString(formData, 'objectiveId')
  if (!uuidSchema.safeParse(objectiveId).success) redirectWithNotice(questPath(quest.id), 'record-not-found')
  const { data, error } = await supabase.from('quest_objectives').delete()
    .eq('id', objectiveId).eq('quest_id', quest.id).eq('user_id', userId).select('id').maybeSingle()
  redirectWithNotice(questPath(quest.id), error || !data ? 'save-failed' : 'objective-deleted')
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

function readMilestoneInput(formData: FormData) {
  return milestoneInputSchema.safeParse({
    title: formString(formData, 'title'),
    description: formString(formData, 'description'),
    dueOn: formString(formData, 'dueOn'),
  })
}

export async function addMilestoneAction(formData: FormData): Promise<void> {
  const { supabase, userId, quest } = await requireOwnedQuest(formData)
  const parsed = readMilestoneInput(formData)
  if (!parsed.success) redirectWithNotice(questPath(quest.id), 'input-invalid')
  const { data: existing } = await supabase.from('quest_milestones').select('position').eq('quest_id', quest.id).eq('user_id', userId)
  const { error } = await supabase.from('quest_milestones').insert({
    user_id: userId,
    quest_id: quest.id,
    title: parsed.data.title,
    description: parsed.data.description,
    due_on: parsed.data.dueOn,
    position: nextPosition(existing ?? []),
  })
  redirectWithNotice(questPath(quest.id), error ? 'save-failed' : 'milestone-added')
}

export async function updateMilestoneAction(formData: FormData): Promise<void> {
  const { supabase, userId, quest } = await requireOwnedQuest(formData)
  const milestoneId = formString(formData, 'milestoneId')
  const parsed = readMilestoneInput(formData)
  if (!uuidSchema.safeParse(milestoneId).success || !parsed.success) redirectWithNotice(questPath(quest.id), 'input-invalid')
  const { data, error } = await supabase.from('quest_milestones')
    .update({ title: parsed.data.title, description: parsed.data.description, due_on: parsed.data.dueOn })
    .eq('id', milestoneId).eq('quest_id', quest.id).eq('user_id', userId).select('id').maybeSingle()
  redirectWithNotice(questPath(quest.id), error || !data ? 'save-failed' : 'milestone-updated')
}

export async function toggleMilestoneAction(formData: FormData): Promise<void> {
  const { supabase, userId, quest } = await requireOwnedQuest(formData)
  const milestoneId = formString(formData, 'milestoneId')
  if (!uuidSchema.safeParse(milestoneId).success) redirectWithNotice(questPath(quest.id), 'record-not-found')
  const completed = formString(formData, 'completed') === 'true'
  const { data, error } = await supabase.from('quest_milestones')
    .update({ completed_at: completed ? new Date().toISOString() : null })
    .eq('id', milestoneId).eq('quest_id', quest.id).eq('user_id', userId).select('id').maybeSingle()
  redirectWithNotice(questPath(quest.id), error || !data ? 'save-failed' : completed ? 'milestone-completed' : 'milestone-reopened')
}

export async function deleteMilestoneAction(formData: FormData): Promise<void> {
  const { supabase, userId, quest } = await requireOwnedQuest(formData)
  const milestoneId = formString(formData, 'milestoneId')
  if (!uuidSchema.safeParse(milestoneId).success) redirectWithNotice(questPath(quest.id), 'record-not-found')
  const { data, error } = await supabase.from('quest_milestones').delete()
    .eq('id', milestoneId).eq('quest_id', quest.id).eq('user_id', userId).select('id').maybeSingle()
  redirectWithNotice(questPath(quest.id), error || !data ? 'save-failed' : 'milestone-deleted')
}
