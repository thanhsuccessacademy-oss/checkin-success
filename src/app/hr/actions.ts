'use server'

import { getSession } from '@/lib/auth'
import { getSheet } from '@/lib/googleSheets'

export async function getTimesheetMatrix(year: number, month: number) {
  // 1. Verify session role (admin or hanhchinh only)
  const session = await getSession()
  if (!session || (session.role !== 'admin' && session.role !== 'hanhchinh')) {
    return { error: 'Không có quyền truy cập thông tin này' }
  }

  // 2. Load system configurations for shift checkin deadlines
  let settings = {
    morning_end: '08:30',
    afternoon_end: '14:00',
  }
  try {
    const configSheet = await getSheet('CauHinh')
    const configRows = await configSheet.getRows()
    if (configRows && configRows.length > 0) {
      const row = configRows[0]
      settings = {
        morning_end: row.get('Morning_End') || '08:30',
        afternoon_end: row.get('Afternoon_End') || '14:00',
      }
    }
  } catch (error) {
    console.error('Error loading config sheet in getTimesheetMatrix:', error)
  }

  // 3. Fetch all employees from NhanVien (filter out admins)
  let employees: { email: string; fullName: string }[] = []
  try {
    const empSheet = await getSheet('NhanVien')
    const empRows = await empSheet.getRows()
    employees = empRows
      .filter((row) => (row.get('Role') || 'employee').trim().toLowerCase() === 'employee')
      .map((row) => ({
        email: (row.get('Email') || '').trim().toLowerCase(),
        fullName: row.get('FullName') || 'Nhân viên',
      }))
  } catch (error) {
    console.error('Error loading employee list:', error)
    return { error: 'Không thể kết nối cơ sở dữ liệu để lấy danh sách nhân sự.' }
  }

  // 4. Fetch check-in logs and schedule exceptions
  let logs: any[] = []
  let exceptions: any[] = []
  try {
    const logSheet = await getSheet('Log_Checkin')
    logs = await logSheet.getRows()

    const exceptSheet = await getSheet('NgoaiLeLichLam')
    exceptions = await exceptSheet.getRows()
  } catch (error) {
    console.error('Error loading logs/exceptions in getTimesheetMatrix:', error)
    // Non-blocking for exceptions if NgoaiLeLichLam is empty/errors out
  }

  // Vietnam timezone date calculations
  const now = new Date()
  const vnTimeStr = now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' })
  const vnDate = new Date(vnTimeStr)
  const currentYear = vnDate.getFullYear()
  const currentMonth = vnDate.getMonth() + 1
  const todayDateNum = vnDate.getDate()

  const monthPrefix = `${year}-${month.toString().padStart(2, '0')}`

  // Parse time thresholds
  const [mEndH, mEndM] = settings.morning_end.split(':').map(Number)
  const [aEndH, aEndM] = settings.afternoon_end.split(':').map(Number)
  const currentMinutesVal = vnDate.getHours() * 60 + vnDate.getMinutes()

  const totalDaysInMonth = new Date(year, month, 0).getDate()

  // Map of YYYY-MM-DD -> email -> { morning?: status, afternoon?: status }
  const checkinsMap: Record<string, Record<string, { morning?: string; afternoon?: string }>> = {}
  logs.forEach((row) => {
    const timeStr = row.get('Time')
    if (!timeStr) return

    const logDate = new Date(timeStr)
    const logVnTimeStr = logDate.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' })
    const logVnDate = new Date(logVnTimeStr)

    if (logVnDate.getFullYear() === year && logVnDate.getMonth() + 1 === month) {
      const email = (row.get('Email') || '').trim().toLowerCase()
      const dayStr = logVnDate.getDate().toString().padStart(2, '0')
      const dateKey = `${monthPrefix}-${dayStr}`
      const shift = row.get('Shift')
      const status = row.get('Status')

      if (!checkinsMap[dateKey]) {
        checkinsMap[dateKey] = {}
      }
      if (!checkinsMap[dateKey][email]) {
        checkinsMap[dateKey][email] = {}
      }

      if (shift === 'morning') {
        checkinsMap[dateKey][email].morning = status
      } else if (shift === 'afternoon') {
        checkinsMap[dateKey][email].afternoon = status
      }
    }
  })

  // Exceptions Map: YYYY-MM-DD -> email -> ExceptionType
  const exceptionsMap: Record<string, Record<string, 'event' | 'comp_off'>> = {}
  exceptions.forEach((row) => {
    const dateStr = row.get('Date')?.trim()
    if (!dateStr || !dateStr.startsWith(monthPrefix)) return

    const email = (row.get('Email') || '').trim().toLowerCase()
    const typeStr = row.get('Type')?.trim() as 'event' | 'comp_off'
    if (typeStr === 'event' || typeStr === 'comp_off') {
      if (!exceptionsMap[dateStr]) {
        exceptionsMap[dateStr] = {}
      }
      exceptionsMap[dateStr][email] = typeStr
    }
  })

  // Construct timesheet matrix
  const matrix = employees.map((emp) => {
    const days: Record<string, { morning: string; afternoon: string }> = {}
    let totalOnTime = 0
    let totalLate = 0
    let totalMissing = 0

    for (let day = 1; day <= totalDaysInMonth; day++) {
      const dayStr = day.toString().padStart(2, '0')
      const dateKey = `${monthPrefix}-${dayStr}`

      const dateObj = new Date(year, month - 1, day)
      const dayOfWeek = dateObj.getDay()
      const userExceptions = exceptionsMap[dateKey] || {}
      const exceptionType = userExceptions[emp.email]

      // Mon-Sat default workdays. Sunday default off day.
      const isDefaultOff = dayOfWeek === 0
      let isOffDay = isDefaultOff

      if (isDefaultOff) {
        if (exceptionType === 'event') {
          isOffDay = false // sunday duty workday
        }
      } else {
        if (exceptionType === 'comp_off') {
          isOffDay = true // compensatory off day
        }
      }

      const userDayCheckins = (checkinsMap[dateKey] || {})[emp.email] || {}
      let morningStatus = 'none'
      let afternoonStatus = 'none'

      const isPastMonth = year < currentYear || (year === currentYear && month < currentMonth)

      // Evaluate Morning Shift
      if (userDayCheckins.morning) {
        morningStatus = userDayCheckins.morning
        if (morningStatus === 'on_time') totalOnTime++
        else if (morningStatus === 'late') totalLate++
      } else {
        if (isOffDay) {
          morningStatus = exceptionType === 'comp_off' ? 'comp_off' : 'off'
        } else {
          if (isPastMonth || (year === currentYear && month === currentMonth && day < todayDateNum)) {
            morningStatus = 'missing'
            totalMissing++
          } else if (year === currentYear && month === currentMonth && day === todayDateNum) {
            if (currentMinutesVal > mEndH * 60 + mEndM) {
              morningStatus = 'missing'
              totalMissing++
            } else {
              morningStatus = 'none'
            }
          } else {
            morningStatus = 'none'
          }
        }
      }

      // Evaluate Afternoon Shift
      if (userDayCheckins.afternoon) {
        afternoonStatus = userDayCheckins.afternoon
        if (afternoonStatus === 'on_time') totalOnTime++
        else if (afternoonStatus === 'late') totalLate++
      } else {
        if (isOffDay) {
          afternoonStatus = exceptionType === 'comp_off' ? 'comp_off' : 'off'
        } else {
          if (isPastMonth || (year === currentYear && month === currentMonth && day < todayDateNum)) {
            afternoonStatus = 'missing'
            totalMissing++
          } else if (year === currentYear && month === currentMonth && day === todayDateNum) {
            if (currentMinutesVal > aEndH * 60 + aEndM) {
              afternoonStatus = 'missing'
              totalMissing++
            } else {
              afternoonStatus = 'none'
            }
          } else {
            afternoonStatus = 'none'
          }
        }
      }

      days[day.toString()] = {
        morning: morningStatus,
        afternoon: afternoonStatus,
      }
    }

    return {
      email: emp.email,
      fullName: emp.fullName,
      days,
      totals: {
        onTime: totalOnTime,
        late: totalLate,
        missing: totalMissing,
      },
    }
  })

  return { success: true, matrix, totalDays: totalDaysInMonth }
}
