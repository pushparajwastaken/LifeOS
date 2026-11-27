import type { createClient } from '@/lib/supabase/server'
import { localDateKey } from '@/features/analytics/analytics-domain'
import { weekStartOf } from '@/features/pillars/pillar-domain'
import { averagePercent, isDue, type ErrorStatus, type SubjectColor, type TopicStatus } from './academic-domain'

type Supabase = Awaited<ReturnType<typeof createClient>>

export type SubjectRow = { id: string; name: string; color: SubjectColor; created_at: string }
export type TopicRow = { id: string; subject_id: string; name: string; status: TopicStatus }
export type RevisionRow = { id: string; subject_id: string; topic_id: string | null; title: string; next_review_at: string | null; interval_days: number; ease_factor: number; status: 'active' | 'suspended' | 'mastered' }
export type AssessmentRow = { id: string; subject_id: string; title: string; assessed_on: string; score: number; max_score: number; question_count: number | null; notes: string | null }
export type ErrorRow = { id: string; subject_id: string; topic_id: string | null; assessment_id: string | null; prompt: string; correction: string | null; status: ErrorStatus; created_at: string }

const REVISION_SELECT = 'id,subject_id,topic_id,title,next_review_at,interval_days,ease_factor,status'
const ASSESSMENT_SELECT = 'id,subject_id,title,assessed_on,score,max_score,question_count,notes'
const normalizeAssessment = (row: AssessmentRow): AssessmentRow => ({ ...row, score: Number(row.score), max_score: Number(row.max_score) })
const normalizeRevision = (row: RevisionRow): RevisionRow => ({ ...row, ease_factor: Number(row.ease_factor) })

/** Minutes of learning sessions on the Academic pillar this week (standalone sessions or academic quests). */
async function academicMinutesThisWeek(supabase: Supabase, userId: string, today: string, timeZone: string) {
  const monday = weekStartOf(today)
  const since = `${monday}T00:00:00Z`
  const [sessions, quests] = await Promise.all([
    supabase.from('active_learning_sessions').select('pillar,quest_id,started_at,duration_minutes').eq('user_id', userId).gte('started_at', new Date(Date.parse(since) - 86_400_000).toISOString()).limit(2000),
    supabase.from('side_quests').select('id').eq('user_id', userId).eq('pillar', 'academic').limit(500),
  ])
  const academicQuests = new Set(((quests.data ?? []) as Array<{ id: string }>).map((quest) => quest.id))
  const rows = (sessions.data ?? []) as Array<{ pillar: string | null; quest_id: string | null; started_at: string; duration_minutes: number }>
  const minutes = rows.filter((row) => {
    const day = localDateKey(row.started_at, timeZone)
    return day >= monday && day <= today && (row.pillar === 'academic' || (row.quest_id !== null && academicQuests.has(row.quest_id)))
  }).reduce((sum, row) => sum + row.duration_minutes, 0)
  return { minutes, error: Boolean(sessions.error || quests.error) }
}

export async function getAcademicOverview(supabase: Supabase, userId: string, today: string, timeZone: string) {
  const now = new Date()
  const [subjectResult, topicResult, revisionResult, assessmentResult, errorResult, study] = await Promise.all([
    supabase.from('subjects').select('id,name,color,created_at').eq('user_id', userId).order('name', { ascending: true }).limit(200),
    supabase.from('subject_topics').select('id,subject_id,name,status').eq('user_id', userId).limit(5000),
    supabase.from('revision_items').select(REVISION_SELECT).eq('user_id', userId).eq('status', 'active').order('next_review_at', { ascending: true, nullsFirst: true }).limit(2000),
    supabase.from('assessments').select(ASSESSMENT_SELECT).eq('user_id', userId).order('assessed_on', { ascending: false }).limit(500),
    supabase.from('error_log_items').select('id,subject_id,status').eq('user_id', userId).neq('status', 'resolved').limit(2000),
    academicMinutesThisWeek(supabase, userId, today, timeZone),
  ])
  const subjects = (subjectResult.data ?? []) as SubjectRow[]
  const topics = (topicResult.data ?? []) as TopicRow[]
  const revisions = ((revisionResult.data ?? []) as RevisionRow[]).map(normalizeRevision)
  const assessments = ((assessmentResult.data ?? []) as AssessmentRow[]).map(normalizeAssessment)
  const openErrors = (errorResult.data ?? []) as Array<{ id: string; subject_id: string }>
  const due = revisions.filter((item) => isDue(item, now))
  const subjectName = new Map(subjects.map((subject) => [subject.id, subject.name]))
  const cutoff = new Date(Date.parse(`${today}T00:00:00Z`) - 30 * 86_400_000).toISOString().slice(0, 10)
  return {
    subjects: subjects.map((subject) => {
      const own = topics.filter((topic) => topic.subject_id === subject.id)
      const ownAssessments = assessments.filter((item) => item.subject_id === subject.id)
      return {
        ...subject,
        topicCount: own.length,
        mastered: own.filter((topic) => topic.status === 'mastered').length,
        due: due.filter((item) => item.subject_id === subject.id).length,
        openErrors: openErrors.filter((item) => item.subject_id === subject.id).length,
        average: averagePercent(ownAssessments),
        lastAssessment: ownAssessments[0] ?? null,
      }
    }),
    due: due.slice(0, 30).map((item) => ({ ...item, subjectName: subjectName.get(item.subject_id) ?? 'Subject' })),
    dueCount: due.length,
    minutesThisWeek: study.minutes,
    recentAverage: averagePercent(assessments.filter((item) => item.assessed_on >= cutoff)),
    recentAssessments: assessments.slice(0, 6).map((item) => ({ ...item, subjectName: subjectName.get(item.subject_id) ?? 'Subject' })),
    openErrorCount: openErrors.length,
    hasLoadError: Boolean(subjectResult.error || topicResult.error || revisionResult.error || assessmentResult.error || errorResult.error || study.error),
  }
}

export async function getOwnedSubject(supabase: Supabase, userId: string, subjectId: string): Promise<SubjectRow | null> {
  const { data, error } = await supabase.from('subjects').select('id,name,color,created_at').eq('id', subjectId).eq('user_id', userId).maybeSingle()
  return error || !data ? null : (data as SubjectRow)
}

export async function getSubjectDetail(supabase: Supabase, userId: string, subjectId: string) {
  const subject = await getOwnedSubject(supabase, userId, subjectId)
  if (!subject) return null
  const [topicResult, revisionResult, assessmentResult, errorResult] = await Promise.all([
    supabase.from('subject_topics').select('id,subject_id,name,status').eq('user_id', userId).eq('subject_id', subjectId).order('created_at', { ascending: true }).limit(500),
    supabase.from('revision_items').select(REVISION_SELECT).eq('user_id', userId).eq('subject_id', subjectId).order('next_review_at', { ascending: true, nullsFirst: true }).limit(1000),
    supabase.from('assessments').select(ASSESSMENT_SELECT).eq('user_id', userId).eq('subject_id', subjectId).order('assessed_on', { ascending: false }).limit(500),
    supabase.from('error_log_items').select('id,subject_id,topic_id,assessment_id,prompt,correction,status,created_at').eq('user_id', userId).eq('subject_id', subjectId).order('created_at', { ascending: false }).limit(500),
  ])
  const assessments = ((assessmentResult.data ?? []) as AssessmentRow[]).map(normalizeAssessment)
  return {
    subject,
    topics: (topicResult.data ?? []) as TopicRow[],
    revisions: ((revisionResult.data ?? []) as RevisionRow[]).map(normalizeRevision),
    assessments,
    average: averagePercent(assessments),
    errors: (errorResult.data ?? []) as ErrorRow[],
    hasLoadError: Boolean(topicResult.error || revisionResult.error || assessmentResult.error || errorResult.error),
  }
}
