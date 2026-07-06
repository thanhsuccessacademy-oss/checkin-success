'use server'

import { getSession, deleteSession } from '@/lib/auth'
import { getSheet } from '@/lib/googleSheets'
import { checkShiftTime } from '@/lib/utils/time'
import { getDistanceHaversine } from '@/lib/utils/geo'
import { revalidatePath, unstable_noStore as noStore } from 'next/cache'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'

export async function checkInEmployee(lat: number, lng: number) {
  noStore()
  const serverTime = new Date()

  // 1. Fetch current session
  const session = await getSession()
  if (!session) {
    return { error: 'Phiên làm việc hết hạn. Vui lòng đăng nhập lại.' }
  }

  // 2. Fetch system settings from "CauHinh" tab
  let configRow
  try {
    const configSheet = await getSheet('CauHinh')
    const rows = await configSheet.getRows()
    configRow = rows[0]
  } catch (error: any) {
    console.error('Failed to load CauHinh tab:', error)
    return { error: 'Không thể tải cấu hình từ Google Sheets. Liên hệ Admin.' }
  }

  if (!configRow) {
    return { error: 'Thiếu cấu hình hệ thống. Vui lòng liên hệ Admin.' }
  }

  const officeLat = parseFloat(configRow.get('Latitude') || '0')
  const officeLng = parseFloat(configRow.get('Longitude') || '0')
  const radiusMeters = parseInt(configRow.get('Radius') || configRow.get('Radius_Meters') || '100', 10)

  const config = {
    morningStart: configRow.get('Morning_Start') || '07:30',
    morningLate: configRow.get('Morning_Late') || '07:56',
    morningEnd: configRow.get('Morning_End') || '08:30',
    afternoonStart: configRow.get('Afternoon_Start') || '13:00',
    afternoonLate: configRow.get('Afternoon_Late') || '13:26',
    afternoonEnd: configRow.get('Afternoon_End') || '14:00',
  }

  // 3. Verify shift time window strictly on the server using dynamic config
  const shiftCheck = checkShiftTime(serverTime, config)
  if (!shiftCheck.eligible || !shiftCheck.shift || !shiftCheck.status) {
    return { error: shiftCheck.message || 'Hiện tại không nằm trong khung giờ check-in hợp lệ' }
  }

  // 4. Calculate distance using Haversine formula
  const distance = getDistanceHaversine(lat, lng, officeLat, officeLng)

  if (distance > radiusMeters) {
    return {
      error: `Bạn đang ở quá xa văn phòng (Cách: ${Math.round(distance)}m. Tối đa cho phép: ${radiusMeters}m)`,
    }
  }

  // 5. Append check-in record to "Log_Checkin" tab
  try {
    const logSheet = await getSheet('Log_Checkin')
    await logSheet.addRow({
      Time: serverTime.toISOString(),
      FullName: session.fullName,
      Email: session.email,
      Shift: shiftCheck.shift,
      Status: shiftCheck.status,
      Lat: lat.toString(),
      Lng: lng.toString(),
    })
  } catch (error: any) {
    console.error('Failed to write log to Google Sheets:', error)
    return { error: 'Gặp lỗi trong quá trình lưu check-in vào Google Sheets.' }
  }

  revalidatePath('/dashboard')
  revalidatePath('/admin')

  return {
    success: true,
    shift: shiftCheck.shift,
    status: shiftCheck.status,
    distance: Math.round(distance),
  }
}

export async function signOutEmployee() {
  await deleteSession()
  redirect('/login')
}

export async function changePassword(prevState: any, formData: FormData) {
  const oldPassword = formData.get('oldPassword') as string
  const newPassword = formData.get('newPassword') as string

  if (!oldPassword || !newPassword) {
    return { error: 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới' }
  }

  if (newPassword.length < 6) {
    return { error: 'Mật khẩu mới phải chứa ít nhất 6 ký tự' }
  }

  const session = await getSession()
  if (!session) {
    return { error: 'Phiên làm việc hết hạn. Vui lòng đăng nhập lại.' }
  }

  try {
    const sheet = await getSheet('NhanVien')
    const rows = await sheet.getRows()

    const employeeRow = rows.find(
      (row) => row.get('Email')?.trim().toLowerCase() === session.email.toLowerCase()
    )

    if (!employeeRow) {
      return { error: 'Không tìm thấy tài khoản nhân sự phù hợp.' }
    }

    const storedPassword = (employeeRow.get('Password') || '').toString().trim()

    // Check old password against plain text or hashed value
    const isPlainTextMatch = storedPassword === oldPassword.trim()
    const isHashMatch = !isPlainTextMatch && bcrypt.compareSync(oldPassword.trim(), storedPassword)

    if (!isPlainTextMatch && !isHashMatch) {
      return { error: 'Mật khẩu hiện tại không chính xác' }
    }

    // Encrypt new password using bcrypt
    const hashedPassword = bcrypt.hashSync(newPassword.trim(), 10)
    employeeRow.set('Password', hashedPassword)
    await employeeRow.save()
  } catch (error: any) {
    console.error('Failed to change password in Google Sheets:', error)
    return { error: 'Không thể cập nhật mật khẩu mới trên Google Sheets.' }
  }

  return { success: 'Đổi mật khẩu thành công!' }
}

export async function getMonthlyCheckins() {
  noStore()
  const session = await getSession()
  if (!session) {
    return { error: 'Chưa đăng nhập hoặc phiên làm việc đã hết hạn' }
  }

  // 1. Fetch system settings for check-in deadlines
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
    console.error('Error loading config sheet in getMonthlyCheckins:', error)
  }

  // 2. Fetch all check-in logs
  let rows = []
  try {
    const logSheet = await getSheet('Log_Checkin')
    rows = await logSheet.getRows()
  } catch (error) {
    console.error('Error loading checkin logs in getMonthlyCheckins:', error)
    return { error: 'Không thể kết nối cơ sở dữ liệu để lấy lịch sử tháng.' }
  }

  // Fetch exceptions from "NgoaiLeLichLam" for this user
  const exceptionsMap: Record<string, 'event' | 'comp_off'> = {}
  try {
    const exceptSheet = await getSheet('NgoaiLeLichLam')
    const exceptRows = await exceptSheet.getRows()
    exceptRows.forEach((row) => {
      const email = row.get('Email')?.trim().toLowerCase()
      if (email === session.email.toLowerCase()) {
        const dateStr = row.get('Date')?.trim()
        const typeStr = row.get('Type')?.trim() as 'event' | 'comp_off'
        if (dateStr && (typeStr === 'event' || typeStr === 'comp_off')) {
          exceptionsMap[dateStr] = typeStr
        }
      }
    })
  } catch (error) {
    console.error('Error loading schedule exceptions:', error)
  }

  // Determine current month in VN timezone
  const now = new Date()
  const vnTimeStr = now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' })
  const vnDate = new Date(vnTimeStr)
  const currentYear = vnDate.getFullYear()
  const currentMonth = vnDate.getMonth() // 0-11
  const todayDateNum = vnDate.getDate()

  const monthPrefix = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}`

  // Map of YYYY-MM-DD -> { morning?: status, afternoon?: status }
  const checkInsMap: Record<string, { morning?: string; afternoon?: string }> = {}

  rows.forEach((row) => {
    const email = row.get('Email')?.trim().toLowerCase()
    if (email !== session.email.toLowerCase()) return

    const timeStr = row.get('Time')
    if (!timeStr) return

    const logDate = new Date(timeStr)
    const logVnTimeStr = logDate.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' })
    const logVnDate = new Date(logVnTimeStr)

    if (logVnDate.getFullYear() === currentYear && logVnDate.getMonth() === currentMonth) {
      const dayStr = logVnDate.getDate().toString().padStart(2, '0')
      const fullDateStr = `${monthPrefix}-${dayStr}`
      const shift = row.get('Shift')
      const status = row.get('Status')

      if (!checkInsMap[fullDateStr]) {
        checkInsMap[fullDateStr] = {}
      }

      if (shift === 'morning') {
        checkInsMap[fullDateStr].morning = status
      } else if (shift === 'afternoon') {
        checkInsMap[fullDateStr].afternoon = status
      }
    }
  })

  // 3. Populate calendars and calculate metrics for current month
  let totalOnTime = 0
  let totalLate = 0
  let totalMissing = 0

  const calendarData: Record<string, { morning: string; afternoon: string }> = {}

  // Parse time thresholds
  const [mEndH, mEndM] = settings.morning_end.split(':').map(Number)
  const [aEndH, aEndM] = settings.afternoon_end.split(':').map(Number)
  const currentMinutesVal = vnDate.getHours() * 60 + vnDate.getMinutes()

  const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()

  for (let day = 1; day <= totalDaysInMonth; day++) {
    const dayStr = day.toString().padStart(2, '0')
    const fullDateStr = `${monthPrefix}-${dayStr}`

    const dateObj = new Date(currentYear, currentMonth, day)
    const dayOfWeek = dateObj.getDay()
    const exceptionType = exceptionsMap[fullDateStr]

    // Mon-Sat are workdays. Sunday is default off.
    const isDefaultOff = dayOfWeek === 0
    let isOffDay = isDefaultOff

    if (isDefaultOff) {
      if (exceptionType === 'event') {
        isOffDay = false // Sun is event workday
      }
    } else {
      if (exceptionType === 'comp_off') {
        isOffDay = true // Weekday is compensatory day off
      }
    }

    const dayCheckins = checkInsMap[fullDateStr] || {}
    let morningStatus = 'none'
    let afternoonStatus = 'none'

    // Evaluate Morning Shift
    if (dayCheckins.morning) {
      morningStatus = dayCheckins.morning
      if (morningStatus === 'on_time') totalOnTime++
      else if (morningStatus === 'late') totalLate++
    } else {
      if (isOffDay) {
        morningStatus = exceptionType === 'comp_off' ? 'comp_off' : 'off'
      } else {
        if (day < todayDateNum) {
          morningStatus = 'missing'
          totalMissing++
        } else if (day === todayDateNum) {
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
    if (dayCheckins.afternoon) {
      afternoonStatus = dayCheckins.afternoon
      if (afternoonStatus === 'on_time') totalOnTime++
      else if (afternoonStatus === 'late') totalLate++
    } else {
      if (isOffDay) {
        afternoonStatus = exceptionType === 'comp_off' ? 'comp_off' : 'off'
      } else {
        if (day < todayDateNum) {
          afternoonStatus = 'missing'
          totalMissing++
        } else if (day === todayDateNum) {
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

    calendarData[fullDateStr] = {
      morning: morningStatus,
      afternoon: afternoonStatus,
    }
  }

  return {
    success: true,
    calendarData,
    exceptions: exceptionsMap,
    stats: {
      totalOnTime,
      totalLate,
      totalMissing,
    },
    monthPrefix,
  }
}
