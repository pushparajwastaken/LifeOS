// Parser for browser bookmark exports in the Netscape bookmark file format (Chrome, Edge, Firefox, Safari).
// Pure TypeScript: no DOM, no network. The canonicalizer is injected so this module has no app imports
// and can be tested directly with node:test.

export const BOOKMARK_LIMITS = { maxBytes: 5 * 1024 * 1024, maxBookmarks: 5000, maxTitle: 500, maxFolderPath: 1000 } as const

export type CanonicalizeResult =
  | { ok: true; value: { url: string; canonical: string; host: string; inferredType: string } }
  | { ok: false; reason: string }

export type ParsedBookmark = {
  url: string
  canonical: string
  title: string | null
  folderPath: string
  addedAt: string | null
  inferredType: string
  host: string
}

export type ParseResult = {
  bookmarks: ParsedBookmark[]
  total: number
  skippedUnsupported: number
  duplicatesInFile: number
  truncated: boolean
}

export type ParseError = { error: 'not_bookmark_file' | 'too_large' | 'empty' }

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

export function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const point = code[1].toLowerCase() === 'x' ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10)
      return Number.isFinite(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match
    }
    return ENTITIES[code.toLowerCase()] ?? match
  })
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, '')
}

function attribute(tag: string, name: string): string | null {
  const match = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag)
  if (!match) return null
  return decodeEntities(match[2] ?? match[3] ?? match[4] ?? '')
}

function cleanText(value: string, max: number): string | null {
  const text = decodeEntities(stripTags(value)).replace(/\s+/g, ' ').trim()
  return text ? text.slice(0, max) : null
}

/**
 * Parses bookmark HTML into unique, importable http(s) bookmarks.
 * - Folder names are tracked through nested <DL> lists and joined with " / ".
 * - Bookmarklets and other non-http(s) links are skipped and counted.
 * - Duplicates within the file (same canonical URL) keep the first occurrence.
 * - Stops after BOOKMARK_LIMITS.maxBookmarks unique bookmarks (truncated = true).
 */
export function parseBookmarksHtml(html: string, canonicalize: (url: string) => CanonicalizeResult): ParseResult | ParseError {
  if (html.length === 0) return { error: 'empty' }
  if (new TextEncoder().encode(html).length > BOOKMARK_LIMITS.maxBytes) return { error: 'too_large' }
  if (!/<!DOCTYPE\s+NETSCAPE-Bookmark-file-1>/i.test(html) && !/<DL[\s>]/i.test(html)) return { error: 'not_bookmark_file' }

  const token = /<H3\b([^>]*)>([\s\S]*?)<\/H3>|<A\b([^>]*)>([\s\S]*?)<\/A>|<DL\b[^>]*>|<\/DL>/gi
  const folders: string[] = []
  let pendingFolder: string | null = null
  const seen = new Set<string>()
  const bookmarks: ParsedBookmark[] = []
  let total = 0
  let skippedUnsupported = 0
  let duplicatesInFile = 0
  let truncated = false

  for (const match of html.matchAll(token)) {
    const text = match[0]
    if (/^<H3/i.test(text)) {
      pendingFolder = cleanText(match[2] ?? '', 200) ?? 'Untitled folder'
    } else if (/^<DL/i.test(text)) {
      if (pendingFolder !== null) folders.push(pendingFolder)
      else folders.push('')
      pendingFolder = null
    } else if (/^<\/DL/i.test(text)) {
      folders.pop()
    } else {
      total += 1
      const href = attribute(match[3] ?? '', 'HREF')
      const result = href ? canonicalize(href) : { ok: false as const, reason: 'invalid' }
      if (!result.ok) {
        skippedUnsupported += 1
        continue
      }
      if (seen.has(result.value.canonical)) {
        duplicatesInFile += 1
        continue
      }
      if (bookmarks.length >= BOOKMARK_LIMITS.maxBookmarks) {
        truncated = true
        continue
      }
      seen.add(result.value.canonical)
      const addDate = attribute(match[3] ?? '', 'ADD_DATE')
      const seconds = addDate && /^\d{1,12}$/.test(addDate) ? Number(addDate) : null
      bookmarks.push({
        url: result.value.url,
        canonical: result.value.canonical,
        title: cleanText(match[4] ?? '', BOOKMARK_LIMITS.maxTitle),
        folderPath: folders.filter(Boolean).join(' / ').slice(0, BOOKMARK_LIMITS.maxFolderPath),
        addedAt: seconds && seconds > 0 ? new Date(seconds * 1000).toISOString() : null,
        inferredType: result.value.inferredType,
        host: result.value.host,
      })
    }
  }

  if (total === 0) return { error: 'empty' }
  return { bookmarks, total, skippedUnsupported, duplicatesInFile, truncated }
}
