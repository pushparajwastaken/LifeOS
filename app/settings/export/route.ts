import { NextResponse } from 'next/server'
import { EXPORT_LIMITS, EXPORT_TABLES, exportFileName } from '@/features/settings/settings-domain'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * "Export my data": a JSON file with the signed-in user's own rows from every LifeOS table.
 * Runs under the user's session (RLS applies) and also filters by owner; table names come from a static list.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to export your data.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })

  const tables: Record<string, { rows: unknown[]; truncated: boolean; error?: string }> = {}
  for (const { table, owner, order } of EXPORT_TABLES) {
    const rows: unknown[] = []
    let failed: string | undefined
    for (let from = 0; from < EXPORT_LIMITS.maxRowsPerTable; from += EXPORT_LIMITS.pageSize) {
      let query = supabase.from(table).select('*').eq(owner, user.id)
      for (const column of order) query = query.order(column, { ascending: true })
      const { data, error } = await query.range(from, from + EXPORT_LIMITS.pageSize - 1)
      if (error) {
        failed = 'could_not_read'
        break
      }
      rows.push(...(data ?? []))
      if (!data || data.length < EXPORT_LIMITS.pageSize) break
    }
    tables[table] = { rows, truncated: rows.length >= EXPORT_LIMITS.maxRowsPerTable, ...(failed ? { error: failed } : {}) }
  }

  const now = new Date()
  const body = JSON.stringify({ format: 'lifeos-export', version: 1, exportedAt: now.toISOString(), account: { id: user.id, email: user.email ?? null }, tables }, null, 2)
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${exportFileName(now)}"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
