'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import {
  updateSettingsAction,
  createEmployeeAccount,
  getScheduleExceptions,
  setScheduleException,
} from './actions'
import { signOutEmployee } from '../dashboard/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { getDistanceHaversine } from '@/lib/utils/geo'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Settings,
  History,
  MapPin,
  Compass,
  LogOut,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  UserPlus,
  Users,
  Clock,
  Calendar,
  KeyRound,
} from 'lucide-react'

interface AdminClientProps {
  settings: {
    maps_url: string
    latitude: number
    longitude: number
    radius_meters: number
    morning_start: string
    morning_late: string
    morning_end: string
    afternoon_start: string
    afternoon_late: string
    afternoon_end: string
  }
  checkIns: any[]
  employees: { email: string; fullName: string; role: string }[]
}

export default function AdminClient({ settings, checkIns, employees }: AdminClientProps) {
  const [mapsUrl, setMapsUrl] = useState(settings.maps_url)
  const [radius, setRadius] = useState(settings.radius_meters)
  const [coords, setCoords] = useState({ lat: settings.latitude, lng: settings.longitude })

  // Dynamic Shift States
  const [morningStart, setMorningStart] = useState(settings.morning_start)
  const [morningLate, setMorningLate] = useState(settings.morning_late)
  const [morningEnd, setMorningEnd] = useState(settings.morning_end)
  const [afternoonStart, setAfternoonStart] = useState(settings.afternoon_start)
  const [afternoonLate, setAfternoonLate] = useState(settings.afternoon_late)
  const [afternoonEnd, setAfternoonEnd] = useState(settings.afternoon_end)

  const [isPending, startTransition] = useTransition()

  // Employee creation state
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [empEmail, setEmpEmail] = useState('')
  const [empPassword, setEmpPassword] = useState('')
  const [empFullName, setEmpFullName] = useState('')

  // Schedule exception states
  const [isScheduleOpen, setIsScheduleOpen] = useState(false)
  const [selectedEmp, setSelectedEmp] = useState<{ email: string; fullName: string } | null>(null)
  const [empExceptions, setEmpExceptions] = useState<Record<string, { type: 'event' | 'comp_off'; note: string }>>({})
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false)
  const [activeConfigDay, setActiveConfigDay] = useState<number | null>(null)

  // Search & Filter state
  const [search, setSearch] = useState('')
  const [shiftFilter, setShiftFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault()

    if (!mapsUrl.trim() || !radius) {
      toast.error('Vui lòng nhập đầy đủ URL bản đồ và Bán kính')
      return
    }

    startTransition(async () => {
      try {
        const res = await updateSettingsAction(
          mapsUrl,
          radius,
          morningStart,
          morningLate,
          morningEnd,
          afternoonStart,
          afternoonLate,
          afternoonEnd
        )

        if (res.error) {
          toast.error(res.error)
        } else {
          toast.success('Lưu cấu hình thành công')
          if (res.latitude !== undefined && res.longitude !== undefined) {
            setCoords({ lat: res.latitude, lng: res.longitude })
          }
        }
      } catch (err: any) {
        toast.error(err.message || 'Lỗi hệ thống khi lưu cấu hình')
      }
    })
  }

  const handleCreateEmployee = (e: React.FormEvent) => {
    e.preventDefault()

    if (!empEmail.trim() || !empPassword.trim() || !empFullName.trim()) {
      toast.error('Vui lòng nhập đầy đủ thông tin nhân viên')
      return
    }

    startTransition(async () => {
      try {
        const formData = new FormData()
        formData.append('email', empEmail)
        formData.append('password', empPassword)
        formData.append('fullName', empFullName)

        const res = await createEmployeeAccount(null, formData)
        if (res.error) {
          toast.error(res.error)
        } else {
          toast.success('Tạo nhân viên mới thành công!')
          setIsCreateOpen(false)
          setEmpEmail('')
          setEmpPassword('')
          setEmpFullName('')
        }
      } catch (err: any) {
        toast.error(err.message || 'Lỗi hệ thống khi tạo tài khoản')
      }
    })
  }

  // Load schedule exceptions for user
  const handleOpenSchedule = async (email: string, fullName: string) => {
    setSelectedEmp({ email, fullName })
    setIsScheduleOpen(true)
    setIsLoadingSchedule(true)
    setActiveConfigDay(null)

    try {
      const res = await getScheduleExceptions(email)
      if (res.error) {
        toast.error(res.error)
      } else {
        setEmpExceptions(res.exceptions || {})
      }
    } catch (err) {
      toast.error('Lỗi khi tải lịch ngoại lệ')
    } finally {
      setIsLoadingSchedule(false)
    }
  }

  const handleSetDayException = async (dateStr: string, type: 'event' | 'comp_off' | 'clear') => {
    if (!selectedEmp) return

    try {
      const res = await setScheduleException(selectedEmp.email, dateStr, type)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Cập nhật lịch biểu thành công')
        // Refresh local exceptions state
        const updated = { ...empExceptions }
        if (type === 'clear') {
          delete updated[dateStr]
        } else {
          updated[dateStr] = { type, note: '' }
        }
        setEmpExceptions(updated)
      }
    } catch (err) {
      toast.error('Lỗi lưu cấu hình ngoại lệ')
    }
  }

  // Filtered check-ins logic
  const filteredCheckIns = checkIns.filter((item) => {
    const profile = item.profiles || { full_name: '', email: '' }
    const matchSearch =
      profile.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      profile.email?.toLowerCase().includes(search.toLowerCase())

    const matchShift = shiftFilter === 'all' || item.shift === shiftFilter
    const matchStatus = statusFilter === 'all' || item.status === statusFilter

    return matchSearch && matchShift && matchStatus
  })

  // Format date helper
  const formatDate = (isoString: string) => {
    const d = new Date(isoString)
    return d.toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  // Grid dates parameters
  const calendarNow = new Date()
  const currentMonthNum = calendarNow.getMonth() + 1
  const currentYearNum = calendarNow.getFullYear()
  const firstDay = new Date(currentYearNum, calendarNow.getMonth(), 1)
  const startWeekday = firstDay.getDay()
  const totalDays = new Date(currentYearNum, calendarNow.getMonth() + 1, 0).getDate()
  const monthPrefixStr = `${currentYearNum}-${currentMonthNum.toString().padStart(2, '0')}`

  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground">
      {/* Top Header */}
      <header className="border-b border-slate-200/80 bg-white/70 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
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

          <div className="flex items-center gap-4">
            <span className="text-xs text-indigo-650 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full font-medium">
              Admin Mode
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
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        <Tabs defaultValue="history" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-[500px] bg-slate-100 border border-slate-200 p-1 rounded-xl shadow-sm">
            <TabsTrigger
              value="history"
              className="rounded-lg gap-2 text-slate-500 data-[state=active]:bg-white data-[state=active]:text-indigo-650 data-[state=active]:shadow-sm text-xs sm:text-sm cursor-pointer font-medium"
            >
              <History className="h-4 w-4" /> Lịch sử
            </TabsTrigger>
            <TabsTrigger
              value="users"
              className="rounded-lg gap-2 text-slate-500 data-[state=active]:bg-white data-[state=active]:text-indigo-650 data-[state=active]:shadow-sm text-xs sm:text-sm cursor-pointer font-medium"
            >
              <Users className="h-4 w-4" /> Nhân sự
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="rounded-lg gap-2 text-slate-500 data-[state=active]:bg-white data-[state=active]:text-indigo-650 data-[state=active]:shadow-sm text-xs sm:text-sm cursor-pointer font-medium"
            >
              <Settings className="h-4 w-4" /> Cấu hình
            </TabsTrigger>
          </TabsList>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-white p-4 border border-slate-200/80 rounded-xl shadow-sm">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Tìm tên hoặc email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-indigo-500"
                />
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-3 w-full sm:w-auto">
                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
                  <span className="text-slate-500 font-medium">Ca:</span>
                  <select
                    value={shiftFilter}
                    onChange={(e) => setShiftFilter(e.target.value)}
                    className="bg-transparent text-slate-700 focus:outline-none border-none cursor-pointer font-semibold"
                  >
                    <option value="all">Tất cả ca</option>
                    <option value="morning">Ca Sáng</option>
                    <option value="afternoon">Ca Chiều</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
                  <span className="text-slate-500 font-medium">Trạng thái:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-transparent text-slate-700 focus:outline-none border-none cursor-pointer font-semibold"
                  >
                    <option value="all">Tất cả</option>
                    <option value="on_time">Đúng giờ</option>
                    <option value="late">Đi muộn</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Check-ins Table View */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              {filteredCheckIns.length === 0 ? (
                <div className="p-12 text-center text-slate-400">Không tìm thấy bản ghi check-in nào khớp bộ lọc.</div>
              ) : (
                <Table>
                  <TableHeader className="bg-slate-50/80 border-b border-slate-200">
                    <TableRow className="border-slate-200 hover:bg-transparent">
                      <TableHead className="text-slate-600 text-xs font-semibold">Nhân viên</TableHead>
                      <TableHead className="text-slate-600 text-xs font-semibold">Thời gian (VN)</TableHead>
                      <TableHead className="text-slate-600 text-xs font-semibold">Ca</TableHead>
                      <TableHead className="text-slate-600 text-xs font-semibold">Trạng thái</TableHead>
                      <TableHead className="text-slate-600 text-xs font-semibold">Sai lệch khoảng cách</TableHead>
                      <TableHead className="text-slate-600 text-xs font-semibold text-right">Hành động</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCheckIns.map((item) => {
                      const profile = item.profiles || { full_name: 'Ẩn danh', email: 'N/A' }
                      const distStr = item.distance_meters ? `${Math.round(item.distance_meters)}m` : '0m'
                      const isTooFar = item.distance_meters > settings.radius_meters

                      return (
                        <TableRow key={item.id} className="border-slate-100 hover:bg-slate-50/50">
                          <TableCell className="py-4">
                            <div className="font-semibold text-slate-800 text-xs">{profile.full_name}</div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{profile.email}</div>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-slate-600">
                            {formatDate(item.check_in_time)}
                          </TableCell>
                          <TableCell className="align-middle">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                item.shift === 'morning'
                                  ? 'bg-sky-50 text-sky-700 border border-sky-100'
                                  : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                              }`}
                            >
                              {item.shift === 'morning' ? 'Sáng' : 'Chiều'}
                            </span>
                          </TableCell>
                          <TableCell className="align-middle">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                item.status === 'on_time'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                  : 'bg-amber-50 text-amber-700 border border-amber-100'
                              }`}
                            >
                              {item.status === 'on_time' ? 'Đúng giờ' : 'Trễ ca'}
                            </span>
                          </TableCell>
                          <TableCell className="align-middle">
                            <span
                              className={`text-xs font-mono font-semibold ${
                                isTooFar ? 'text-rose-600' : 'text-slate-600'
                              }`}
                            >
                              {distStr}
                            </span>
                          </TableCell>
                          <TableCell className="text-right align-middle">
                            {item.lat && item.lng && (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] text-indigo-650 hover:underline font-semibold bg-indigo-50 border border-indigo-100 rounded-lg px-2.5 py-1 transition-colors"
                              >
                                Bản đồ <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>

          {/* Personnel Tab */}
          <TabsContent value="users" className="space-y-4">
            <div className="flex justify-between items-center bg-white p-4 border border-slate-200/85 rounded-xl shadow-sm">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Danh sách nhân sự ({employees.length})</h3>
                <p className="text-xs text-slate-450 mt-0.5">Quản lý lịch làm việc và tài khoản nhân sự nội bộ.</p>
              </div>

              {/* Create User Dialog Modal */}
              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger className="inline-flex items-center justify-center rounded-lg font-semibold bg-indigo-600 hover:bg-indigo-500 text-white text-xs gap-1.5 shadow-md shadow-indigo-500/10 h-9 px-3 transition-colors focus:outline-none focus:ring-1 focus:ring-slate-200 cursor-pointer">
                  <UserPlus className="h-4 w-4" /> Tạo Nhân Viên Mới
                </DialogTrigger>
                <DialogContent className="border-slate-200 bg-white text-slate-900 max-w-sm shadow-xl">
                  <DialogHeader>
                    <DialogTitle className="text-slate-850 text-base font-semibold">Tạo Tài khoản Nhân viên</DialogTitle>
                    <DialogDescription className="text-slate-500 text-xs">
                      Đăng ký nhân sự nội bộ trực tiếp vào Google Sheets.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateEmployee} className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label htmlFor="empFullName" className="text-slate-700">Họ và Tên</Label>
                      <Input
                        id="empFullName"
                        placeholder="Nguyễn Văn A"
                        value={empFullName}
                        onChange={(e) => setEmpFullName(e.target.value)}
                        required
                        disabled={isPending}
                        className="border-slate-200 bg-white text-slate-900 focus-visible:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="empEmail" className="text-slate-700">Email</Label>
                      <Input
                        id="empEmail"
                        type="email"
                        placeholder="a.nguyen@successacademy.edu.vn"
                        value={empEmail}
                        onChange={(e) => setEmpEmail(e.target.value)}
                        required
                        disabled={isPending}
                        className="border-slate-200 bg-white text-slate-900 focus-visible:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="empPassword" className="text-slate-700">Mật khẩu</Label>
                      <Input
                        id="empPassword"
                        type="password"
                        placeholder="••••••••"
                        value={empPassword}
                        onChange={(e) => setEmpPassword(e.target.value)}
                        required
                        disabled={isPending}
                        className="border-slate-200 bg-white text-slate-900 focus-visible:ring-indigo-500"
                      />
                    </div>
                    <DialogFooter className="pt-2">
                      <Button
                        type="submit"
                        disabled={isPending}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/10 text-xs cursor-pointer"
                      >
                        {isPending ? 'Đang khởi tạo...' : 'Tạo Tài Khoản'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-slate-50/80 border-b border-slate-200">
                  <TableRow className="border-slate-200 hover:bg-transparent">
                    <TableHead className="text-slate-600 text-xs font-semibold">Họ tên & Email</TableHead>
                    <TableHead className="text-slate-600 text-xs font-semibold">Vai trò</TableHead>
                    <TableHead className="text-slate-600 text-xs font-semibold text-right">Lịch biểu</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((emp) => (
                    <TableRow key={emp.email} className="border-slate-100 hover:bg-slate-50/50">
                      <TableCell className="py-4">
                        <div className="font-semibold text-slate-800 text-xs">{emp.fullName}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{emp.email}</div>
                      </TableCell>
                      <TableCell className="align-middle">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            emp.role === 'admin'
                              ? 'bg-rose-50 text-rose-700 border border-rose-100'
                              : 'bg-indigo-55/60 text-indigo-700 border border-indigo-100'
                          }`}
                        >
                          {emp.role === 'admin' ? 'Quản trị viên' : emp.role === 'hanhchinh' ? 'Trợ lý HR' : 'Nhân viên'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right align-middle">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenSchedule(emp.email, emp.fullName)}
                          className="text-xs border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                        >
                          <Calendar className="h-3.5 w-3.5 mr-1 text-slate-400" /> Quản lý Lịch
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Manage Exceptions Calendar Dialog */}
            <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
              <DialogContent className="border-slate-200 bg-white text-slate-900 max-w-sm overflow-hidden flex flex-col max-h-[90vh] shadow-xl">
                <DialogHeader className="pb-2 border-b border-slate-100">
                  <DialogTitle className="text-slate-850 text-base font-semibold">Lịch Trình: {selectedEmp?.fullName}</DialogTitle>
                  <DialogDescription className="text-slate-500 text-xs font-mono">
                    {selectedEmp?.email}
                  </DialogDescription>
                </DialogHeader>

                {isLoadingSchedule ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2">
                    <span className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
                    <span className="text-xs text-slate-500">Đang tải cấu hình lịch...</span>
                  </div>
                ) : (
                  <div className="space-y-4 py-2 overflow-y-auto pr-1">
                    {/* Calendar grid rendering for current month */}
                    <div className="text-xs font-semibold text-slate-600 text-center pb-1 uppercase tracking-wide">
                      Tháng {currentMonthNum} năm {currentYearNum}
                    </div>

                    <div className="grid grid-cols-7 gap-1.5 justify-items-center">
                      {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((d) => (
                        <div key={d} className="text-[10px] font-semibold text-slate-400 w-10 text-center uppercase">
                          {d}
                        </div>
                      ))}

                      {Array.from({ length: startWeekday }).map((_, i) => (
                        <div key={`empty-${i}`} className="w-10 h-10" />
                      ))}

                      {Array.from({ length: totalDays }).map((_, i) => {
                        const day = i + 1
                        const dayStr = day.toString().padStart(2, '0')
                        const dateKey = `${monthPrefixStr}-${dayStr}`
                        const exception = empExceptions[dateKey]

                        const getBgColor = () => {
                          if (exception) {
                            if (exception.type === 'event') return 'bg-violet-50 border-violet-300 text-violet-700 font-bold'
                            if (exception.type === 'comp_off') return 'bg-slate-100 border-slate-300 text-slate-700 font-bold'
                          }
                          // Default colors
                          const dateObj = new Date(currentYearNum, calendarNow.getMonth(), day)
                          const isSun = dateObj.getDay() === 0
                          return isSun ? 'bg-slate-50/50 border-slate-200 text-slate-400 font-normal' : 'bg-white border-slate-200 text-slate-700 font-medium'
                        }

                        return (
                          <button
                            key={day}
                            onClick={() => setActiveConfigDay(day)}
                            className={`relative h-10 w-10 flex items-center justify-center rounded-md border text-[10px] font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer ${getBgColor()}`}
                          >
                            {day}
                            {exception && (
                              <div
                                className={`absolute bottom-1 h-1.5 w-1.5 rounded-full ${
                                  exception.type === 'event' ? 'bg-violet-500' : 'bg-slate-400'
                                }`}
                              />
                            )}
                          </button>
                        )
                      })}
                    </div>

                    {/* Active Config Date menu selection */}
                    {activeConfigDay !== null && (
                      <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg space-y-2 shadow-inner">
                        <div className="text-[10px] font-semibold text-slate-600 flex justify-between">
                          <span>Thiết lập ngày {activeConfigDay}/{currentMonthNum}:</span>
                          <button onClick={() => setActiveConfigDay(null)} className="text-slate-500 hover:text-slate-800">Đóng</button>
                        </div>
                        <div className="grid grid-cols-3 gap-2 pt-1">
                          <Button
                            size="sm"
                            onClick={() => {
                              const dateKey = `${monthPrefixStr}-${activeConfigDay.toString().padStart(2, '0')}`
                              handleSetDayException(dateKey, 'event')
                              setActiveConfigDay(null)
                            }}
                            className="text-[9px] bg-purple-600 text-white hover:bg-purple-700 transition-colors px-1 py-1.5 h-auto leading-tight font-semibold cursor-pointer"
                          >
                            Trực sự kiện
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              const dateKey = `${monthPrefixStr}-${activeConfigDay.toString().padStart(2, '0')}`
                              handleSetDayException(dateKey, 'comp_off')
                              setActiveConfigDay(null)
                            }}
                            className="text-[9px] bg-slate-200 hover:bg-slate-300 px-1 py-1.5 h-auto text-slate-700 border border-slate-300 leading-tight font-semibold cursor-pointer"
                          >
                            Nghỉ bù/Phép
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              const dateKey = `${monthPrefixStr}-${activeConfigDay.toString().padStart(2, '0')}`
                              handleSetDayException(dateKey, 'clear')
                              setActiveConfigDay(null)
                            }}
                            className="text-[9px] bg-rose-50 hover:bg-rose-100 px-1 py-1.5 h-auto text-rose-700 border border-rose-200 leading-tight font-semibold cursor-pointer"
                          >
                            Xóa ngoại lệ
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Schedule Manager Legend */}
                    <div className="flex justify-center gap-4 text-[9px] text-slate-500 border-t border-slate-200 pt-3">
                      <div className="flex items-center gap-1">
                        <div className="h-2 w-2 rounded-full bg-violet-500" /> Trực sự kiện (Chủ Nhật)
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="h-2 w-2 rounded-full bg-slate-400" /> Nghỉ bù / Phép (Mon-Sat)
                      </div>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <form onSubmit={handleSaveSettings} className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-6">
                {/* Office Location Config Card */}
                <Card className="border-slate-200/80 bg-white shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg text-slate-800 flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-indigo-500" /> Địa điểm Văn phòng
                    </CardTitle>
                    <CardDescription className="text-slate-550">
                      Cập nhật URL vị trí bản đồ văn phòng Google Maps để tự động giải mã tọa độ GPS.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="mapsUrl" className="text-slate-700">Google Maps Link</Label>
                      <Input
                        id="mapsUrl"
                        placeholder="https://www.google.com/maps/place/..."
                        value={mapsUrl}
                        onChange={(e) => setMapsUrl(e.target.value)}
                        required
                        disabled={isPending}
                        className="border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-indigo-550"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="radius" className="text-slate-700">Bán kính quét hợp lệ (m)</Label>
                      <Input
                        id="radius"
                        type="number"
                        placeholder="100"
                        value={radius}
                        onChange={(e) => setRadius(parseInt(e.target.value))}
                        required
                        disabled={isPending}
                        className="border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-indigo-550"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Dynamic Shift Hours Config Card */}
                <Card className="border-slate-200/80 bg-white shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg text-slate-850 flex items-center gap-2">
                      <Clock className="h-5 w-5 text-indigo-650" /> Cấu hình Thời gian Chấm công
                    </CardTitle>
                    <CardDescription className="text-slate-500">
                      Thiết lập các khung giờ check-in và mốc tính đi muộn cho từng ca.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Ca Sáng */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-semibold uppercase text-indigo-600 tracking-wider">Ca Sáng</h4>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="morningStart" className="text-xs text-slate-600">Bắt đầu</Label>
                          <Input
                            id="morningStart"
                            type="time"
                            value={morningStart}
                            onChange={(e) => setMorningStart(e.target.value)}
                            required
                            disabled={isPending}
                            className="border-slate-200 bg-white text-slate-900 focus-visible:ring-indigo-550"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="morningLate" className="text-xs text-slate-600">Tính đi muộn từ</Label>
                          <Input
                            id="morningLate"
                            type="time"
                            value={morningLate}
                            onChange={(e) => setMorningLate(e.target.value)}
                            required
                            disabled={isPending}
                            className="border-slate-200 bg-white text-slate-900 focus-visible:ring-indigo-550"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="morningEnd" className="text-xs text-slate-600">Kết thúc</Label>
                          <Input
                            id="morningEnd"
                            type="time"
                            value={morningEnd}
                            onChange={(e) => setMorningEnd(e.target.value)}
                            required
                            disabled={isPending}
                            className="border-slate-200 bg-white text-slate-900 focus-visible:ring-indigo-550"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Ca Chiều */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-semibold uppercase text-indigo-600 tracking-wider">Ca Chiều</h4>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="afternoonStart" className="text-xs text-slate-600">Bắt đầu</Label>
                          <Input
                            id="afternoonStart"
                            type="time"
                            value={afternoonStart}
                            onChange={(e) => setAfternoonStart(e.target.value)}
                            required
                            disabled={isPending}
                            className="border-slate-200 bg-white text-slate-900 focus-visible:ring-indigo-550"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="afternoonLate" className="text-xs text-slate-600">Tính đi muộn từ</Label>
                          <Input
                            id="afternoonLate"
                            type="time"
                            value={afternoonLate}
                            onChange={(e) => setAfternoonLate(e.target.value)}
                            required
                            disabled={isPending}
                            className="border-slate-200 bg-white text-slate-900 focus-visible:ring-indigo-550"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="afternoonEnd" className="text-xs text-slate-600">Kết thúc</Label>
                          <Input
                            id="afternoonEnd"
                            type="time"
                            value={afternoonEnd}
                            onChange={(e) => setAfternoonEnd(e.target.value)}
                            required
                            disabled={isPending}
                            className="border-slate-200 bg-white text-slate-900 focus-visible:ring-indigo-550"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="border-t border-slate-100 pt-4 flex justify-end">
                    <Button
                      type="submit"
                      disabled={isPending}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/10 cursor-pointer"
                    >
                      {isPending ? 'Đang lưu cấu hình...' : 'Lưu Cấu hình'}
                    </Button>
                  </CardFooter>
                </Card>
              </div>

              {/* Read Only Coordinates / Status View */}
              <div className="md:col-span-1">
                <Card className="border-slate-200 bg-white shadow-sm sticky top-24">
                  <CardHeader>
                    <CardTitle className="text-lg text-slate-850">Tọa độ Hiện tại</CardTitle>
                    <CardDescription className="text-slate-500">
                      Thông tin GPS sau khi phân tích URL bản đồ.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                      <div className="text-xs text-slate-500 font-medium">Vĩ độ (Latitude)</div>
                      <div className="font-mono text-sm text-indigo-700 font-bold">{coords.lat.toFixed(6)}</div>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                      <div className="text-xs text-slate-500 font-medium">Kinh độ (Longitude)</div>
                      <div className="font-mono text-sm text-indigo-700 font-bold">{coords.lng.toFixed(6)}</div>
                    </div>

                    <div className="text-xs text-slate-450 flex gap-2">
                      <Compass className="h-4 w-4 shrink-0 text-slate-400" />
                      <span>Hệ thống sử dụng các tọa độ này làm điểm mốc để tính khoảng cách Haversine.</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
