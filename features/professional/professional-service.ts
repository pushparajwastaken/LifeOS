import type { createClient } from '@/lib/supabase/server'
import { localDateKey, sumByWeek, weekWindow } from '@/features/analytics/analytics-domain'
import { weekStartOf } from '@/features/pillars/pillar-domain'
import { projectProgress, type MilestoneStatus, type ProjectStatus, type ProjectTaskStatus } from './professional-domain'

type Supabase = Awaited<ReturnType<typeof createClient>>

export type ProjectRow = { id: string; name: string; description: string | null; status: ProjectStatus; repository_url: string | null; started_on: string | null; due_on: string | null; updated_at: string }
export type MilestoneRow = { id: string; project_id: string; title: string; status: MilestoneStatus; due_on: string | null; completed_at: string | null }
export type ProjectTaskRow = { id: string; project_id: string; milestone_id: string | null; title: string; status: ProjectTaskStatus; priority: string; due_on: string | null }
export type CodingRow = { id: string; started_at: string; duration_minutes: number; project_id: string | null; notes: string | null }
export type ShippedRow = { id: string; title: string; description: string | null; project_id: string | null; shipped_at: string; week_start: string }
export type DsaRow = { id: string; practiced_at: string; problem: string; platform: string | null; difficulty: string | null; outcome: string; url: string | null; notes: string | null }

const PROJECT_SELECT = 'id,name,description,status,repository_url,started_on,due_on,updated_at'
export const PROFESSIONAL_WEEKS = 8

export async function getProfessionalData(supabase: Supabase, userId: string, today: string, timeZone: string) {
  const weeks = weekWindow(today, PROFESSIONAL_WEEKS)
  const since = new Date(Date.parse(`${weeks[0]}T00:00:00Z`) - 86_400_000).toISOString()
  const [projectResult, taskResult, codingResult, shippedResult, dsaResult] = await Promise.all([
    supabase.from('projects').select(PROJECT_SELECT).eq('user_id', userId).order('updated_at', { ascending: false }).limit(300),
    supabase.from('project_tasks').select('project_id,status').eq('user_id', userId).limit(10000),
    supabase.from('coding_sessions').select('id,started_at,duration_minutes,project_id,notes').eq('user_id', userId).gte('started_at', since).order('started_at', { ascending: false }).limit(3000),
    supabase.from('shipping_logs').select('id,title,description,project_id,shipped_at,week_start').eq('user_id', userId).order('shipped_at', { ascending: false }).limit(60),
    supabase.from('dsa_logs').select('id,practiced_at,problem,platform,difficulty,outcome,url,notes').eq('user_id', userId).order('practiced_at', { ascending: false }).limit(1000),
  ])
  const tasks = (taskResult.data ?? []) as Array<{ project_id: string; status: string }>
  const projects = ((projectResult.data ?? []) as ProjectRow[]).map((project) => ({ ...project, progress: projectProgress(tasks.filter((task) => task.project_id === project.id)) }))
  const coding = (codingResult.data ?? []) as CodingRow[]
  const dsa = (dsaResult.data ?? []) as DsaRow[]
  const local = (iso: string) => localDateKey(iso, timeZone)
  const monday = weekStartOf(today)
  const inWeek = (iso: string) => { const day = local(iso); return day >= monday && day <= today }
  const shipped = (shippedResult.data ?? []) as ShippedRow[]
  return {
    projects,
    projectName: new Map(projects.map((project) => [project.id, project.name])),
    weeks,
    codingSeries: sumByWeek(coding.map((session) => ({ date: local(session.started_at), value: session.duration_minutes })), weeks, today),
    recentCoding: coding.slice(0, 15),
    shipped: shipped.slice(0, 20),
    dsa: dsa.slice(0, 25),
    thisWeek: {
      codingMinutes: coding.filter((session) => inWeek(session.started_at)).reduce((sum, session) => sum + session.duration_minutes, 0),
      shipped: shipped.filter((item) => inWeek(item.shipped_at)).length,
      solved: dsa.filter((item) => item.outcome === 'solved' && inWeek(item.practiced_at)).length,
      practiced: dsa.filter((item) => inWeek(item.practiced_at)).length,
    },
    dsaTotals: { solved: dsa.filter((item) => item.outcome === 'solved').length, total: dsa.length },
    hasLoadError: Boolean(projectResult.error || taskResult.error || codingResult.error || shippedResult.error || dsaResult.error),
  }
}

export async function getOwnedProject(supabase: Supabase, userId: string, projectId: string): Promise<ProjectRow | null> {
  const { data, error } = await supabase.from('projects').select(PROJECT_SELECT).eq('id', projectId).eq('user_id', userId).maybeSingle()
  return error || !data ? null : (data as ProjectRow)
}

export async function getProjectDetail(supabase: Supabase, userId: string, projectId: string) {
  const project = await getOwnedProject(supabase, userId, projectId)
  if (!project) return null
  const [milestoneResult, taskResult, codingResult, shippedResult] = await Promise.all([
    supabase.from('project_milestones').select('id,project_id,title,status,due_on,completed_at').eq('user_id', userId).eq('project_id', projectId).order('due_on', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true }).limit(200),
    supabase.from('project_tasks').select('id,project_id,milestone_id,title,status,priority,due_on').eq('user_id', userId).eq('project_id', projectId).order('created_at', { ascending: true }).limit(1000),
    supabase.from('coding_sessions').select('id,started_at,duration_minutes,project_id,notes').eq('user_id', userId).eq('project_id', projectId).order('started_at', { ascending: false }).limit(500),
    supabase.from('shipping_logs').select('id,title,description,project_id,shipped_at,week_start').eq('user_id', userId).eq('project_id', projectId).order('shipped_at', { ascending: false }).limit(200),
  ])
  const tasks = (taskResult.data ?? []) as ProjectTaskRow[]
  const coding = (codingResult.data ?? []) as CodingRow[]
  return {
    project,
    milestones: (milestoneResult.data ?? []) as MilestoneRow[],
    tasks,
    progress: projectProgress(tasks),
    coding,
    codingMinutes: coding.reduce((sum, session) => sum + session.duration_minutes, 0),
    shipped: (shippedResult.data ?? []) as ShippedRow[],
    hasLoadError: Boolean(milestoneResult.error || taskResult.error || codingResult.error || shippedResult.error),
  }
}
