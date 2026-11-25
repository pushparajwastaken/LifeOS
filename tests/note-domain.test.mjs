import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  NOTE_TYPES,
  QUEST_NOTE_TYPE,
  excerpt,
  isSafeHttpUrl,
  normalizeSearchQuery,
  noteInputSchema,
  noteInputToRow,
  parseNoteFilter,
} from '../features/notes/note-domain.ts'

test('note types mirror the knowledge_notes check constraint', () => {
  const sql = readFileSync(new URL('../supabase/migrations/202611110001_lifeos_core.sql', import.meta.url), 'utf8')
  const match = sql.match(/note_type text not null default '(\w+)' check \(note_type in \(([^)]*)\)\)/)
  assert.ok(match)
  assert.deepEqual([...NOTE_TYPES], match[2].split(',').map((v) => v.trim().replace(/'/g, '')))
  assert.ok(NOTE_TYPES.includes(QUEST_NOTE_TYPE))
})

test('only http and https URLs are accepted', () => {
  assert.equal(isSafeHttpUrl('https://example.com/a?b=1'), true)
  assert.equal(isSafeHttpUrl('http://localhost:3000'), true)
  for (const bad of ['javascript:alert(1)', 'data:text/html,<b>x</b>', 'file:///etc/passwd', 'ftp://example.com', 'example.com', '', 'https://']) {
    assert.equal(isSafeHttpUrl(bad), false, bad)
  }
})

test('note input validation and row mapping', () => {
  const parsed = noteInputSchema.parse({ title: ' Pipelining ', noteType: 'research', body: 'line1\r\nline2', sourceUrl: '  ' })
  assert.deepEqual(noteInputToRow(parsed), { title: 'Pipelining', note_type: 'research', body: 'line1\nline2', source_url: null })
  assert.equal(noteInputSchema.safeParse({ title: '', noteType: 'idea', body: '', sourceUrl: '' }).success, false)
  assert.equal(noteInputSchema.safeParse({ title: 'x', noteType: 'diary', body: '', sourceUrl: '' }).success, false)
  assert.equal(noteInputSchema.safeParse({ title: 'x', noteType: 'idea', body: '', sourceUrl: 'javascript:alert(1)' }).success, false)
  assert.equal(noteInputSchema.safeParse({ title: 'x'.repeat(241), noteType: 'idea', body: '', sourceUrl: '' }).success, false)
})

test('filters, search normalisation and excerpts', () => {
  assert.equal(parseNoteFilter('unlinked'), 'unlinked')
  assert.equal(parseNoteFilter('other'), 'all')
  assert.equal(normalizeSearchQuery('   '), null)
  assert.equal(normalizeSearchQuery('  cache   coherence '), 'cache coherence')
  assert.equal(normalizeSearchQuery('a'.repeat(200)).length, 120)
  assert.equal(excerpt('short'), 'short')
  assert.ok(excerpt('word '.repeat(100), 20).endsWith('…'))
})
