import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { BookDetail } from '@/features/intellectual/components/book-detail'
import { getBookDetail } from '@/features/intellectual/intellectual-service'
import { pillarSession } from '@/features/pillars/pillar-actions-kit'
import { uuidSchema } from '@/features/quests/quest-domain'

export const metadata: Metadata = { title: 'Book', description: 'Reading progress, sessions and notes for one book.' }

type PageProps = { params: Promise<{ bookId: string }>; searchParams: Promise<{ notice?: string | string[] }> }

export default async function BookPage({ params, searchParams }: PageProps) {
  const [{ bookId }, search, session] = await Promise.all([params, searchParams, pillarSession()])
  if (!uuidSchema.safeParse(bookId).success) notFound()
  const data = await getBookDetail(session.supabase, session.userId, bookId)
  if (!data) notFound()
  const notice = Array.isArray(search.notice) ? search.notice[0] : search.notice
  return (
    <AppShell userName={session.userName} userEmail={session.userEmail}>
      <BookDetail data={data} today={session.today} notice={notice} />
    </AppShell>
  )
}
