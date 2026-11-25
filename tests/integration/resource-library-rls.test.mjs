// Two-user integration test for the M3 Resource Library (staging only, real Supabase Auth sessions).
// Same environment variables as the other integration tests; see docs/TESTING.md.
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
const resourceBody = (owner, canonical, extra = {}) => ({ user_id: owner.id, url: canonical, canonical_url: canonical, title: 'QA resource', ...extra })

test('resource library: dedup, isolation, provenance and session links', { skip: configured ? false : 'staging test environment variables are not set' }, async (t) => {
  const A = await signIn(env.LIFEOS_TEST_USER_A_EMAIL, env.LIFEOS_TEST_USER_A_PASSWORD)
  const B = await signIn(env.LIFEOS_TEST_USER_B_EMAIL, env.LIFEOS_TEST_USER_B_PASSWORD)
  const cleanup = []
  t.after(async () => { for (const [owner, path] of cleanup.reverse()) await rest(owner, 'DELETE', path) })

  let r = await rest(A, 'POST', 'learning_resources', resourceBody(A, 'https://example.com/qa-guide'))
  assert.equal(r.status, 201, `create: ${r.code}`)
  const RA = r.body[0]
  cleanup.push([A, `learning_resources?id=eq.${RA.id}`])
  assert.equal(RA.origin, 'manual')

  r = await rest(A, 'POST', 'learning_resources', resourceBody(A, 'https://example.com/qa-guide', { url: 'http://www.example.com/qa-guide/' }))
  assert.equal(r.code, '23505', 'same canonical URL twice for one user is rejected')
  r = await rest(B, 'POST', 'learning_resources', resourceBody(B, 'https://example.com/qa-guide'))
  assert.equal(r.status, 201, 'another user may save the same URL')
  const RB = r.body[0]
  cleanup.push([B, `learning_resources?id=eq.${RB.id}`])
  r = await rest(A, 'POST', 'learning_resources', resourceBody(A, 'https://example.com/x', { url: 'javascript:alert(1)' }))
  assert.equal(r.code, '23514', 'non-http URL rejected')

  // Isolation
  assert.ok(empty(await rest(B, 'GET', `learning_resources?id=eq.${RA.id}`)))
  assert.ok(empty(await rest(B, 'PATCH', `learning_resources?id=eq.${RA.id}`, { title: 'hijacked' })))
  assert.ok(empty(await rest(B, 'DELETE', `learning_resources?id=eq.${RA.id}`)))
  r = await rest(B, 'POST', 'learning_resources', resourceBody(A, 'https://example.com/spoof'))
  assert.equal(r.code, '42501')
  r = await rest(null, 'GET', 'learning_resources?select=id')
  assert.equal(r.code, '42501', 'anonymous denied')

  // Provenance
  r = await rest(A, 'PATCH', `learning_resources?id=eq.${RA.id}`, { origin: 'youtube' })
  assert.equal(r.code, 'P0001', 'origin is immutable')
  r = await rest(A, 'POST', 'resource_source_records', { user_id: A.id, resource_id: RA.id, provider: 'chrome_html', external_id: RA.canonical_url, source_url: RA.url })
  assert.equal(r.status, 201)
  r = await rest(B, 'POST', 'resource_source_records', { user_id: B.id, resource_id: RA.id, provider: 'chrome_html', external_id: 'x', source_url: 'https://example.com' })
  assert.equal(r.code, '23503', "B cannot add a source record to A's resource")
  assert.ok(empty(await rest(B, 'GET', `resource_source_records?resource_id=eq.${RA.id}`)))

  // Quest attachments
  r = await rest(A, 'POST', 'side_quests', { user_id: A.id, title: 'QA library quest' })
  const QA = r.body[0]
  cleanup.push([A, `side_quests?id=eq.${QA.id}`])
  r = await rest(A, 'POST', 'quest_resources', { user_id: A.id, quest_id: QA.id, resource_id: RA.id })
  assert.equal(r.status, 201)
  r = await rest(A, 'POST', 'quest_resources', { user_id: A.id, quest_id: QA.id, resource_id: RB.id })
  assert.equal(r.code, '23503', "A cannot attach B's resource")
  r = await rest(A, 'PATCH', `quest_resources?quest_id=eq.${QA.id}`, { position: 5 })
  assert.ok(r.status >= 400, 'links are not updatable')

  // Sessions link to resources; deleting a resource keeps the session
  r = await rest(A, 'POST', 'learning_sessions', { user_id: A.id, resource_id: RA.id, topic: 'Reading the guide', started_at: new Date().toISOString(), duration_minutes: 35 })
  assert.equal(r.status, 201)
  const S = r.body[0]
  cleanup.push([A, `learning_sessions?id=eq.${S.id}`])
  r = await rest(A, 'POST', 'learning_sessions', { user_id: A.id, resource_id: RB.id, topic: 'x', started_at: new Date().toISOString(), duration_minutes: 5 })
  assert.equal(r.code, '23503', "A cannot log a session against B's resource")
  r = await rest(A, 'GET', `active_learning_sessions?id=eq.${S.id}&select=resource_id`)
  assert.equal(r.body[0].resource_id, RA.id, 'view exposes resource_id')

  r = await rest(A, 'DELETE', `learning_resources?id=eq.${RA.id}`)
  assert.equal(r.body.length, 1)
  r = await rest(A, 'GET', `learning_sessions?id=eq.${S.id}&select=resource_id,duration_minutes`)
  assert.deepEqual(r.body[0], { resource_id: null, duration_minutes: 35 }, 'session kept, link cleared')
  assert.ok(empty(await rest(A, 'GET', `quest_resources?quest_id=eq.${QA.id}`)), 'attachment removed')
  assert.ok(empty(await rest(A, 'GET', `resource_source_records?resource_id=eq.${RA.id}`)), 'source records removed')
})
