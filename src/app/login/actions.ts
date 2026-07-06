'use server'

import { getSheet } from '@/lib/googleSheets'
import { setSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'

export async function login(prevState: any, formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Vui lòng điền đầy đủ email và mật khẩu' }
  }

  let rows
  try {
    const sheet = await getSheet('NhanVien')
    rows = await sheet.getRows()
  } catch (error: any) {
    console.error('Failed to load employee sheet:', error)
    return { error: error.message || 'Lỗi kết nối cơ sở dữ liệu (Google Sheets)' }
  }

  // Find user in rows by email
  const employeeRow = rows.find(
    (row) => row.get('Email')?.trim().toLowerCase() === email.trim().toLowerCase()
  )

  if (!employeeRow) {
    return { error: 'Email hoặc mật khẩu không chính xác' }
  }

  const storedPassword = (employeeRow.get('Password') || '').toString().trim()

  // 1. Plain Text Check
  const isPlainTextMatch = storedPassword === password.trim()

  // 2. Hash Check
  const isHashMatch = !isPlainTextMatch && bcrypt.compareSync(password.trim(), storedPassword)

  if (!isPlainTextMatch && !isHashMatch) {
    return { error: 'Email hoặc mật khẩu không chính xác' }
  }

  // 3. Auto-Hashing Migration: hash and save back to sheet if it was plain text
  if (isPlainTextMatch) {
    try {
      const hashedPassword = bcrypt.hashSync(password.trim(), 10)
      employeeRow.set('Password', hashedPassword)
      await employeeRow.save()
    } catch (saveError) {
      console.error('Failed to auto-hash and save employee password:', saveError)
    }
  }

  const role = (employeeRow.get('Role') || 'employee').trim().toLowerCase() as 'admin' | 'employee' | 'hanhchinh'
  const fullName = employeeRow.get('FullName') || 'Nhân viên'

  // Encrypt and set HTTP-only session cookie
  await setSession({
    email: email.trim().toLowerCase(),
    fullName,
    role,
  })

  if (role === 'admin') {
    redirect('/admin')
  } else if (role === 'hanhchinh') {
    redirect('/hr')
  } else {
    redirect('/dashboard')
  }
}
