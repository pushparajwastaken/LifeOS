// Two-user integration test for M2 learning sessions (staging only, real Supabase Auth sessions).
// Same environment variables as tests/integration/side-quests-rls.test.mjs; see docs/TESTING.md.
import assert from 'node:assert/strict'
import test from 'node:test'

const env = process.env
const URL_BASE = env.LIFEOS_TEST_SUPABASE_URL
const KEY = env.LIFEOS_TEST_SUPABASE_ANON_KEY
const PROD_REF = env.LIFEOS_PRODUCTION_PROJECT_REF
const configured = Boolean(URL_BASE && KEY && PROD_REF && env.LIFEOS_TEST_USER_A_EMAIL && env.LIFEOS_TEST_USER_B_EMAIL)
if (configured && URL_BASE.includes(PROD_REF)) throw new Error('Refusing to run against the production project')

async function signIn(email, password) {
  const r = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: KEY, 'content-type': 'application/json' }, body: JSON.stringify({ email, password }),
  })
  const body = await r.json()
  assert.ok(r.ok, `sign-in failed for ${email}`)
  return { token: body.access_token, id: body.user.id }
}

async function rest(session, method, path, body) {
  const headers = { apikey: KEY, 'content-type': 'application/json', Prefer: 'return=representation' }
  if (session) headers.authorization = `Bearer ${session.token}`
  const r = await fetch(`${URL_BASE}/rest/v1/${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await r.text()
  const json = text ? JSON.parse(text) : null
  return { status: r.status, body: json, code: json && !Array.isArray(json) ? json.code : undefined }
}

const empty = (r) => r.status >= 200 && r.status < 300 && Array.isArray(r.body) && r.body.length === 0

test('learning sessions: isolation, soft delete, restore and quest deletion', { skip: configured ? false : 'staging test environment variables are not set' }, async (t) => {
  const A = await signIn(env.LIFEOS_TEST_USER_A_EMAIL, env.LIFEOS_TEST_USER_A_PASSWORD)
  const B = await signIn(env.LIFEOS_TEST_USER_B_EMAIL, env.LIFEOS_TEST_USER_B_PASSWORD)
  const cleanup = []
  t.after(async () => { for (const [owner, path] of cleanup.reverse()) await rest(owner, 'DELETE', path) })

  const now = new Date().toISOString()
  let r = await rest(A, 'POST', 'side_quests', { user_id: A.id, title: 'QA sessions quest', status: 'active', started_at: now })
  assert.equal(r.status, 201)
  const QA = r.body[0]
  cleanup.push([A, `side_quests?id=eq.${QA.id}`])
  r = await rest(B, 'POST', 'side_quests', { user_id: B.id, title: 'QA B quest' })
  const QB = r.body[0]
  cleanup.push([B, `side_quests?id=eq.${QB.id}`])

  // Create: quest-linked (no topic) and standalone (topic required)
  r = await rest(A, 'POST', 'learning_sessions', { user_id: A.id, quest_id: QA.id, started_at: now, duration_minutes: 40, session_type: 'study' })
  assert.equal(r.status, 201, `quest session: ${r.code}`)
  const S1 = r.body[0]
  cleanup.push([A, `learning_sessions?id=eq.${S1.id}`])
  r = await rest(A, 'POST', 'learning_sessions', { user_id: A.id, topic: 'Standalone reading', pillar: 'intellectual', started_at: now, duration_minutes: 25, session_type: 'read' })
  assert.equal(r.status, 201)
  const S2 = r.body[0]
  cleanup.push([A, `learning_sessions?id=eq.${S2.id}`])
  r = await rest(A, 'POST', 'learning_sessions', { user_id: A.id, started_at: now, duration_minutes: 25 })
  assert.equal(r.code, '23514', 'standalone without topic rejected')
  r = await rest(A, 'POST', 'learning_sessions', { user_id: A.id, topic: 'x', started_at: now, duration_minutes: 1441 })
  assert.equal(r.code, '23514', 'over 1440 minutes rejected')
  r = await rest(A, 'POST', 'learning_sessions', { user_id: A.id, topic: 'x', started_at: now, duration_minutes: 10, deleted_at: now })
  assert.equal(r.body[0].deleted_at, null, 'inserts always start active')
  cleanup.push([A, `learning_sessions?id=eq.${r.body[0].id}`])

  // Isolation
  assert.ok(empty(await rest(B, 'GET', `learning_sessions?id=eq.${S1.id}`)))
  assert.ok(empty(await rest(B, 'GET', `active_learning_sessions?id=eq.${S1.id}`)), 'view keeps RLS')
  assert.ok(empty(await rest(B, 'PATCH', `learning_sessions?id=eq.${S1.id}`, { duration_minutes: 999 })))
  assert.ok(empty(await rest(B, 'DELETE', `learning_sessions?id=eq.${S1.id}`)))
  r = await rest(B, 'POST', 'learning_sessions', { user_id: A.id, topic: 'spoof', started_at: now, duration_minutes: 5 })
  assert.equal(r.code, '42501')
  r = await rest(B, 'POST', 'learning_sessions', { user_id: B.id, quest_id: QA.id, started_at: now, duration_minutes: 5 })
  assert.equal(r.code, '23503', "B cannot log against A's quest")
  r = await rest(null, 'GET', 'active_learning_sessions?select=id')
  assert.equal(r.code, '42501', 'anonymous denied')
  r = await rest(A, 'GET', `learning_sessions?id=eq.${S1.id}&select=duration_minutes`)
  assert.equal(r.body[0].duration_minutes, 40)

  // Soft delete: the database stamps its own time; the view hides the row
  r = await rest(A, 'PATCH', `learning_sessions?id=eq.${S2.id}`, { deleted_at: '2000-01-01T00:00:00Z' })
  assert.equal(r.status, 200)
  assert.ok(Date.now() - new Date(r.body[0].deleted_at).getTime() < 120000, 'deleted_at is the database now()')
  assert.ok(empty(await rest(A, 'GET', `active_learning_sessions?id=eq.${S2.id}`)))
  r = await rest(A, 'PATCH', `learning_sessions?id=eq.${S2.id}`, { duration_minutes: 99 })
  assert.equal(r.code, 'P0001', 'deleted sessions cannot be edited')
  r = await rest(A, 'PATCH', `learning_sessions?id=eq.${S2.id}`, { deleted_at: null })
  assert.equal(r.body[0].deleted_at, null, 'restore within the window')
  r = await rest(A, 'GET', `active_learning_sessions?id=eq.${S2.id}&select=id`)
  assert.equal(r.body.length, 1)

  // Quest deletion keeps learning history
  r = await rest(A, 'DELETE', `side_quests?id=eq.${QA.id}`)
  assert.equal(r.body.length, 1)
  r = await rest(A, 'GET', `learning_sessions?id=eq.${S1.id}&select=quest_id,topic,duration_minutes`)
  assert.deepEqual(r.body[0], { quest_id: null, topic: 'QA sessions quest', duration_minutes: 40 })
})
