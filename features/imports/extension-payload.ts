// Validates bookmarks sent by the LifeOS Chrome extension (relayed through the import page) and turns them
// into the same shape the HTML parser produces. The payload is untrusted: it is size-limited, schema-checked,
// re-canonicalised and de-duplicated here, on the server. No app imports, so node:test can load it directly.
import { z } from 'zod'
import type { CanonicalizeResult, ParseResult } from './bookmark-parser'

export const EXTENSION_LIMITS = { maxChars: 5_000_000, maxBookmarks: 5000, maxUrl: 2048, maxTitle: 500, maxFolderPath: 1000 } as const

const bookmarkSchema = z.object({
  url: z.string().min(1).max(EXTENSION_LIMITS.maxUrl),
  title: z.string().max(EXTENSION_LIMITS.maxTitle * 2).nullable().optional(),
  folderPath: z.string().max(EXTENSION_LIMITS.maxFolderPath * 2).nullable().optional(),
  dateAdded: z.number().int().positive().max(8_640_000_000_000_000).nullable().optional(),
})

const payloadSchema = z.object({
  bookmarks: z.array(bookmarkSchema).min(1).max(EXTENSION_LIMITS.maxBookmarks),
  summary: z.object({
    skipped: z.number().int().min(0).max(1_000_000).optional(),
    duplicates: z.number().int().min(0).max(1_000_000).optional(),
    truncated: z.boolean().optional(),
  }).optional(),
})

export type ExtensionPayloadError = { error: 'invalid' | 'too_large' | 'empty' }

function cleanText(value: string | null | undefined, max: number): string | null {
  if (typeof value !== 'string') return null
  const text = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  return text ? text.slice(0, max) : null
}

export function parseExtensionPayload(raw: unknown, canonicalize: (url: string) => CanonicalizeResult): ParseResult | ExtensionPayloadError {
  if (typeof raw !== 'string' || raw.length === 0) return { error: 'empty' }
  if (raw.length > EXTENSION_LIMITS.maxChars) return { error: 'too_large' }
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return { error: 'invalid' }
  }
  const parsed = payloadSchema.safeParse(json)
  if (!parsed.success) {
    const tooMany = parsed.error.issues.some((issue) => issue.code === 'too_big' && issue.path.length === 1 && issue.path[0] === 'bookmarks')
    return { error: tooMany ? 'too_large' : 'invalid' }
  }

  const seen = new Set<string>()
  const bookmarks: ParseResult['bookmarks'] = []
  let skippedUnsupported = parsed.data.summary?.skipped ?? 0
  let duplicatesInFile = parsed.data.summary?.duplicates ?? 0
  for (const item of parsed.data.bookmarks) {
    const result = canonicalize(item.url)
    if (!result.ok) {
      skippedUnsupported += 1
      continue
    }
    if (seen.has(result.value.canonical)) {
      duplicatesInFile += 1
      continue
    }
    seen.add(result.value.canonical)
    bookmarks.push({
      url: result.value.url,
      canonical: result.value.canonical,
      title: cleanText(item.title, EXTENSION_LIMITS.maxTitle),
      folderPath: cleanText(item.folderPath, EXTENSION_LIMITS.maxFolderPath) ?? '',
      addedAt: item.dateAdded ? new Date(item.dateAdded).toISOString() : null,
      inferredType: result.value.inferredType,
      host: result.value.host,
    })
  }
  if (bookmarks.length === 0) return { error: 'empty' }
  return {
    bookmarks,
    total: bookmarks.length + skippedUnsupported + duplicatesInFile,
    skippedUnsupported,
    duplicatesInFile,
    truncated: parsed.data.summary?.truncated === true,
  }
}
