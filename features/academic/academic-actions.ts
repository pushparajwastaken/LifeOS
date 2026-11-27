'use server'

import { uuidSchema } from '@/features/quests/quest-domain'
import { field, finish, pillarSession, requireId } from '@/features/pillars/pillar-actions-kit'
import {
  ERROR_STATUSES,
  REVISION_GRADES,
  TOPIC_STATUSES,
  assessmentInputSchema,
  errorInputSchema,
  revisionInputSchema,
  scheduleReview,
  subjectInputSchema,
  topicInputSchema,
  type ErrorStatus,
  type RevisionGrade,
  type TopicStatus,
} from './academic-domain'
import { getOwnedSubject } from './academic-service'

const HOME = '/academic'

async function ownedSubject(formData: FormData) {
  const subjectId = requireId(formData, 'subjectId', HOME)
  const session = await pillarSession()
  const subject = await getOwnedSubject(session.supabase, session.userId, subjectId)
  if (!subject) finish(HOME, 'record-not-found')
  return { ...session, subject, path: `${HOME}/${subject.id}` }
}

/** An optional topic id from the form that must belong to the subject; undefined means "invalid". */
async function optionalTopic(formData: FormData, supabase: Awaited<ReturnType<typeof pillarSession>>['supabase'], userId: string, subjectId: string): Promise<string | null | undefined> {
  const raw = field(formData, 'topicId')
  if (!raw) return null
  const parsed = uuidSchema.safeParse(raw)
  if (!parsed.success) return undefined
  const { data } = await supabase.from('subject_topics').select('id').eq('id', parsed.data).eq('subject_id', subjectId).eq('user_id', userId).maybeSingle()
  return data ? parsed.data : undefined
}

export async function createSubjectAction(formData: FormData): Promise<void> {
  const parsed = subjectInputSchema.safeParse({ name: field(formData, 'name'), color: field(formData, 'color') || 'sage' })
  if (!parsed.success) finish(HOME, 'subject-invalid', '#add-subject')
  const { supabase, userId } = await pillarSession()
  const { data, error } = await supabase.from('subjects').insert({ user_id: userId, name: parsed.data.name, color: parsed.data.color }).select('id').single()
  if (error?.code === '23505') finish(HOME, 'subject-duplicate', '#add-subject')
  if (error || !data) finish(HOME, 'save-failed')
  finish(`${HOME}/${data.id}`, 'subject-added')
}

export async function updateSubjectAction(formData: FormData): Promise<void> {
  const { supabase, userId, subject, path } = await ownedSubject(formData)
  const parsed = subjectInputSchema.safeParse({ name: field(formData, 'name'), color: field(formData, 'color') || subject.color })
  if (!parsed.success) finish(path, 'subject-invalid')
  const { error } = await supabase.from('subjects').update({ name: parsed.data.name, color: parsed.data.color }).eq('id', subject.id).eq('user_id', userId)
  finish(path, error?.code === '23505' ? 'subject-duplicate' : error ? 'save-failed' : 'subject-updated')
}

export async function deleteSubjectAction(formData: FormData): Promise<void> {
  const { supabase, userId, subject, path } = await ownedSubject(formData)
  if (field(formData, 'confirm') !== 'delete') finish(path, 'delete-confirm', '#delete')
  const { error } = await supabase.from('subjects').delete().eq('id', subject.id).eq('user_id', userId)
  finish(error ? path : HOME, error ? 'save-failed' : 'subject-deleted')
}

export async function addTopicAction(formData: FormData): Promise<void> {
  const { supabase, userId, subject, path } = await ownedSubject(formData)
  const parsed = topicInputSchema.safeParse({ name: field(formData, 'name'), status: field(formData, 'status') || 'planned' })
  if (!parsed.success) finish(path, 'topic-invalid', '#topics')
  const { error } = await supabase.from('subject_topics').insert({ user_id: userId, subject_id: subject.id, name: parsed.data.name, status: parsed.data.status })
  finish(path, error?.code === '23505' ? 'topic-duplicate' : error ? 'save-failed' : 'topic-added', '#topics')
}

export async function setTopicStatusAction(formData: FormData): Promise<void> {
  const { supabase, userId, subject, path } = await ownedSubject(formData)
  const topicId = requireId(formData, 'topicId', path)
  const status = field(formData, 'status') as TopicStatus
  if (!(TOPIC_STATUSES as readonly string[]).includes(status)) finish(path, 'record-not-found')
  const { error } = await supabase.from('subject_topics').update({ status }).eq('id', topicId).eq('subject_id', subject.id).eq('user_id', userId)
  finish(path, error ? 'save-failed' : 'topic-updated', '#topics')
}

export async function deleteTopicAction(formData: FormData): Promise<void> {
  const { supabase, userId, subject, path } = await ownedSubject(formData)
  const topicId = requireId(formData, 'topicId', path)
  const { error } = await supabase.from('subject_topics').delete().eq('id', topicId).eq('subject_id', subject.id).eq('user_id', userId)
  finish(path, error ? 'save-failed' : 'topic-deleted', '#topics')
}

export async function addRevisionAction(formData: FormData): Promise<void> {
  const { supabase, userId, subject, path } = await ownedSubject(formData)
  const parsed = revisionInputSchema.safeParse({ title: field(formData, 'title') })
  const topicId = await optionalTopic(formData, supabase, userId, subject.id)
  if (!parsed.success || topicId === undefined) finish(path, 'revision-invalid', '#revision')
  const { error } = await supabase.from('revision_items').insert({ user_id: userId, subject_id: subject.id, topic_id: topicId, title: parsed.data.title, next_review_at: new Date().toISOString() })
  finish(path, error ? 'save-failed' : 'revision-added', '#revision')
}

/** Grades a due card and schedules the next review. Works from the overview (returnTo=list) and the subject page. */
export async function reviewRevisionAction(formData: FormData): Promise<void> {
  const fromList = field(formData, 'returnTo') === 'list'
  const itemId = requireId(formData, 'itemId', HOME)
  const grade = field(formData, 'grade') as RevisionGrade
  const { supabase, userId } = await pillarSession()
  const { data: item } = await supabase.from('revision_items').select('id,subject_id,interval_days,ease_factor,next_review_at').eq('id', itemId).eq('user_id', userId).maybeSingle()
  if (!item || !(REVISION_GRADES as readonly string[]).includes(grade)) finish(HOME, 'record-not-found')
  const back = fromList ? HOME : `${HOME}/${item.subject_id}`
  const next = scheduleReview({ interval_days: item.interval_days, ease_factor: Number(item.ease_factor) }, grade, new Date())
  // Guarded on the review time read above, so a double click schedules once.
  let update = supabase.from('revision_items').update(next).eq('id', item.id).eq('user_id', userId)
  update = item.next_review_at ? update.eq('next_review_at', item.next_review_at) : update.is('next_review_at', null)
  const { error } = await update
  finish(back, error ? 'save-failed' : 'revision-reviewed', fromList ? '#due' : '#revision')
}

export async function setRevisionStatusAction(formData: FormData): Promise<void> {
  const { supabase, userId, subject, path } = await ownedSubject(formData)
  const itemId = requireId(formData, 'itemId', path)
  const status = field(formData, 'status')
  if (!['active', 'suspended', 'mastered'].includes(status)) finish(path, 'record-not-found')
  const { error } = await supabase.from('revision_items').update({ status, ...(status === 'active' ? { next_review_at: new Date().toISOString() } : {}) }).eq('id', itemId).eq('subject_id', subject.id).eq('user_id', userId)
  finish(path, error ? 'save-failed' : 'revision-updated', '#revision')
}

export async function deleteRevisionAction(formData: FormData): Promise<void> {
  const { supabase, userId, subject, path } = await ownedSubject(formData)
  const itemId = requireId(formData, 'itemId', path)
  const { error } = await supabase.from('revision_items').delete().eq('id', itemId).eq('subject_id', subject.id).eq('user_id', userId)
  finish(path, error ? 'save-failed' : 'revision-deleted', '#revision')
}

export async function addAssessmentAction(formData: FormData): Promise<void> {
  const { supabase, userId, subject, path, today } = await ownedSubject(formData)
  const parsed = assessmentInputSchema.safeParse({ title: field(formData, 'title'), date: field(formData, 'date') || today, score: field(formData, 'score'), maxScore: field(formData, 'maxScore'), questions: field(formData, 'questions'), notes: field(formData, 'notes') })
  if (!parsed.success || parsed.data.date > today) finish(path, 'assessment-invalid', '#assessments')
  const { error } = await supabase.from('assessments').insert({ user_id: userId, subject_id: subject.id, title: parsed.data.title, assessed_on: parsed.data.date, score: parsed.data.score, max_score: parsed.data.maxScore, question_count: parsed.data.questions, notes: parsed.data.notes })
  finish(path, error ? 'save-failed' : 'assessment-added', '#assessments')
}

export async function deleteAssessmentAction(formData: FormData): Promise<void> {
  const { supabase, userId, subject, path } = await ownedSubject(formData)
  const assessmentId = requireId(formData, 'assessmentId', path)
  const { error } = await supabase.from('assessments').delete().eq('id', assessmentId).eq('subject_id', subject.id).eq('user_id', userId)
  finish(path, error ? 'save-failed' : 'assessment-deleted', '#assessments')
}

export async function addErrorAction(formData: FormData): Promise<void> {
  const { supabase, userId, subject, path } = await ownedSubject(formData)
  const parsed = errorInputSchema.safeParse({ prompt: field(formData, 'prompt'), correction: field(formData, 'correction') })
  const topicId = await optionalTopic(formData, supabase, userId, subject.id)
  if (!parsed.success || topicId === undefined) finish(path, 'error-invalid', '#errors')
  const { error } = await supabase.from('error_log_items').insert({ user_id: userId, subject_id: subject.id, topic_id: topicId, prompt: parsed.data.prompt, correction: parsed.data.correction })
  finish(path, error ? 'save-failed' : 'error-added', '#errors')
}

export async function setErrorStatusAction(formData: FormData): Promise<void> {
  const { supabase, userId, subject, path } = await ownedSubject(formData)
  const itemId = requireId(formData, 'itemId', path)
  const status = field(formData, 'status') as ErrorStatus
  if (!(ERROR_STATUSES as readonly string[]).includes(status)) finish(path, 'record-not-found')
  const { error } = await supabase.from('error_log_items').update({ status }).eq('id', itemId).eq('subject_id', subject.id).eq('user_id', userId)
  finish(path, error ? 'save-failed' : 'error-updated', '#errors')
}

export async function deleteErrorAction(formData: FormData): Promise<void> {
  const { supabase, userId, subject, path } = await ownedSubject(formData)
  const itemId = requireId(formData, 'itemId', path)
  const { error } = await supabase.from('error_log_items').delete().eq('id', itemId).eq('subject_id', subject.id).eq('user_id', userId)
  finish(path, error ? 'save-failed' : 'error-deleted', '#errors')
}
