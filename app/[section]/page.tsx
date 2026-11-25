import { notFound } from 'next/navigation'
import { ArrowUpRight, BookMarked, BookOpen, CalendarDays, Dumbbell, FolderKanban, Goal, MessageCircle, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { AuthenticatedAppShell } from '@/components/layout/authenticated-app-shell'

const sections: Record<string, { title: string; category: string; description: string; icon: typeof BookOpen; phase: string }> = {
  planner: { title: 'Daily planner', category: 'Workspace', description: 'Make space for what matters, one intentional day at a time.', icon: CalendarDays, phase: 'Phase 3' },
  physical: { title: 'Physical', category: 'Development pillar', description: 'Build a stronger relationship with your body through movement, recovery and rest.', icon: Dumbbell, phase: 'Phase 4' },
  intellectual: { title: 'Intellectual', category: 'Development pillar', description: 'Keep curiosity moving with reading, ideas and a growing personal knowledge vault.', icon: BookOpen, phase: 'Phase 4' },
  academic: { title: 'Academic', category: 'Development pillar', description: 'Turn focused study into durable understanding and meaningful progress.', icon: Sparkles, phase: 'Phase 4' },
  professional: { title: 'Professional', category: 'Development pillar', description: 'Move important work forward and make your output visible to yourself.', icon: FolderKanban, phase: 'Phase 4' },
  communication: { title: 'Communication', category: 'Development pillar', description: 'Practice clearer expression, deeper listening and stronger connection.', icon: MessageCircle, phase: 'Phase 4' },
  goals: { title: 'Goals', category: 'Growth & reflection', description: 'Give your longer-term intentions a direction, a measure and a history.', icon: Goal, phase: 'Phase 5' },
  library: { title: 'Library', category: 'Growth & reflection', description: 'Save articles, videos and courses in one place, and attach them to the side quests they support.', icon: BookMarked, phase: 'Milestone 3' },
  analytics: { title: 'Analytics', category: 'Growth & reflection', description: 'See patterns in your consistency, output and progress without reducing growth to one score.', icon: Sparkles, phase: 'Phase 5' },
  reviews: { title: 'Weekly reviews', category: 'Growth & reflection', description: 'Reflect on the week behind you and make a deliberate plan for the week ahead.', icon: BookOpen, phase: 'Phase 3' },
}

export function generateStaticParams() {
  return Object.keys(sections).map(section => ({ section }))
}

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params
  const content = sections[section]
  if (!content) notFound()
  const Icon = content.icon

  return <AuthenticatedAppShell><div className="module-page"><div className="module-heading"><div className="module-icon"><Icon size={21} aria-hidden="true" /></div><p className="eyebrow">{content.category.toUpperCase()}</p><h1>{content.title}</h1><p>{content.description}</p></div><div className="module-preview-card"><div className="module-preview-icon"><Icon size={20} aria-hidden="true" /></div><span className="phase-badge">{content.phase}</span><h2>This space is taking shape.</h2><p>LifeOS is being built in thoughtful layers. Your {content.title.toLowerCase()} workspace will arrive with secure accounts and real, private records—not placeholder tracking.</p><Link href="/" className="text-link">Back to overview <ArrowUpRight size={15} /></Link></div></div></AuthenticatedAppShell>
}
