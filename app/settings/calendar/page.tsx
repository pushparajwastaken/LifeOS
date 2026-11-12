import { redirect } from 'next/navigation'

type PageProps = {
  searchParams: Promise<{ authorization?: string | string[] }>
}

export default async function CalendarSettingsAlias({ searchParams }: PageProps) {
  const params = await searchParams
  const notice = Array.isArray(params.authorization) ? params.authorization[0] : params.authorization
  redirect(notice ? `/settings?authorization=${encodeURIComponent(notice)}` : '/settings')
}
