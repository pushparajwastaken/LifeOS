'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity,
  BookOpen,
  CalendarDays,
  Compass,
  Dumbbell,
  FolderKanban,
  Goal,
  LayoutDashboard,
  Leaf,
  Library,
  LogOut,
  MessageCircle,
  Moon,
  Sparkles,
  Sun,
  Settings2,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { signOutAction } from '@/app/auth/actions'

const primaryLinks = [
  { label: 'Overview', href: '/', icon: LayoutDashboard },
  { label: 'Habits', href: '/habits', icon: Leaf },
  { label: 'Daily planner', href: '/planner', icon: CalendarDays },
]

function linkIsActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

const pillarLinks = [
  { label: 'Physical', href: '/physical', icon: Dumbbell },
  { label: 'Intellectual', href: '/intellectual', icon: BookOpen },
  { label: 'Academic', href: '/academic', icon: Sparkles },
  { label: 'Professional', href: '/professional', icon: FolderKanban },
  { label: 'Communication', href: '/communication', icon: MessageCircle },
]

const growthLinks = [
  { label: 'Goals', href: '/goals', icon: Goal },
  { label: 'Knowledge vault', href: '/knowledge', icon: Library },
  { label: 'Analytics', href: '/analytics', icon: Activity },
]

const settingsLink = { label: 'Settings', href: '/settings', icon: Settings2 }

function breadcrumbLabel(pathname: string) {
  if (pathname === '/') return 'Overview'
  const section = pathname.split('/')[1] ?? ''
  const match = [...primaryLinks, ...pillarLinks, ...growthLinks, settingsLink].find(link => link.href === `/${section}`)
  return match?.label ?? section.replaceAll('-', ' ')
}

function ThemeButton() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const isDark = mounted && resolvedTheme === 'dark'

  return (
    <button className="icon-button theme-button" type="button" onClick={() => setTheme(isDark ? 'light' : 'dark')} aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}>
      {isDark ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
    </button>
  )
}

function SidebarLink({ label, href, icon: Icon, active }: { label: string; href: string; icon: typeof Compass; active: boolean }) {
  return <Link className={`nav-link${active ? ' nav-link-active' : ''}`} href={href} aria-label={label} aria-current={active ? 'page' : undefined}><Icon size={17} strokeWidth={1.8} aria-hidden="true" /><span>{label}</span>{active && <span className="nav-active-indicator" aria-hidden="true" />}</Link>
}

export function AppShell({ children, userName = 'Your space', userEmail = '' }: { children: React.ReactNode; userName?: string; userEmail?: string }) {
  const pathname = usePathname()
  const avatar = userName.trim().charAt(0).toUpperCase() || 'Y'
  return (
    <div className="app-frame">
      <aside className="sidebar" aria-label="Main navigation">
        <Link href="/" className="brand-lockup" aria-label="LifeOS home"><span className="brand-mark"><Compass size={19} strokeWidth={1.8} /></span><span className="brand-name">life<span>OS</span><small>PERSONAL OPERATING SYSTEM</small></span></Link>
        <div className="workspace-switcher"><span className="workspace-avatar" aria-hidden="true">{avatar}</span><span><strong>{userName}</strong><small>Personal workspace</small></span></div>
        <nav className="side-nav">
          <p className="nav-section-label">WORKSPACE</p>
          {primaryLinks.map(link => <SidebarLink key={link.href} {...link} icon={link.icon} active={linkIsActive(pathname, link.href)} />)}
          <p className="nav-section-label nav-section-spaced">DEVELOPMENT PILLARS</p>
          {pillarLinks.map(link => <SidebarLink key={link.href} {...link} icon={link.icon} active={linkIsActive(pathname, link.href)} />)}
          <p className="nav-section-label nav-section-spaced">GROW & REFLECT</p>
          {growthLinks.map(link => <SidebarLink key={link.href} {...link} icon={link.icon} active={linkIsActive(pathname, link.href)} />)}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-settings"><SidebarLink {...settingsLink} active={linkIsActive(pathname, settingsLink.href)} /></div>
          <form action={signOutAction} className="sidebar-signout"><button className="nav-link sidebar-utility" type="submit"><LogOut size={17} aria-hidden="true" /><span>Sign out</span></button></form>
          <div className="profile-card"><div className="profile-avatar" aria-hidden="true">{avatar}</div><div className="profile-copy"><strong>{userName}</strong><small title={userEmail || 'Personal workspace'}>{userEmail || 'Personal workspace'}</small></div></div>
        </div>
      </aside>

      <div className="main-column">
        <a className="skip-link" href="#main-content">Skip to main content</a>
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-divider">/</span><strong>{breadcrumbLabel(pathname)}</strong></div>
          <div className="topbar-actions"><ThemeButton /></div>
        </header>
        <main id="main-content" className="main-content">{children}</main>
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {[...primaryLinks.slice(0, 2), ...pillarLinks.slice(0, 1), ...growthLinks.slice(0, 1), ...growthLinks.slice(2), settingsLink].map(({ label, href, icon: Icon }) => {
            const active = linkIsActive(pathname, href)
            return <Link key={href} className={`mobile-nav-item${active ? ' mobile-nav-active' : ''}`} href={href} aria-label={label} aria-current={active ? 'page' : undefined}><Icon size={19} aria-hidden="true" /><span>{label === 'Overview' ? 'Home' : label}</span></Link>
          })}
        </nav>
      </div>
    </div>
  )
}
