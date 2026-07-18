import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getTimesheetMatrix } from './actions'
import HrClient from './HrClient'

export default async function HrPage() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  if (session.role !== 'admin' && session.role !== 'hanhchinh' && session.role !== 'superadmin') {
    redirect('/dashboard')
  }

  // Determine current year and month in Vietnam local time
  const now = new Date()
  const vnTimeStr = now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' })
  const vnDate = new Date(vnTimeStr)
  const initialYear = vnDate.getFullYear()
  const initialMonth = vnDate.getMonth() + 1

  const res = await getTimesheetMatrix(initialYear, initialMonth)

  const initialMatrix = res.success && res.matrix ? res.matrix : []
  const initialTotalDays = res.success && res.totalDays ? res.totalDays : 30

  return (
    <HrClient
      role={session.role}
      initialMatrix={initialMatrix}
      initialYear={initialYear}
      initialMonth={initialMonth}
      initialTotalDays={initialTotalDays}
    />
  )
}
