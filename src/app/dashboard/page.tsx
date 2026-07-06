import { getSession } from '@/lib/auth'
import { getSheet } from '@/lib/googleSheets'
import { redirect } from 'next/navigation'
import { checkShiftTime } from '@/lib/utils/time'
import DashboardClient from './DashboardClient'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  // 1. Fetch system settings from "CauHinh" (with shift hours)
  let settings = {
    maps_url: '',
    radius_meters: 100,
    morning_start: '07:30',
    morning_late: '07:56',
    morning_end: '08:30',
    afternoon_start: '13:00',
    afternoon_late: '13:26',
    afternoon_end: '14:00',
  }

  try {
    const configSheet = await getSheet('CauHinh')
    const configRows = await configSheet.getRows()
    if (configRows && configRows.length > 0) {
      const row = configRows[0]
      settings = {
        maps_url: row.get('Maps_URL') || '',
        radius_meters: parseInt(row.get('Radius') || row.get('Radius_Meters') || '100', 10),
        morning_start: row.get('Morning_Start') || '07:30',
        morning_late: row.get('Morning_Late') || '07:56',
        morning_end: row.get('Morning_End') || '08:30',
        afternoon_start: row.get('Afternoon_Start') || '13:00',
        afternoon_late: row.get('Afternoon_Late') || '13:26',
        afternoon_end: row.get('Afternoon_End') || '14:00',
      }
    }
  } catch (error) {
    console.error('Error loading config sheet in dashboard:', error)
  }

  // 2. Fetch employee check-ins from "Log_Checkin"
  let checkIns: any[] = []
  try {
    const logSheet = await getSheet('Log_Checkin')
    const logRows = await logSheet.getRows()

    checkIns = logRows
      .filter((row) => row.get('Email')?.trim().toLowerCase() === session.email.toLowerCase())
      .map((row) => ({
        id: row.rowNumber.toString(),
        check_in_time: row.get('Time') || new Date().toISOString(),
        shift: row.get('Shift') || 'morning',
        status: row.get('Status') || 'on_time',
        lat: parseFloat(row.get('Lat') || '0'),
        lng: parseFloat(row.get('Lng') || '0'),
      }))
      .reverse() // Newest first
      .slice(0, 10) // Limit to 10 rows
  } catch (error) {
    console.error('Error loading checkin logs in dashboard:', error)
  }

  // 3. Compute active shift validation strictly using dynamic configurations
  const serverTime = new Date()
  const shiftConfig = {
    morningStart: settings.morning_start,
    morningLate: settings.morning_late,
    morningEnd: settings.morning_end,
    afternoonStart: settings.afternoon_start,
    afternoonLate: settings.afternoon_late,
    afternoonEnd: settings.afternoon_end,
  }

  const rawShiftInfo = checkShiftTime(serverTime, shiftConfig)
  const shiftInfo = {
    eligible: rawShiftInfo.eligible,
    shift: rawShiftInfo.shift,
    message: rawShiftInfo.message || 'Ngoài khung giờ check-in hợp lệ',
  }

  return (
    <DashboardClient
      user={{ email: session.email, fullName: session.fullName, role: session.role }}
      settings={settings}
      initialHistory={checkIns}
      shiftInfo={shiftInfo}
    />
  )
}
