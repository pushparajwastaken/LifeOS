// Resource Library rules. Pure TypeScript (plus zod) so node:test can import it directly.
// Values mirror supabase/migrations/20261126120000_resource_library.sql; tests/resource-domain.test.mjs checks them.
// Saving, importing or attaching a resource is collection, never learning effort.
import { z } from 'zod'

export const RESOURCE_TYPES = ['article', 'documentation', 'video', 'playlist', 'book', 'paper', 'course', 'post', 'repository', 'other'] as const
export type ResourceType = (typeof RESOURCE_TYPES)[number]

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  article: 'Article',
  documentation: 'Documentation',
  video: 'Video',
  playlist: 'Playlist',
  book: 'Book',
  paper: 'Research paper',
  course: 'Course',
  post: 'Post',
  repository: 'Repository',
  other: 'Other',
}

export const RESOURCE_STATUSES = ['saved', 'in_progress', 'completed', 'archived'] as const
export type ResourceStatus = (typeof RESOURCE_STATUSES)[number]

export const RESOURCE_STATUS_LABELS: Record<ResourceStatus, string> = {
  saved: 'Saved',
  in_progress: 'In progress',
  completed: 'Completed',
  archived: 'Archived',
}

/** Where a resource first came from. Never changes after creation. */
export const RESOURCE_ORIGINS = ['manual', 'chrome_html', 'chrome_extension', 'youtube', 'x'] as const
export type ResourceOrigin = (typeof RESOURCE_ORIGINS)[number]

/** Where the stored URL or title value came from. API-derived values are purged with their provider. */
export const VALUE_SOURCES = ['user', 'youtube', 'chrome', 'x'] as const

export const SOURCE_PROVIDERS = ['chrome_html', 'chrome_extension', 'youtube', 'x'] as const

export const RESOURCE_LIMITS = { url: 2048, title: 500, category: 60, notes: 4000 } as const

// ---------------------------------------------------------------------------
// URL canonicalization
// ---------------------------------------------------------------------------

const TRACKING_PARAMS = new Set([
  'fbclid', 'gclid', 'dclid', 'gbraid', 'wbraid', 'msclkid', 'mc_cid', 'mc_eid', 'igshid', 'ref_src', 'ref_url',
  '_hsenc', '_hsmi', 'mkt_tok', 'yclid', 'spm', 'si',
])

export type CanonicalUrl = { url: string; canonical: string; host: string; inferredType: ResourceType }
export type CanonicalResult = { ok: true; value: CanonicalUrl } | { ok: false; reason: 'invalid' | 'unsupported_scheme' | 'too_long' }

const YOUTUBE_HOSTS = new Set(['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com'])
const X_HOSTS = new Set(['x.com', 'twitter.com', 'mobile.twitter.com', 'mobile.x.com'])
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/
const YOUTUBE_LIST = /^[A-Za-z0-9_-]{2,64}$/

function youtubeCanonical(host: string, url: URL): CanonicalUrl | null {
  const path = url.pathname.replace(/\/+$/, '')
  let videoId: string | null = null
  if (host === 'youtu.be') videoId = path.slice(1).split('/')[0] ?? null
  else if (YOUTUBE_HOSTS.has(host)) {
    if (path === '/watch') videoId = url.searchParams.get('v')
    else {
      const match = /^\/(shorts|embed|live|v)\/([^/]+)$/.exec(path)
      if (match) videoId = match[2]
      else if (path === '/playlist') {
        const list = url.searchParams.get('list')
        if (list && YOUTUBE_LIST.test(list)) {
          const canonical = `https://youtube.com/playlist?list=${list}`
          return { url: url.toString(), canonical, host: 'youtube.com', inferredType: 'playlist' }
        }
      }
    }
  } else return null
  if (!videoId || !YOUTUBE_ID.test(videoId)) return null
  return { url: url.toString(), canonical: `https://youtube.com/watch?v=${videoId}`, host: 'youtube.com', inferredType: 'video' }
}

function xCanonical(host: string, url: URL): CanonicalUrl | null {
  if (!X_HOSTS.has(host)) return null
  const match = /^\/(?:[A-Za-z0-9_]{1,15}|i(?:\/web)?)\/status\/(\d{1,25})(?:\/.*)?$/.exec(url.pathname)
  if (!match) return null
  return { url: url.toString(), canonical: `https://x.com/i/status/${match[1]}`, host: 'x.com', inferredType: 'post' }
}

function inferType(host: string, path: string): ResourceType {
  if (host === 'github.com' || host === 'gitlab.com' || host === 'codeberg.org') return 'repository'
  if (host === 'arxiv.org' || host === 'doi.org' || host.endsWith('.acm.org') || host === 'ieeexplore.ieee.org' || /\.pdf$/i.test(path)) return 'paper'
  if (host.startsWith('docs.') || host.startsWith('developer.') || host === 'developer.mozilla.org' || /\/docs?(\/|$)/.test(path)) return 'documentation'
  if (host === 'coursera.org' || host === 'udemy.com' || host === 'edx.org' || host === 'khanacademy.org') return 'course'
  if (host === 'vimeo.com') return 'video'
  return 'article'
}

/**
 * Normalises a user- or import-supplied URL into a stable dedup key.
 * - Only http(s); javascript:, data:, file: and everything else are rejected.
 * - Lowercase host without "www." or a trailing dot; default ports dropped; https in the key.
 * - Fragments and tracking parameters removed; remaining query parameters sorted.
 * - Trailing slashes removed (except the root).
 * - YouTube videos/playlists and X posts reduced to one canonical form.
 * The original URL is kept separately for display and opening.
 */
export function canonicalizeUrl(input: string): CanonicalResult {
  const trimmed = input.trim()
  if (trimmed.length === 0) return { ok: false, reason: 'invalid' }
  if (trimmed.length > RESOURCE_LIMITS.url) return { ok: false, reason: 'too_long' }
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return { ok: false, reason: 'invalid' }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, reason: 'unsupported_scheme' }
  if (!url.hostname || url.username || url.password) return { ok: false, reason: 'invalid' }

  const host = url.hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, '')
  const special = youtubeCanonical(host, url) ?? xCanonical(host, url)
  if (special) return { ok: true, value: special }

  const params = [...url.searchParams.entries()]
    .filter(([key]) => !key.toLowerCase().startsWith('utm_') && !TRACKING_PARAMS.has(key.toLowerCase()))
    .sort(([a, av], [b, bv]) => (a === b ? av.localeCompare(bv) : a.localeCompare(b)))
  const query = new URLSearchParams(params).toString()
  const path = url.pathname === '/' ? '' : url.pathname.replace(/\/+$/, '')
  const port = url.port && !((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) ? `:${url.port}` : ''
  const canonical = `https://${host}${port}${path}${query ? `?${query}` : ''}`
  url.hash = ''
  return { ok: true, value: { url: url.toString(), canonical, host, inferredType: inferType(host, url.pathname) } }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const blankToNull = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? null : value)

export const resourceInputSchema = z.object({
  url: z.string().trim().min(1, 'Enter a link.').max(RESOURCE_LIMITS.url),
  title: z.preprocess(blankToNull, z.string().trim().max(RESOURCE_LIMITS.title).nullable()),
  resourceType: z.preprocess(blankToNull, z.enum(RESOURCE_TYPES).nullable()),
  category: z.preprocess(blankToNull, z.string().trim().max(RESOURCE_LIMITS.category).nullable()),
  notes: z.preprocess(blankToNull, z.string().max(RESOURCE_LIMITS.notes).nullable()),
})

export type ResourceInput = z.infer<typeof resourceInputSchema>

export const resourceStatusSchema = z.enum(RESOURCE_STATUSES)

/** A readable fallback title from a URL when the user gives none. */
export function titleFromUrl(canonical: CanonicalUrl): string {
  try {
    const url = new URL(canonical.url)
    const tail = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() ?? '').replace(/[-_]+/g, ' ').replace(/\.[a-z0-9]{1,5}$/i, '').trim()
    const title = tail ? `${tail} · ${canonical.host}` : canonical.host
    return title.slice(0, RESOURCE_LIMITS.title)
  } catch {
    return canonical.host
  }
}

/** Status change values: completed_at is set only for completed, cleared otherwise. */
export function getResourceStatusUpdate(status: ResourceStatus, now: Date) {
  return { status, completed_at: status === 'completed' ? now.toISOString() : null }
}

export type ResourceFilters = { status: ResourceStatus | 'active' | 'all'; type: ResourceType | 'all'; questId: string | null; query: string | null }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function parseResourceFilters(raw: { status?: string; type?: string; quest?: string; q?: string }): ResourceFilters {
  const status = raw.status && (raw.status === 'all' || (RESOURCE_STATUSES as readonly string[]).includes(raw.status)) ? (raw.status as ResourceFilters['status']) : 'active'
  const type = raw.type && (RESOURCE_TYPES as readonly string[]).includes(raw.type) ? (raw.type as ResourceType) : 'all'
  const questId = raw.quest && UUID.test(raw.quest) ? raw.quest : null
  const q = (raw.q ?? '').replace(/\s+/g, ' ').trim().slice(0, 120)
  return { status, type, questId, query: q || null }
}
