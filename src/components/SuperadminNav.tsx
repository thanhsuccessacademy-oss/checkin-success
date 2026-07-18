'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Calendar, Users, ShieldAlert } from 'lucide-react'

export function SuperadminNav() {
  const pathname = usePathname()

  const tabs = [
    { name: 'Chấm công', href: '/dashboard', icon: Calendar },
    { name: 'Hành chính', href: '/hr', icon: Users },
    { name: 'Quản trị', href: '/admin', icon: ShieldAlert },
  ]

  return (
    <nav className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/50 shadow-inner max-w-fit mx-auto md:mx-0">
      {tabs.map((tab) => {
        const Icon = tab.icon
        // Highlight active if pathname matches exactly or starts with href + '/' (e.g. nested routes)
        const isActive = pathname === tab.href || pathname?.startsWith(tab.href + '/')
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer ${
              isActive
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/30 scale-[1.02]'
                : 'text-slate-500 hover:text-indigo-650 hover:bg-white/40'
            }`}
          >
            <Icon className={`h-3.5 w-3.5 transition-transform duration-200 ${isActive ? 'scale-110 text-indigo-600' : 'text-slate-400 group-hover:text-indigo-500'}`} />
            <span>{tab.name}</span>
          </Link>
        )
      })}
    </nav>
  )
}
