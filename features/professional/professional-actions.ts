'use server'

import { uuidSchema } from '@/features/quests/quest-domain'
import { weekStartOf } from '@/features/pillars/pillar-domain'
import { field, finish, pastInstant, pillarSession, requireId } from '@/features/pillars/pillar-actions-kit'
import {
  MILESTONE_STATUSES,
  PROJECT_STATUSES,
  PROJECT_TASK_STATUSES,
  codingSessionSchema,
  dsaInputSchema,
  milestoneCompletion,
  milestoneInputSchema,
  projectInputSchema,
  projectTaskInputSchema,
  shippingInputSchema,
  type MilestoneStatus,
  type ProjectStatus,
  type ProjectTaskStatus,
} from './professional-domain'
import { getOwnedProject } from './professional-service'

const HOME = '/professional'
type Session = Awaited<ReturnType<typeof pillarSession>>

function parseProject(formData: FormData) {
  return projectInputSchema.safeParse({ name: field(formData, 'name'), description: field(formData, 'description'), repositoryUrl: field(formData, 'repositoryUrl'), startedOn: field(formData, 'startedOn'), dueOn: field(formData, 'dueOn') })
}

async function ownedProject(formData: FormData) {
  const projectId = requireId(formData, 'projectId', HOME)
  const session = await pillarSession()
  const project = await getOwnedProject(session.supabase, session.userId, projectId)
  if (!project) finish(HOME, 'record-not-found')
  return { ...session, project, path: `${HOME}/${project.id}` }
}

/** Optional project link from a form; must be one of the user's projects. undefined means invalid. */
async function optionalProject(formData: FormData, session: Session): Promise<string | null | undefined> {
  const raw = field(formData, 'projectId')
  if (!raw) return null
  const parsed = uuidSchema.safeParse(raw)
  if (!parsed.success) return undefined
  const project = await getOwnedProject(session.supabase, session.userId, parsed.data)
  return project ? project.id : undefined
}

/** Return path for forms that can live on the overview or a project page. */
function back(formData: FormData, projectId: string | null) {
  return field(formData, 'returnTo') === 'project' && projectId ? `${HOME}/${projectId}` : HOME
}

export async function createProjectAction(formData: FormData): Promise<void> {
  const parsed = parseProject(formData)
  if (!parsed.success) finish(HOME, 'project-invalid', '#add-project')
  const { supabase, userId } = await pillarSession()
  const { data, error } = await supabase.from('projects').insert({ user_id: userId, name: parsed.data.name, description: parsed.data.description, repository_url: parsed.data.repositoryUrl, started_on: parsed.data.startedOn, due_on: parsed.data.dueOn }).select('id').single()
  if (error || !data) finish(HOME, 'save-failed')
  finish(`${HOME}/${data.id}`, 'project-added')
}

export async function updateProjectAction(formData: FormData): Promise<void> {
  const { supabase, userId, project, path } = await ownedProject(formData)
  const parsed = parseProject(formData)
  if (!parsed.success) finish(path, 'project-invalid', '#edit')
  const { error } = await supabase.from('projects').update({ name: parsed.data.name, description: parsed.data.description, repository_url: parsed.data.repositoryUrl, started_on: parsed.data.startedOn, due_on: parsed.data.dueOn }).eq('id', project.id).eq('user_id', userId)
  finish(path, error ? 'save-failed' : 'project-updated')
}

export async function setProjectStatusAction(formData: FormData): Promise<void> {
  const { supabase, userId, project, path } = await ownedProject(formData)
  const status = field(formData, 'status') as ProjectStatus
  if (!(PROJECT_STATUSES as readonly string[]).includes(status)) finish(path, 'record-not-found')
  const { error } = await supabase.from('projects').update({ status }).eq('id', project.id).eq('user_id', userId)
  finish(path, error ? 'save-failed' : 'project-updated')
}

export async function deleteProjectAction(formData: FormData): Promise<void> {
  const { supabase, userId, project, path } = await ownedProject(formData)
  if (field(formData, 'confirm') !== 'delete') finish(path, 'delete-confirm', '#delete')
  const { error } = await supabase.from('projects').delete().eq('id', project.id).eq('user_id', userId)
  finish(error ? path : HOME, error ? 'save-failed' : 'project-deleted')
}

export async function addMilestoneAction(formData: FormData): Promise<void> {
  const { supabase, userId, project, path } = await ownedProject(formData)
  const parsed = milestoneInputSchema.safeParse({ title: field(formData, 'title'), dueOn: field(formData, 'dueOn') })
  if (!parsed.success) finish(path, 'milestone-invalid', '#milestones')
  const { error } = await supabase.from('project_milestones').insert({ user_id: userId, project_id: project.id, title: parsed.data.title, due_on: parsed.data.dueOn })
  finish(path, error ? 'save-failed' : 'project-milestone-added', '#milestones')
}

export async function setMilestoneStatusAction(formData: FormData): Promise<void> {
  const { supabase, userId, project, path } = await ownedProject(formData)
  const milestoneId = requireId(formData, 'milestoneId', path)
  const status = field(formData, 'status') as MilestoneStatus
  if (!(MILESTONE_STATUSES as readonly string[]).includes(status)) finish(path, 'record-not-found')
  const { error } = await supabase.from('project_milestones').update(milestoneCompletion(status, new Date())).eq('id', milestoneId).eq('project_id', project.id).eq('user_id', userId).neq('status', status)
  finish(path, error ? 'save-failed' : 'project-milestone-updated', '#milestones')
}

export async function deleteMilestoneAction(formData: FormData): Promise<void> {
  const { supabase, userId, project, path } = await ownedProject(formData)
  const milestoneId = requireId(formData, 'milestoneId', path)
  const { error } = await supabase.from('project_milestones').delete().eq('id', milestoneId).eq('project_id', project.id).eq('user_id', userId)
  finish(path, error ? 'save-failed' : 'project-milestone-deleted', '#milestones')
}

export async function addProjectTaskAction(formData: FormData): Promise<void> {
  const { supabase, userId, project, path } = await ownedProject(formData)
  const parsed = projectTaskInputSchema.safeParse({ title: field(formData, 'title'), priority: field(formData, 'priority') || 'medium', dueOn: field(formData, 'dueOn') })
  const rawMilestone = field(formData, 'milestoneId')
  let milestoneId: string | null = null
  if (rawMilestone) {
    const parsedId = uuidSchema.safeParse(rawMilestone)
    const { data } = parsedId.success ? await supabase.from('project_milestones').select('id').eq('id', parsedId.data).eq('project_id', project.id).eq('user_id', userId).maybeSingle() : { data: null }
    if (!data) finish(path, 'project-task-invalid', '#tasks')
    milestoneId = data.id
  }
  if (!parsed.success) finish(path, 'project-task-invalid', '#tasks')
  const { error } = await supabase.from('project_tasks').insert({ user_id: userId, project_id: project.id, milestone_id: milestoneId, title: parsed.data.title, priority: parsed.data.priority, due_on: parsed.data.dueOn })
  finish(path, error ? 'save-failed' : 'project-task-added', '#tasks')
}

export async function setProjectTaskStatusAction(formData: FormData): Promise<void> {
  const { supabase, userId, project, path } = await ownedProject(formData)
  const taskId = requireId(formData, 'taskId', path)
  const status = field(formData, 'status') as ProjectTaskStatus
  if (!(PROJECT_TASK_STATUSES as readonly string[]).includes(status)) finish(path, 'record-not-found')
  const { error } = await supabase.from('project_tasks').update({ status }).eq('id', taskId).eq('project_id', project.id).eq('user_id', userId)
  finish(path, error ? 'save-failed' : 'project-task-updated', '#tasks')
}

export async function deleteProjectTaskAction(formData: FormData): Promise<void> {
  const { supabase, userId, project, path } = await ownedProject(formData)
  const taskId = requireId(formData, 'taskId', path)
  const { error } = await supabase.from('project_tasks').delete().eq('id', taskId).eq('project_id', project.id).eq('user_id', userId)
  finish(path, error ? 'save-failed' : 'project-task-deleted', '#tasks')
}

export async function logCodingAction(formData: FormData): Promise<void> {
  const session = await pillarSession()
  const projectId = await optionalProject(formData, session)
  const path = back(formData, projectId ?? null)
  const parsed = codingSessionSchema.safeParse({ date: field(formData, 'date') || session.today, time: field(formData, 'time'), minutes: field(formData, 'minutes'), notes: field(formData, 'notes') })
  if (!parsed.success || projectId === undefined) finish(path, 'coding-invalid', '#coding')
  const startedAt = pastInstant(parsed.data.date, parsed.data.time, session.timeZone)
  if (!startedAt) finish(path, 'physical-future', '#coding')
  const { error } = await session.supabase.from('coding_sessions').insert({ user_id: session.userId, project_id: projectId, started_at: startedAt, duration_minutes: parsed.data.minutes, notes: parsed.data.notes })
  finish(path, error ? 'save-failed' : 'coding-logged', '#coding')
}

export async function logShippedAction(formData: FormData): Promise<void> {
  const session = await pillarSession()
  const projectId = await optionalProject(formData, session)
  const path = back(formData, projectId ?? null)
  const parsed = shippingInputSchema.safeParse({ title: field(formData, 'title'), description: field(formData, 'description'), date: field(formData, 'date') || session.today })
  if (!parsed.success || projectId === undefined || parsed.data.date > session.today) finish(path, 'shipped-invalid', '#shipped')
  const shippedAt = parsed.data.date === session.today ? new Date().toISOString() : pastInstant(parsed.data.date, '12:00', session.timeZone)
  const { error } = await session.supabase.from('shipping_logs').insert({ user_id: session.userId, project_id: projectId, title: parsed.data.title, description: parsed.data.description, shipped_at: shippedAt, week_start: weekStartOf(parsed.data.date) })
  finish(path, error ? 'save-failed' : 'shipped-logged', '#shipped')
}

export async function logDsaAction(formData: FormData): Promise<void> {
  const session = await pillarSession()
  const parsed = dsaInputSchema.safeParse({ problem: field(formData, 'problem'), platform: field(formData, 'platform'), difficulty: field(formData, 'difficulty'), outcome: field(formData, 'outcome') || 'solved', url: field(formData, 'url'), notes: field(formData, 'notes'), date: field(formData, 'date') || session.today })
  if (!parsed.success || parsed.data.date > session.today) finish(HOME, 'dsa-invalid', '#dsa')
  const practicedAt = parsed.data.date === session.today ? new Date().toISOString() : pastInstant(parsed.data.date, '12:00', session.timeZone)
  const { error } = await session.supabase.from('dsa_logs').insert({ user_id: session.userId, practiced_at: practicedAt, problem: parsed.data.problem, platform: parsed.data.platform, difficulty: parsed.data.difficulty, outcome: parsed.data.outcome, url: parsed.data.url, notes: parsed.data.notes })
  finish(HOME, error ? 'save-failed' : 'dsa-logged', '#dsa')
}

const DELETABLE = { coding: 'coding_sessions', shipped: 'shipping_logs', dsa: 'dsa_logs' } as const

export async function deleteProfessionalEntryAction(formData: FormData): Promise<void> {
  const kind = field(formData, 'kind') as keyof typeof DELETABLE
  const entryId = requireId(formData, 'entryId', HOME)
  if (!Object.hasOwn(DELETABLE, kind)) finish(HOME, 'record-not-found')
  const { supabase, userId } = await pillarSession()
  const { data, error } = await supabase.from(DELETABLE[kind]).delete().eq('id', entryId).eq('user_id', userId).select('id').maybeSingle()
  const rawProject = field(formData, 'returnProject')
  const path = uuidSchema.safeParse(rawProject).success ? `${HOME}/${rawProject}` : HOME
  finish(path, error ? 'save-failed' : data ? 'entry-deleted' : 'record-not-found', `#${kind}`)
}
