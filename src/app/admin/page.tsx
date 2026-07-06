import { getSession } from '@/lib/auth'
import { getSheet } from '@/lib/googleSheets'
import { redirect } from 'next/navigation'
import AdminClient from './AdminClient'

export default async function AdminPage() {
  // 1. Verify user role
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  if (session.role !== 'admin') {
    redirect('/dashboard')
  }

  // 2. Fetch settings from "CauHinh" tab (with dynamic shifts)
  let settings = {
    maps_url: '',
    latitude: 10.7765,
    longitude: 106.7009,
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
        latitude: parseFloat(row.get('Latitude') || '10.7765'),
        longitude: parseFloat(row.get('Longitude') || '106.7009'),
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
    console.error('Error fetching settings in admin page:', error)
  }

  // 3. Fetch check-ins with user profiles from "Log_Checkin" tab
  let checkIns: any[] = []
  try {
    const logSheet = await getSheet('Log_Checkin')
    const logRows = await logSheet.getRows()

    checkIns = logRows
      .map((row) => ({
        id: row.rowNumber.toString(),
        check_in_time: row.get('Time') || new Date().toISOString(),
        shift: row.get('Shift') || 'morning',
        status: row.get('Status') || 'on_time',
        lat: parseFloat(row.get('Lat') || '0'),
        lng: parseFloat(row.get('Lng') || '0'),
        profiles: {
          full_name: row.get('FullName') || 'Nhân viên',
          email: row.get('Email') || 'N/A',
        },
      }))
      .reverse() // newest first
  } catch (error) {
    console.error('Error fetching check-ins in admin page:', error)
  }

  // 4. Fetch list of employees from "NhanVien" tab
  let employees: any[] = []
  try {
    const employeeSheet = await getSheet('NhanVien')
    const empRows = await employeeSheet.getRows()
    employees = empRows.map((row) => ({
      email: row.get('Email') || '',
      fullName: row.get('FullName') || '',
      role: row.get('Role') || 'employee',
    }))
  } catch (error) {
    console.error('Error fetching employees in admin page:', error)
  }

  return <AdminClient settings={settings} checkIns={checkIns} employees={employees} />
}
