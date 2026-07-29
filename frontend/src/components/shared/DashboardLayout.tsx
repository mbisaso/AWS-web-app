import type { ReactNode } from 'react'
import { DashboardSidebar } from '../dashboard/DashboardSidebar'

interface DashboardLayoutProps {
  children: ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-mist lg:h-screen lg:flex-row lg:overflow-hidden">
      <DashboardSidebar />
      <main className="relative flex-1 min-w-0 overflow-y-auto px-5 py-5 sm:px-6 lg:px-8 lg:py-6">
        {children}
      </main>
    </div>
  )
}
