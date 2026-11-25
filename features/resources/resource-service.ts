import type { createClient } from '@/lib/supabase/server'
import type { ResourceFilters, ResourceOrigin, ResourceStatus, ResourceType } from './resource-domain'

type Supabase = Awaited<ReturnType<typeof createClient>>

const RESOURCE_SELECT = 'id,url,canonical_url,title,resource_type,origin,category,status,completed_at,notes,created_at,updated_at'

export type Resource = {
  id: string
  url: string
  canonical_url: string
  title: string
  resource_type: ResourceType
  origin: ResourceOrigin
  category: string | null
  status: ResourceStatus
  completed_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type QuestRef = { id: string; title: string }
export type ResourceListItem = Resource & { quests: QuestRef[] }
export type ResourceOption = { id: string; title: string; resource_type: ResourceType; status: ResourceStatus }

const LIST_LIMIT = 300

type ResourceRow = Resource & { quest_resources: Array<{ side_quests: QuestRef | null }> | null }

function withQuests(row: ResourceRow): ResourceListItem {
  const { quest_resources: links, ...resource } = row
  return { ...resource, quests: (links ?? []).map((link) => link.side_quests).filter((quest): quest is QuestRef => quest !== null) }
}

export type LibraryData = {
  resources: ResourceListItem[]
  quests: QuestRef[]
  counts: { saved: number; in_progress: number; completed: number; archived: number }
  truncated: boolean
  hasLoadError: boolean
}

export async function getLibraryData(supabase: Supabase, userId: string, filters: ResourceFilters): Promise<LibraryData> {
  const embed = filters.questId ? 'quest_resources!inner(side_quests(id,title))' : 'quest_resources(side_quests(id,title))'
  let request = supabase.from('learning_resources').select(`${RESOURCE_SELECT},${embed}`).eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(LIST_LIMIT)
  if (filters.status === 'active') request = request.in('status', ['saved', 'in_progress'])
  else if (filters.status !== 'all') request = request.eq('status', filters.status)
  if (filters.type !== 'all') request = request.eq('resource_type', filters.type)
  if (filters.questId) request = request.eq('quest_resources.quest_id', filters.questId)
  if (filters.query) request = request.textSearch('search_document', filters.query, { type: 'websearch', config: 'english' })

  const [listResult, questResult, countResult] = await Promise.all([
    request,
    supabase.from('side_quests').select('id,title').eq('user_id', userId).order('updated_at', { ascending: false }).limit(200),
    supabase.from('learning_resources').select('status').eq('user_id', userId),
  ])
  const counts = { saved: 0, in_progress: 0, completed: 0, archived: 0 }
  for (const row of (countResult.data ?? []) as Array<{ status: ResourceStatus }>) counts[row.status] += 1
  const rows = (listResult.data ?? []) as unknown as ResourceRow[]
  return {
    resources: rows.map(withQuests),
    quests: (questResult.data ?? []) as QuestRef[],
    counts,
    truncated: rows.length >= LIST_LIMIT,
    hasLoadError: Boolean(listResult.error || questResult.error || countResult.error),
  }
}

export async function getOwnedResource(supabase: Supabase, userId: string, resourceId: string): Promise<Resource | null> {
  const { data, error } = await supabase.from('learning_resources').select(RESOURCE_SELECT).eq('id', resourceId).eq('user_id', userId).maybeSingle()
  if (error || !data) return null
  return data as Resource
}

export async function findResourceByCanonical(supabase: Supabase, userId: string, canonical: string): Promise<{ id: string } | null> {
  const { data } = await supabase.from('learning_resources').select('id').eq('user_id', userId).eq('canonical_url', canonical).maybeSingle()
  return (data as { id: string } | null) ?? null
}

export type SourceRecord = { provider: string; source_url: string; source_title: string | null; first_seen_at: string; last_seen_at: string; sync_state: string }
export type ResourceSession = { id: string; started_at: string; duration_minutes: number; session_type: string; topic: string | null; quest_id: string | null }

export type ResourceDetailData = {
  resource: Resource
  quests: QuestRef[]
  questOptions: QuestRef[]
  sources: SourceRecord[]
  sessions: ResourceSession[]
  minutesAllTime: number
  hasLoadError: boolean
}

export async function getResourceDetailData(supabase: Supabase, userId: string, resourceId: string): Promise<ResourceDetailData | null> {
  const resource = await getOwnedResource(supabase, userId, resourceId)
  if (!resource) return null
  const [linkResult, questResult, sourceResult, sessionResult] = await Promise.all([
    supabase.from('quest_resources').select('side_quests(id,title)').eq('resource_id', resourceId).eq('user_id', userId),
    supabase.from('side_quests').select('id,title').eq('user_id', userId).order('updated_at', { ascending: false }).limit(200),
    supabase.from('resource_source_records').select('provider,source_url,source_title,first_seen_at,last_seen_at,sync_state')
      .eq('resource_id', resourceId).eq('user_id', userId).order('first_seen_at', { ascending: true }),
    supabase.from('active_learning_sessions').select('id,started_at,duration_minutes,session_type,topic,quest_id')
      .eq('resource_id', resourceId).eq('user_id', userId).order('started_at', { ascending: false }).limit(500),
  ])
  const quests = ((linkResult.data ?? []) as unknown as Array<{ side_quests: QuestRef | null }>).map((row) => row.side_quests).filter((q): q is QuestRef => q !== null)
  const linked = new Set(quests.map((quest) => quest.id))
  const sessions = (sessionResult.data ?? []) as ResourceSession[]
  return {
    resource,
    quests,
    questOptions: ((questResult.data ?? []) as QuestRef[]).filter((quest) => !linked.has(quest.id)),
    sources: (sourceResult.data ?? []) as SourceRecord[],
    sessions,
    minutesAllTime: sessions.reduce((total, s) => total + s.duration_minutes, 0),
    hasLoadError: Boolean(linkResult.error || questResult.error || sourceResult.error || sessionResult.error),
  }
}

export type QuestResourceData = { attached: ResourceOption[]; options: ResourceOption[] }

export async function getQuestResources(supabase: Supabase, userId: string, questId: string): Promise<QuestResourceData> {
  const [linkResult, allResult] = await Promise.all([
    supabase.from('quest_resources').select('position,added_at,learning_resources(id,title,resource_type,status)')
      .eq('quest_id', questId).eq('user_id', userId).order('position', { ascending: true }).order('added_at', { ascending: true }),
    supabase.from('learning_resources').select('id,title,resource_type,status').eq('user_id', userId)
      .neq('status', 'archived').order('created_at', { ascending: false }).limit(300),
  ])
  const attached = ((linkResult.data ?? []) as unknown as Array<{ learning_resources: ResourceOption | null }>)
    .map((row) => row.learning_resources).filter((r): r is ResourceOption => r !== null)
  const ids = new Set(attached.map((r) => r.id))
  return { attached, options: ((allResult.data ?? []) as ResourceOption[]).filter((r) => !ids.has(r.id)) }
}

/** Resources offered in the session form: not archived, newest first. */
export async function getResourceOptions(supabase: Supabase, userId: string): Promise<ResourceOption[]> {
  const { data } = await supabase.from('learning_resources').select('id,title,resource_type,status').eq('user_id', userId)
    .neq('status', 'archived').order('created_at', { ascending: false }).limit(300)
  return (data ?? []) as ResourceOption[]
}
