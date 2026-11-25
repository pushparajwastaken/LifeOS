// Two-user RLS integration test for the M1 Side Quests tables.
// Runs only against the staging project, using real Supabase Auth password sessions.
// Required env (never commit values): LIFEOS_TEST_SUPABASE_URL, LIFEOS_TEST_SUPABASE_ANON_KEY,
// LIFEOS_TEST_USER_A_EMAIL, LIFEOS_TEST_USER_A_PASSWORD, LIFEOS_TEST_USER_B_EMAIL, LIFEOS_TEST_USER_B_PASSWORD,
// LIFEOS_PRODUCTION_PROJECT_REF (used only to refuse running against production).
// See docs/TESTING.md for creating and removing the disposable test users.
import assert from 'node:assert/strict'
import test from 'node:test'

const env = process.env
const URL_BASE = env.LIFEOS_TEST_SUPABASE_URL
const KEY = env.LIFEOS_TEST_SUPABASE_ANON_KEY
const PROD_REF = env.LIFEOS_PRODUCTION_PROJECT_REF
const configured = Boolean(URL_BASE && KEY && PROD_REF && env.LIFEOS_TEST_USER_A_EMAIL && env.LIFEOS_TEST_USER_B_EMAIL)
const skip = !configured ? 'staging test environment variables are not set' : false

if (configured && URL_BASE.includes(PROD_REF)) {
  throw new Error('Refusing to run RLS integration tests against the production project')
}

async function signIn(email, password) {
  const response = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const body = await response.json()
  assert.ok(response.ok, `sign-in failed for ${email}`)
  return { token: body.access_token, id: body.user.id }
}

async function rest(session, method, path, body) {
  const headers = { apikey: KEY, 'content-type': 'application/json', Prefer: 'return=representation' }
  if (session) headers.authorization = `Bearer ${session.token}`
  const response = await fetch(`${URL_BASE}/rest/v1/${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await response.text()
  const json = text ? JSON.parse(text) : null
  return { status: response.status, body: json, code: json && !Array.isArray(json) ? json.code : undefined }
}

const empty = (r) => r.status >= 200 && r.status < 300 && Array.isArray(r.body) && r.body.length === 0

test('side quests enforce owner isolation for two real users', { skip }, async (t) => {
  const A = await signIn(env.LIFEOS_TEST_USER_A_EMAIL, env.LIFEOS_TEST_USER_A_PASSWORD)
  const B = await signIn(env.LIFEOS_TEST_USER_B_EMAIL, env.LIFEOS_TEST_USER_B_PASSWORD)
  const created = { quests: [], notes: [] }

  t.after(async () => {
    for (const id of created.quests) await rest(id.owner, 'DELETE', `side_quests?id=eq.${id.id}`)
    for (const id of created.notes) await rest(id.owner, 'DELETE', `knowledge_notes?id=eq.${id.id}`)
  })

  const quest = async (owner, title, extra = {}) => {
    const r = await rest(owner, 'POST', 'side_quests', { user_id: owner.id, title, ...extra })
    assert.equal(r.status, 201, `create quest ${title}: ${r.code}`)
    created.quests.push({ owner, id: r.body[0].id })
    return r.body[0]
  }
  const note = async (owner, title) => {
    const r = await rest(owner, 'POST', 'knowledge_notes', { user_id: owner.id, title, note_type: 'research' })
    assert.equal(r.status, 201)
    created.notes.push({ owner, id: r.body[0].id })
    return r.body[0]
  }

  const QA = await quest(A, 'QA quest A', { structure: 'structured' })
  const QB = await quest(B, 'QA quest B')
  const NA = await note(A, 'QA note A')
  const NB = await note(B, 'QA note B')
  let r = await rest(A, 'POST', 'quest_objectives', { user_id: A.id, quest_id: QA.id, title: 'Objective A' })
  assert.equal(r.status, 201)
  const OA = r.body[0]
  r = await rest(A, 'POST', 'quest_milestones', { user_id: A.id, quest_id: QA.id, title: 'Milestone A' })
  assert.equal(r.status, 201)
  const MA = r.body[0]
  r = await rest(A, 'POST', 'quest_notes', { user_id: A.id, quest_id: QA.id, note_id: NA.id })
  assert.equal(r.status, 201, 'A links own note to own quest')

  // Reads (R1-R3)
  for (const [table, id] of [['side_quests', QA.id], ['quest_objectives', OA.id], ['quest_milestones', MA.id]]) {
    assert.ok(empty(await rest(B, 'GET', `${table}?id=eq.${id}`)), `B cannot read A's ${table}`)
  }
  assert.ok(empty(await rest(B, 'GET', `quest_notes?quest_id=eq.${QA.id}`)), "B cannot read A's quest links")
  assert.ok(empty(await rest(B, 'GET', `knowledge_notes?id=eq.${NA.id}`)), "B cannot read A's note")
  r = await rest(null, 'GET', 'side_quests?select=id')
  assert.equal(r.code, '42501', 'anonymous access is denied')

  // Updates (U1-U3)
  assert.ok(empty(await rest(B, 'PATCH', `side_quests?id=eq.${QA.id}`, { title: 'hijacked' })))
  assert.ok(empty(await rest(B, 'PATCH', `quest_objectives?id=eq.${OA.id}`, { title: 'hijacked' })))
  assert.ok(empty(await rest(B, 'PATCH', `quest_milestones?id=eq.${MA.id}`, { title: 'hijacked' })))
  r = await rest(A, 'GET', `side_quests?id=eq.${QA.id}&select=title`)
  assert.equal(r.body[0].title, 'QA quest A')
  r = await rest(B, 'PATCH', `side_quests?id=eq.${QB.id}`, { user_id: A.id })
  assert.equal(r.code, '42501', 'B cannot hand a quest to A')
  r = await rest(A, 'PATCH', `quest_objectives?id=eq.${OA.id}`, { quest_id: QB.id })
  assert.equal(r.code, '23503', "A cannot move an objective under B's quest")
  r = await rest(A, 'PATCH', `quest_notes?quest_id=eq.${QA.id}&note_id=eq.${NA.id}`, { note_id: NA.id })
  assert.ok(r.status >= 400, 'link rows are not updatable')

  // Deletes (D1)
  assert.ok(empty(await rest(B, 'DELETE', `side_quests?id=eq.${QA.id}`)))
  assert.ok(empty(await rest(B, 'DELETE', `quest_notes?quest_id=eq.${QA.id}`)))
  r = await rest(A, 'GET', `quest_notes?quest_id=eq.${QA.id}`)
  assert.equal(r.body.length, 1, "A's link survives B's delete attempt")

  // Inserts (I1-I3)
  r = await rest(B, 'POST', 'side_quests', { user_id: A.id, title: 'spoof' })
  assert.equal(r.code, '42501')
  r = await rest(B, 'POST', 'quest_objectives', { user_id: B.id, quest_id: QA.id, title: 'spoof' })
  assert.equal(r.code, '23503')
  r = await rest(B, 'POST', 'quest_milestones', { user_id: A.id, quest_id: QA.id, title: 'spoof' })
  assert.equal(r.code, '42501')

  // Note links (L1-L5)
  r = await rest(B, 'POST', 'quest_notes', { user_id: B.id, quest_id: QB.id, note_id: NA.id })
  assert.equal(r.code, '23503', "B cannot link A's note")
  r = await rest(B, 'POST', 'quest_notes', { user_id: A.id, quest_id: QB.id, note_id: NA.id })
  assert.equal(r.code, '42501')
  r = await rest(B, 'POST', 'quest_notes', { user_id: B.id, quest_id: QA.id, note_id: NB.id })
  assert.equal(r.code, '23503', "B cannot attach to A's quest")
  r = await rest(B, 'POST', 'quest_notes', { user_id: B.id, quest_id: QB.id, note_id: NB.id })
  assert.equal(r.status, 201, 'positive control')
  r = await rest(A, 'POST', 'quest_notes', { user_id: A.id, quest_id: QA.id, note_id: NA.id })
  assert.equal(r.code, '23505', 'duplicate link rejected')

  // Constraints
  r = await rest(A, 'POST', 'side_quests', { user_id: A.id, title: '   ' })
  assert.equal(r.code, '23514', 'blank title rejected')
  r = await rest(A, 'POST', 'side_quests', { user_id: A.id, title: 'paused without start', status: 'paused' })
  assert.equal(r.code, '23514', 'paused quest needs started_at')
  r = await rest(A, 'POST', 'side_quests', { user_id: A.id, title: 'bad structure', structure: 'freeform' })
  assert.equal(r.code, '23514')

  // Deleting a quest preserves notes (X1-X2)
  r = await rest(A, 'DELETE', `side_quests?id=eq.${QA.id}`)
  assert.equal(r.body.length, 1)
  created.quests = created.quests.filter((q) => q.id !== QA.id)
  assert.ok(empty(await rest(A, 'GET', `quest_objectives?id=eq.${OA.id}`)), 'objectives cascade')
  assert.ok(empty(await rest(A, 'GET', `quest_milestones?id=eq.${MA.id}`)), 'milestones cascade')
  assert.ok(empty(await rest(A, 'GET', `quest_notes?note_id=eq.${NA.id}`)), 'links cascade')
  r = await rest(A, 'GET', `knowledge_notes?id=eq.${NA.id}&select=id`)
  assert.equal(r.body.length, 1, 'the note itself is preserved')
  r = await rest(B, 'GET', `quest_notes?quest_id=eq.${QB.id}`)
  assert.equal(r.body.length, 1, "B's data unaffected")
})
