// Two-user integration test for M4 bookmark imports (staging only, real Supabase Auth sessions).
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
const runBody = (owner, extra = {}) => ({ user_id: owner.id, provider: 'chrome_html', file_name: 'bookmarks.html', items_seen: 2, items_staged: 2, ...extra })
const candidateBody = (owner, runId, canonical, extra = {}) => ({ user_id: owner.id, import_run_id: runId, position: 0, url: canonical, canonical_url: canonical, title: 'QA bookmark', resource_type: 'article', ...extra })

test('resource imports: run and candidate isolation, linkage and provenance', { skip: configured ? false : 'staging test environment variables are not set' }, async (t) => {
  const A = await signIn(env.LIFEOS_TEST_USER_A_EMAIL, env.LIFEOS_TEST_USER_A_PASSWORD)
  const B = await signIn(env.LIFEOS_TEST_USER_B_EMAIL, env.LIFEOS_TEST_USER_B_PASSWORD)
  const cleanup = []
  t.after(async () => { for (const [owner, path] of cleanup.reverse()) await rest(owner, 'DELETE', path) })

  let r = await rest(A, 'POST', 'import_runs', runBody(A))
  assert.equal(r.status, 201, `create run: ${r.code}`)
  const RUN_A = r.body[0]
  cleanup.push([A, `import_runs?id=eq.${RUN_A.id}`])
  assert.equal(RUN_A.status, 'staged')
  assert.ok(new Date(RUN_A.expires_at) > new Date(), 'expiry defaults to the future')

  r = await rest(B, 'POST', 'import_runs', runBody(B))
  assert.equal(r.status, 201)
  const RUN_B = r.body[0]
  cleanup.push([B, `import_runs?id=eq.${RUN_B.id}`])

  // Constraints
  r = await rest(A, 'POST', 'import_runs', runBody(A, { provider: 'dropbox' }))
  assert.equal(r.code, '23514', 'unknown provider rejected')
  r = await rest(A, 'POST', 'import_runs', runBody(A, { items_seen: -1 }))
  assert.equal(r.code, '23514', 'negative counts rejected')
  r = await rest(A, 'POST', 'import_runs', runBody(A, { status: 'completed' }))
  assert.equal(r.code, '23514', 'completed requires completed_at')
  r = await rest(A, 'POST', 'import_runs', runBody(A, { error_code: 'x; drop table' }))
  assert.equal(r.code, '23514', 'error_code must be a slug')

  // Candidates
  r = await rest(A, 'POST', 'import_candidates', candidateBody(A, RUN_A.id, 'https://example.com/import-a'))
  assert.equal(r.status, 201, `candidate: ${r.code}`)
  const CAND_A = r.body[0]
  r = await rest(A, 'POST', 'import_candidates', candidateBody(A, RUN_A.id, 'https://example.com/import-a', { position: 1 }))
  assert.equal(r.code, '23505', 'one canonical URL per run')
  r = await rest(A, 'POST', 'import_candidates', candidateBody(A, RUN_A.id, 'https://example.com/x', { url: 'javascript:alert(1)' }))
  assert.equal(r.code, '23514', 'non-http candidate URL rejected')
  r = await rest(A, 'POST', 'import_candidates', candidateBody(A, RUN_B.id, 'https://example.com/cross'))
  assert.equal(r.code, '23503', "A cannot stage into B's run")
  r = await rest(B, 'POST', 'import_candidates', candidateBody(A, RUN_A.id, 'https://example.com/spoof'))
  assert.equal(r.code, '42501', 'B cannot insert as A')
  r = await rest(A, 'PATCH', `import_candidates?id=eq.${CAND_A.id}`, { title: 'changed' })
  assert.equal(r.code, '42501', 'candidates are immutable (no UPDATE grant)')

  // Isolation
  assert.ok(empty(await rest(B, 'GET', `import_runs?id=eq.${RUN_A.id}`)))
  assert.ok(empty(await rest(B, 'GET', `import_candidates?import_run_id=eq.${RUN_A.id}`)))
  assert.ok(empty(await rest(B, 'PATCH', `import_runs?id=eq.${RUN_A.id}`, { status: 'cancelled' })))
  assert.ok(empty(await rest(B, 'DELETE', `import_candidates?id=eq.${CAND_A.id}`)))
  assert.ok(empty(await rest(B, 'DELETE', `import_runs?id=eq.${RUN_A.id}`)))
  r = await rest(null, 'GET', 'import_runs?select=id')
  assert.equal(r.code, '42501', 'anonymous denied runs')
  r = await rest(null, 'GET', 'import_candidates?select=id')
  assert.equal(r.code, '42501', 'anonymous denied candidates')

  // Provenance link from source records
  r = await rest(A, 'POST', 'learning_resources', { user_id: A.id, url: 'https://example.com/import-a', canonical_url: 'https://example.com/import-a', title: 'Imported', origin: 'chrome_html', url_source: 'chrome', title_source: 'chrome' })
  assert.equal(r.status, 201, `resource: ${r.code}`)
  const RES_A = r.body[0]
  cleanup.push([A, `learning_resources?id=eq.${RES_A.id}`])
  r = await rest(A, 'POST', 'resource_source_records', { user_id: A.id, resource_id: RES_A.id, provider: 'chrome_html', external_id: RES_A.canonical_url, source_url: RES_A.url, import_run_id: RUN_B.id })
  assert.equal(r.code, '23503', "A cannot attribute provenance to B's run")
  r = await rest(A, 'POST', 'resource_source_records', { user_id: A.id, resource_id: RES_A.id, provider: 'chrome_html', external_id: RES_A.canonical_url, source_url: RES_A.url, import_run_id: RUN_A.id })
  assert.equal(r.status, 201, `source record: ${r.code}`)
  const SRC = r.body[0]

  // Completing the run; deleting it then keeps the resource and nulls the provenance link
  r = await rest(A, 'PATCH', `import_runs?id=eq.${RUN_A.id}`, { status: 'completed', completed_at: new Date().toISOString(), items_imported: 1 })
  assert.equal(r.status, 200, `complete: ${r.code}`)
  r = await rest(A, 'DELETE', `import_runs?id=eq.${RUN_A.id}`)
  assert.equal(r.status, 200)
  assert.ok(empty(await rest(A, 'GET', `import_candidates?import_run_id=eq.${RUN_A.id}`)), 'candidates cascade with the run')
  r = await rest(A, 'GET', `resource_source_records?id=eq.${SRC.id}&select=import_run_id,resource_id`)
  assert.equal(r.body.length, 1, 'source record survives run deletion')
  assert.equal(r.body[0].import_run_id, null)
  assert.equal(r.body[0].resource_id, RES_A.id)
})
