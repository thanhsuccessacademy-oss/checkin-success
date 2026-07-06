'use server'

import { getSession } from '@/lib/auth'
import { getSheet } from '@/lib/googleSheets'
import { extractCoordinates } from '@/lib/utils/maps'
import { revalidatePath } from 'next/cache'

export async function updateSettingsAction(
  mapsUrl: string,
  radiusMeters: number,
  morningStart: string,
  morningLate: string,
  morningEnd: string,
  afternoonStart: string,
  afternoonLate: string,
  afternoonEnd: string
) {
  // 1. Verify admin session
  const session = await getSession()
  if (!session) {
    return { error: 'Chưa đăng nhập' }
  }

  if (session.role !== 'admin') {
    return { error: 'Bạn không có quyền thực hiện hành động này' }
  }

  // 2. Extract coordinates
  const coords = await extractCoordinates(mapsUrl)
  if (!coords) {
    return {
      error:
        'Không thể trích xuất tọa độ GPS từ URL. Vui lòng sử dụng URL chứa vị trí (dạng @lat,lng) hoặc URL rút gọn (maps.app.goo.gl).',
    }
  }

  // 3. Update "CauHinh" tab in Google Sheets
  try {
    const configSheet = await getSheet('CauHinh')
    const rows = await configSheet.getRows()

    if (rows.length === 0) {
      const payload: Record<string, string> = {
        Maps_URL: mapsUrl,
        Latitude: coords.latitude.toString(),
        Longitude: coords.longitude.toString(),
        Morning_Start: morningStart,
        Morning_Late: morningLate,
        Morning_End: morningEnd,
        Afternoon_Start: afternoonStart,
        Afternoon_Late: afternoonLate,
        Afternoon_End: afternoonEnd,
      }
      if (configSheet.headerValues.includes('Radius_Meters')) {
        payload.Radius_Meters = radiusMeters.toString()
      } else {
        payload.Radius = radiusMeters.toString()
      }
      await configSheet.addRow(payload)
    } else {
      const row = rows[0]
      row.set('Maps_URL', mapsUrl)
      row.set('Latitude', coords.latitude.toString())
      row.set('Longitude', coords.longitude.toString())
      if (configSheet.headerValues.includes('Radius_Meters')) {
        row.set('Radius_Meters', radiusMeters.toString())
      } else {
        row.set('Radius', radiusMeters.toString())
      }
      row.set('Morning_Start', morningStart)
      row.set('Morning_Late', morningLate)
      row.set('Morning_End', morningEnd)
      row.set('Afternoon_Start', afternoonStart)
      row.set('Afternoon_Late', afternoonLate)
      row.set('Afternoon_End', afternoonEnd)
      await row.save()
    }
  } catch (error: any) {
    console.error('Failed to update CauHinh Google Sheet:', error)
    return { error: 'Không thể cập nhật cấu hình hệ thống trên Google Sheets.' }
  }

  revalidatePath('/dashboard')
  revalidatePath('/admin')

  return {
    success: true,
    latitude: coords.latitude,
    longitude: coords.longitude,
  }
}

export async function createEmployeeAccount(prevState: any, formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('fullName') as string

  if (!email || !password || !fullName) {
    return { error: 'Vui lòng điền đầy đủ thông tin nhân viên' }
  }

  if (password.length < 6) {
    return { error: 'Mật khẩu nhân viên phải chứa ít nhất 6 ký tự' }
  }

  // 1. Authenticate caller and verify they are an admin
  const session = await getSession()
  if (!session) {
    return { error: 'Chưa đăng nhập hoặc phiên làm việc đã hết hạn' }
  }

  if (session.role !== 'admin') {
    return { error: 'Không có quyền tạo tài khoản nhân viên' }
  }

  // 2. Access "NhanVien" tab and check duplicate email
  try {
    const employeeSheet = await getSheet('NhanVien')
    const rows = await employeeSheet.getRows()

    const exists = rows.some(
      (row) => row.get('Email')?.trim().toLowerCase() === email.trim().toLowerCase()
    )

    if (exists) {
      return { error: 'Email này đã tồn tại trong danh sách nhân viên' }
    }

    // 3. Append user to sheet
    await employeeSheet.addRow({
      Email: email.trim().toLowerCase(),
      Password: password.trim(),
      FullName: fullName.trim(),
      Role: 'employee',
    })
  } catch (error: any) {
    console.error('Failed to add employee account to Google Sheets:', error)
    return { error: error.message || 'Lỗi lưu thông tin nhân sự vào Google Sheets.' }
  }

  revalidatePath('/admin')
  return { success: `Tạo tài khoản nhân viên "${fullName}" thành công!` }
}

export async function getScheduleExceptions(email: string) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return { error: 'Không có quyền truy cập thông tin này' }
  }

  try {
    const sheet = await getSheet('NgoaiLeLichLam')
    const rows = await sheet.getRows()

    const exceptions: Record<string, { type: 'event' | 'comp_off'; note: string }> = {}
    rows.forEach((row) => {
      const rowEmail = row.get('Email')?.trim().toLowerCase()
      if (rowEmail === email.trim().toLowerCase()) {
        const dateStr = row.get('Date')?.trim()
        const typeVal = row.get('Type')?.trim() as 'event' | 'comp_off'
        const noteVal = row.get('Note')?.trim() || ''
        if (dateStr && (typeVal === 'event' || typeVal === 'comp_off')) {
          exceptions[dateStr] = { type: typeVal, note: noteVal }
        }
      }
    })

    return { success: true, exceptions }
  } catch (error: any) {
    console.error('Failed to get exceptions from Google Sheets:', error)
    return { error: 'Không thể tải lịch trình ngoại lệ.' }
  }
}

export async function setScheduleException(
  email: string,
  dateStr: string,
  type: 'event' | 'comp_off' | 'clear',
  note: string = ''
) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return { error: 'Không có quyền thực hiện hành động này' }
  }

  try {
    const sheet = await getSheet('NgoaiLeLichLam')
    const rows = await sheet.getRows()

    const existingRow = rows.find(
      (row) =>
        row.get('Email')?.trim().toLowerCase() === email.trim().toLowerCase() &&
        row.get('Date')?.trim() === dateStr.trim()
    )

    if (type === 'clear') {
      if (existingRow) {
        await existingRow.delete()
      }
    } else {
      if (existingRow) {
        existingRow.set('Type', type)
        existingRow.set('Note', note)
        await existingRow.save()
      } else {
        await sheet.addRow({
          Email: email.trim().toLowerCase(),
          Date: dateStr.trim(),
          Type: type,
          Note: note,
        })
      }
    }
  } catch (error: any) {
    console.error('Failed to update exception in Google Sheets:', error)
    return { error: 'Không thể cập nhật ngoại lệ lịch trình trên Google Sheets.' }
  }

  revalidatePath('/dashboard')
  revalidatePath('/admin')
  return { success: true }
}
