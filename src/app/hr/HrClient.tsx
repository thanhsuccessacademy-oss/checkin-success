'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { getTimesheetMatrix } from './actions'
import { signOutEmployee } from '../dashboard/actions'
import { Button } from '@/components/ui/button'
import { SuperadminNav } from '@/components/SuperadminNav'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import {
  FileDown,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Clock,
  Calendar,
  Grid,
  Users,
  AlertCircle,
  HelpCircle,
} from 'lucide-react'

interface UserTimesheet {
  email: string
  fullName: string
  days: Record<string, { morning: string; afternoon: string }>
  totals: {
    onTime: number
    late: number
    missing: number
  }
}

interface HrClientProps {
  role: string
  initialMatrix: UserTimesheet[]
  initialYear: number
  initialMonth: number
  initialTotalDays: number
}

export default function HrClient({
  role,
  initialMatrix,
  initialYear,
  initialMonth,
  initialTotalDays,
}: HrClientProps) {
  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth)
  const [matrix, setMatrix] = useState<UserTimesheet[]>(initialMatrix)
  const [totalDays, setTotalDays] = useState(initialTotalDays)
  const [isPending, startTransition] = useTransition()

  // Year list selection
  const years = [2026, 2027, 2028]
  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  const handlePeriodChange = (selectedYear: number, selectedMonth: number) => {
    setYear(selectedYear)
    setMonth(selectedMonth)

    startTransition(async () => {
      try {
        const res = await getTimesheetMatrix(selectedYear, selectedMonth)
        if (res.error) {
          toast.error(res.error)
        } else if (res.success && res.matrix && res.totalDays) {
          setMatrix(res.matrix)
          setTotalDays(res.totalDays)
        }
      } catch (err) {
        toast.error('Lỗi tải bảng công thời gian')
      }
    })
  }

  const handlePrevMonth = () => {
    let nextMonth = month - 1
    let nextYear = year
    if (nextMonth < 1) {
      nextMonth = 12
      nextYear = year - 1
    }
    if (years.includes(nextYear)) {
      handlePeriodChange(nextYear, nextMonth)
    }
  }

  const handleNextMonth = () => {
    let nextMonth = month + 1
    let nextYear = year
    if (nextMonth > 12) {
      nextMonth = 1
      nextYear = year + 1
    }
    if (years.includes(nextYear)) {
      handlePeriodChange(nextYear, nextMonth)
    }
  }

  // Format cell shift code to Vietnamese string for visual display
  const formatShiftStatus = (status: string) => {
    switch (status) {
      case 'on_time':
        return 'Đúng giờ'
      case 'late':
        return 'Trễ giờ'
      case 'missing':
        return 'Vắng mặt'
      case 'comp_off':
        return 'Nghỉ bù/Phép'
      case 'off':
        return 'Nghỉ'
      default:
        return 'N/A'
    }
  }

  // Client-side Excel .xlsx generator
  const exportToExcel = async () => {
    if (matrix.length === 0) {
      toast.error('Không có dữ liệu để xuất file')
      return
    }

    try {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Bảng Công')

      // Set frozen view pane
      worksheet.views = [{ state: 'frozen', xSplit: 2, ySplit: 1 }]

      // 1. Build Headers
      const daysHeaders = Array.from({ length: totalDays }, (_, i) => (i + 1).toString().padStart(2, '0'))
      const headers = ['Nhân viên', 'Ca làm', ...daysHeaders, 'Đúng giờ', 'Đi trễ', 'Vắng']

      const headerRow = worksheet.addRow(headers)
      headerRow.font = { bold: true, color: { argb: 'FF1E293B' } }
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' }

      // Header styles (slate bg with thin borders)
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF1F5F9' },
        }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        }
      })

      // Width sizes configuration
      worksheet.getColumn(1).width = 25
      worksheet.getColumn(2).width = 12
      for (let i = 3; i <= 3 + totalDays - 1; i++) {
        worksheet.getColumn(i).width = 7
      }
      const colOnTime = 3 + totalDays
      const colLate = colOnTime + 1
      const colMissing = colOnTime + 2

      worksheet.getColumn(colOnTime).width = 12
      worksheet.getColumn(colLate).width = 12
      worksheet.getColumn(colMissing).width = 12

      const getStatusText = (status: string) => {
        switch (status) {
          case 'on_time':
            return 'Đúng giờ'
          case 'late':
            return 'Trễ'
          case 'missing':
            return 'Vắng'
          case 'comp_off':
            return 'Nghỉ bù'
          case 'off':
            return 'Nghỉ'
          default:
            return '-'
        }
      }

      const getStatusColors = (status: string) => {
        switch (status) {
          case 'on_time':
            return { bg: 'FF22C55E', text: 'FFFFFFFF' } // Green background
          case 'late':
            return { bg: 'FFEAB308', text: 'FF1E293B' } // Yellow background
          case 'missing':
            return { bg: 'FFEF4444', text: 'FFFFFFFF' } // Red background
          case 'comp_off':
            return { bg: 'FF64748B', text: 'FFFFFFFF' } // Slate background
          case 'off':
            return { bg: 'FFF1F5F9', text: 'FF94A3B8' } // Off day bg
          default:
            return null
        }
      }

      // Append user rows
      matrix.forEach((user, userIdx) => {
        const row1Idx = 2 + userIdx * 2
        const row2Idx = 3 + userIdx * 2

        const morningRowData = [
          user.fullName,
          'Ca Sáng',
          ...Array.from({ length: totalDays }, (_, i) => {
            const dayNum = (i + 1).toString()
            const dayData = user.days[dayNum] || { morning: 'none', afternoon: 'none' }
            return getStatusText(dayData.morning)
          }),
          user.totals.onTime,
          user.totals.late,
          user.totals.missing,
        ]

        const afternoonRowData = [
          user.fullName,
          'Ca Chiều',
          ...Array.from({ length: totalDays }, (_, i) => {
            const dayNum = (i + 1).toString()
            const dayData = user.days[dayNum] || { morning: 'none', afternoon: 'none' }
            return getStatusText(dayData.afternoon)
          }),
          user.totals.onTime,
          user.totals.late,
          user.totals.missing,
        ]

        worksheet.addRow(morningRowData)
        worksheet.addRow(afternoonRowData)

        // Merge Name Columns A
        worksheet.mergeCells(`A${row1Idx}:A${row2Idx}`)
        const nameCell = worksheet.getCell(`A${row1Idx}`)
        nameCell.alignment = { vertical: 'middle', horizontal: 'left' }
        nameCell.font = { bold: true }

        // Merge Statistics columns
        worksheet.mergeCells(row1Idx, colOnTime, row2Idx, colOnTime)
        worksheet.mergeCells(row1Idx, colLate, row2Idx, colLate)
        worksheet.mergeCells(row1Idx, colMissing, row2Idx, colMissing)

        const totalOnTimeCell = worksheet.getCell(row1Idx, colOnTime)
        totalOnTimeCell.alignment = { vertical: 'middle', horizontal: 'center' }
        totalOnTimeCell.font = { bold: true, color: { argb: 'FF10B981' } }

        const totalLateCell = worksheet.getCell(row1Idx, colLate)
        totalLateCell.alignment = { vertical: 'middle', horizontal: 'center' }
        totalLateCell.font = { bold: true, color: { argb: 'FFF59E0B' } }

        const totalMissingCell = worksheet.getCell(row1Idx, colMissing)
        totalMissingCell.alignment = { vertical: 'middle', horizontal: 'center' }
        totalMissingCell.font = { bold: true, color: { argb: 'FFEF4444' } }

        worksheet.getCell(`B${row1Idx}`).alignment = { horizontal: 'center' }
        worksheet.getCell(`B${row2Idx}`).alignment = { horizontal: 'center' }

        // Style day cells for morning shift
        for (let i = 1; i <= totalDays; i++) {
          const cellCol = 2 + i
          const cell = worksheet.getCell(row1Idx, cellCol)
          cell.alignment = { horizontal: 'center', vertical: 'middle' }

          const dayData = user.days[i.toString()] || { morning: 'none', afternoon: 'none' }
          const colors = getStatusColors(dayData.morning)
          if (colors) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: colors.bg },
            }
            cell.font = { color: { argb: colors.text }, bold: true, size: 9 }
          }
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          }
        }

        // Style day cells for afternoon shift
        for (let i = 1; i <= totalDays; i++) {
          const cellCol = 2 + i
          const cell = worksheet.getCell(row2Idx, cellCol)
          cell.alignment = { horizontal: 'center', vertical: 'middle' }

          const dayData = user.days[i.toString()] || { morning: 'none', afternoon: 'none' }
          const colors = getStatusColors(dayData.afternoon)
          if (colors) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: colors.bg },
            }
            cell.font = { color: { argb: colors.text }, bold: true, size: 9 }
          }
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          }
        }

        // Apply borders for main column lines
        const colsToBorder = [1, 2, colOnTime, colLate, colMissing]
        colsToBorder.forEach((colIdx) => {
          worksheet.getCell(row1Idx, colIdx).border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          }
          worksheet.getCell(row2Idx, colIdx).border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          }
        })
      })

      // Write and save to xlsx file download
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      saveAs(blob, `Bang_Cham_Cong_Thang_${month.toString().padStart(2, '0')}_${year}.xlsx`)

      toast.success('Báo cáo Excel đã được tải xuống thành công!')
    } catch (err) {
      console.error('Failed to export XLSX:', err)
      toast.error('Lỗi khi xuất bảng công Excel.')
    }
  }

  const getBgClass = (status: string) => {
    switch (status) {
      case 'on_time':
        return 'bg-emerald-500'
      case 'late':
        return 'bg-amber-500'
      case 'missing':
        return 'bg-rose-500'
      case 'comp_off':
        return 'bg-slate-400'
      case 'off':
        return 'bg-slate-100'
      default:
        return 'bg-slate-50'
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground">
      {/* Top Header */}
      <header className="border-b border-slate-200/80 bg-white/70 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image
              src="/logo-success.png"
              alt="Success Academy Logo"
              width={120}
              height={40}
              className="object-contain"
              priority
            />
          </div>

          {role === 'superadmin' && <SuperadminNav />}

          <div className="flex items-center gap-4">
            <span className="text-xs text-indigo-650 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full font-medium">
              HR Module
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOutEmployee()}
              className="text-slate-500 hover:text-rose-600 hover:bg-rose-50 gap-2 transition-all cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>Đăng xuất</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 space-y-6">
        {/* Filtering & Actions bar */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-white p-4 border border-slate-200 rounded-xl shadow-sm">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrevMonth}
              disabled={isPending}
              className="border-slate-200 text-slate-550 hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* Selectors */}
            <div className="flex gap-2">
              <select
                value={month}
                onChange={(e) => handlePeriodChange(year, parseInt(e.target.value))}
                disabled={isPending}
                className="bg-white border border-slate-200 text-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer font-semibold"
              >
                {months.map((m) => (
                  <option key={m} value={m}>
                    Tháng {m.toString().padStart(2, '0')}
                  </option>
                ))}
              </select>

              <select
                value={year}
                onChange={(e) => handlePeriodChange(parseInt(e.target.value), month)}
                disabled={isPending}
                className="bg-white border border-slate-200 text-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer font-semibold"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    Năm {y}
                  </option>
                ))}
              </select>
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={handleNextMonth}
              disabled={isPending}
              className="border-slate-200 text-slate-550 hover:bg-slate-50"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex gap-3 w-full md:w-auto">
            <Button
              onClick={exportToExcel}
              disabled={isPending || matrix.length === 0}
              className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-500 text-white gap-2 shadow-md shadow-emerald-600/10 cursor-pointer"
            >
              <FileDown className="h-4 w-4" /> Xuất File Excel
            </Button>
          </div>
        </div>

        {/* Excel Timesheet Grid */}
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-800 flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-500" /> Bảng Công Tổng Hợp Nhân Viên
            </CardTitle>
            <CardDescription className="text-slate-500 text-xs">
              Mỗi cột ngày biểu diễn 2 ca (Nửa trên: Sáng, Nửa dưới: Chiều). Nhấp kéo ngang để xem toàn bộ tháng.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isPending ? (
              <div className="p-20 text-center flex flex-col items-center gap-3">
                <span className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
                <span className="text-sm text-slate-400">Đang đồng bộ bảng công thời gian...</span>
              </div>
            ) : matrix.length === 0 ? (
              <div className="p-20 text-center text-slate-500">Không có danh sách nhân sự chấm công.</div>
            ) : (
              <div className="w-full overflow-x-auto">
                <Table className="min-w-[1200px]">
                  <TableHeader className="bg-slate-50/80 border-b border-slate-200">
                    <TableRow className="border-slate-200 hover:bg-transparent">
                      {/* Sticky Employee Name Header */}
                      <TableHead className="sticky left-0 bg-slate-50 z-20 text-slate-600 text-xs font-semibold w-[200px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r border-slate-200/80">
                        Nhân viên
                      </TableHead>
                      
                      {Array.from({ length: totalDays }, (_, i) => (
                        <TableHead key={i} className="text-slate-500 text-[10px] text-center w-[45px] min-w-[45px] p-1 font-medium">
                          {(i + 1).toString().padStart(2, '0')}
                        </TableHead>
                      ))}

                      <TableHead className="text-slate-650 text-xs font-semibold text-center w-[80px]">Đúng giờ</TableHead>
                      <TableHead className="text-slate-650 text-xs font-semibold text-center w-[80px]">Đi trễ</TableHead>
                      <TableHead className="text-slate-650 text-xs font-semibold text-center w-[80px]">Vắng ca</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matrix.map((row) => (
                      <TableRow key={row.email} className="border-slate-100 hover:bg-slate-50/30">
                        {/* Sticky Name Column */}
                        <TableCell className="sticky left-0 bg-white z-10 text-slate-800 w-[200px] py-4 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] border-r border-slate-200/80">
                          <div className="font-semibold text-xs leading-none text-slate-800">{row.fullName}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-1.5 leading-none truncate max-w-[180px]" title={row.email}>
                            {row.email}
                          </div>
                        </TableCell>

                        {/* 1..31 Day Cells */}
                        {Array.from({ length: totalDays }, (_, i) => {
                          const dayNum = (i + 1).toString()
                          const dayData = row.days[dayNum] || { morning: 'none', afternoon: 'none' }

                          return (
                            <TableCell key={i} className="p-1.5 align-middle text-center w-[45px]">
                              <div className="inline-flex flex-col h-7 w-5 rounded overflow-hidden border border-slate-200 bg-slate-50">
                                <div className={`h-1/2 w-full ${getBgClass(dayData.morning)}`} title={`Sáng: ${formatShiftStatus(dayData.morning)}`} />
                                <div className={`h-1/2 w-full ${getBgClass(dayData.afternoon)}`} title={`Chiều: ${formatShiftStatus(dayData.afternoon)}`} />
                              </div>
                            </TableCell>
                          )
                        })}

                        {/* Summary metrics columns */}
                        <TableCell className="text-center font-bold text-xs text-emerald-600">{row.totals.onTime} ca</TableCell>
                        <TableCell className="text-center font-bold text-xs text-amber-600">{row.totals.late} ca</TableCell>
                        <TableCell className="text-center font-bold text-xs text-rose-600">{row.totals.missing} ca</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Legend explains indicators */}
        <div className="flex flex-wrap gap-x-6 gap-y-3 justify-center text-xs text-slate-600 bg-slate-50 border border-slate-200 p-4 rounded-xl">
          <div className="flex items-center gap-2">
            <div className="h-3 w-4 rounded-sm bg-emerald-500" /> <span>Đúng giờ</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-4 rounded-sm bg-amber-500" /> <span>Đi trễ</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-4 rounded-sm bg-rose-500" /> <span>Vắng/Không chấm</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-4 rounded-sm bg-slate-400" /> <span>Nghỉ bù/Phép</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-4 rounded-sm bg-slate-100 border border-slate-200" /> <span>Ngày nghỉ / Cuối tuần</span>
          </div>
        </div>
      </main>
    </div>
  )
}
