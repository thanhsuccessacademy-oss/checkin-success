'use client'

import { useEffect, useState, useTransition } from 'react'
import { getMonthlyCheckins, checkInEmployee, signOutEmployee } from './actions'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { SuperadminNav } from '@/components/SuperadminNav'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  MapPin,
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  History,
  LogOut,
  HelpCircle,
  KeyRound,
} from 'lucide-react'
import { changePassword } from './actions'

interface LogItem {
  id: string
  check_in_time: string
  shift: 'morning' | 'afternoon'
  status: 'on_time' | 'late'
}

interface DashboardClientProps {
  user: {
    email: string
    fullName: string
    role: string
  }
  settings: {
    maps_url?: string
    latitude?: number
    longitude?: number
    radius_meters?: number
    morning_start: string
    morning_late: string
    morning_end: string
    afternoon_start: string
    afternoon_late: string
    afternoon_end: string
  }
  initialHistory: LogItem[]
  shiftInfo: {
    eligible: boolean
    shift?: 'morning' | 'afternoon'
    message: string
  }
}

export default function DashboardClient({
  user,
  settings,
  initialHistory,
  shiftInfo,
}: DashboardClientProps) {
  const [time, setTime] = useState('')
  const [history, setHistory] = useState<LogItem[]>(initialHistory)
  const [isLocating, setIsLocating] = useState(false)
  const [shiftState, setShiftState] = useState(shiftInfo)

  const getVnDateKey = (date: Date = new Date()) => {
    const vnTimeStr = date.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' })
    const d = new Date(vnTimeStr)
    const y = d.getFullYear()
    const m = (d.getMonth() + 1).toString().padStart(2, '0')
    const day = d.getDate().toString().padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const todayStr = getVnDateKey(new Date())
  const hasCheckedInCurrentShift = !!(
    shiftState.eligible &&
    shiftState.shift &&
    history.some((log) => {
      const logDateKey = getVnDateKey(new Date(log.check_in_time))
      return logDateKey === todayStr && log.shift === shiftState.shift
    })
  )

  // Change Password States
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isChangingPass, setIsChangingPass] = useState(false)

  // Calendar states
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [calendarData, setCalendarData] = useState<Record<string, { morning: string; afternoon: string }>>({})
  const [monthlyStats, setMonthlyStats] = useState({ totalOnTime: 0, totalLate: 0, totalMissing: 0 })
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false)
  const [monthPrefix, setMonthPrefix] = useState('')
  const [exceptions, setExceptions] = useState<Record<string, 'event' | 'comp_off'>>({})

  const handleOpenCalendar = async () => {
    setIsCalendarOpen(true)
    setIsLoadingCalendar(true)
    try {
      const res = await getMonthlyCheckins()
      if (res.error) {
        toast.error(res.error)
      } else if (res.success && res.calendarData && res.stats) {
        setCalendarData(res.calendarData)
        setMonthlyStats(res.stats)
        setMonthPrefix(res.monthPrefix || '')
        setExceptions(res.exceptions || {})
      }
    } catch (err) {
      toast.error('Không thể tải lịch chấm công')
    } finally {
      setIsLoadingCalendar(false)
    }
  }

  // Update clock ticks
  useEffect(() => {
    const updateClock = () => {
      const vnTimeStr = new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Ho_Chi_Minh',
      })
      const date = new Date(vnTimeStr)
      const hours = date.getHours().toString().padStart(2, '0')
      const minutes = date.getMinutes().toString().padStart(2, '0')
      const seconds = date.getSeconds().toString().padStart(2, '0')
      setTime(`${hours}:${minutes}:${seconds}`)
    }

    updateClock()
    const timer = setInterval(updateClock, 1000)
    return () => clearInterval(timer)
  }, [])

  // Action for changing password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu mới và mật khẩu xác nhận không khớp!')
      return
    }
    if (newPassword.length < 6) {
      toast.error('Mật khẩu mới phải có ít nhất 6 ký tự!')
      return
    }

    setIsChangingPass(true)
    try {
      const formData = new FormData()
      formData.append('oldPassword', oldPassword)
      formData.append('newPassword', newPassword)

      const res = await changePassword(null, formData)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Đổi mật khẩu thành công!')
        setIsDialogOpen(false)
        setOldPassword('')
        setNewPassword('')
        setConfirmPassword('')
      }
    } catch (err) {
      toast.error('Lỗi hệ thống khi đổi mật khẩu.')
    } finally {
      setIsChangingPass(false)
    }
  }

  const handleCheckIn = () => {
    if (!navigator.geolocation) {
      toast.error('Trình duyệt của bạn không hỗ trợ định vị GPS.')
      return
    }

    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords

        try {
          const res = await checkInEmployee(latitude, longitude)
          if (res.error) {
            toast.error(res.error)
          } else {
            toast.success('Check-in thành công!')
            window.location.reload()
          }
        } catch (error) {
          console.error(error)
          toast.error('Lỗi hệ thống khi gửi thông tin check-in.')
        } finally {
          setIsLocating(false)
        }
      },
      (error) => {
        setIsLocating(false)
        console.error('GPS error:', error)
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error('Quyền truy cập vị trí bị từ chối. Vui lòng cho phép quyền GPS trên trình duyệt.')
            break
          case error.POSITION_UNAVAILABLE:
            toast.error('Không tìm thấy tín hiệu vị trí GPS.')
            break
          case error.TIMEOUT:
            toast.error('Quá thời gian nhận diện vị trí GPS.')
            break
          default:
            toast.error('Lỗi định vị vị trí.')
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  }

  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr)
    const vnTimeStr = d.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' })
    const vnDate = new Date(vnTimeStr)

    const date = vnDate.getDate().toString().padStart(2, '0')
    const month = (vnDate.getMonth() + 1).toString().padStart(2, '0')
    const hours = vnDate.getHours().toString().padStart(2, '0')
    const minutes = vnDate.getMinutes().toString().padStart(2, '0')
    const seconds = vnDate.getSeconds().toString().padStart(2, '0')

    return `${hours}:${minutes}:${seconds} - ${date}/${month}`
  }

  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground">
      {/* Top Header */}
      <header className="border-b border-slate-200/80 bg-white/70 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex flex-wrap items-center justify-between gap-4">
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

          {user.role === 'superadmin' && <SuperadminNav />}

          <div className="flex items-center gap-2">
            {user.role === 'admin' && (
              <a
                href="/admin"
                className="text-xs font-semibold text-indigo-650 hover:text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                Vào Admin Panel
              </a>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOutEmployee()}
              className="text-slate-500 hover:text-rose-600 hover:bg-rose-50 gap-2 transition-all"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Đăng xuất</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-md w-full mx-auto px-4 py-6 space-y-6">
        {/* Welcome Card */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 flex justify-between items-center gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
              {user.fullName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-slate-800 font-semibold text-sm">Xin chào, {user.fullName}</h2>
              <p className="text-xs text-slate-400">{user.email}</p>
            </div>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger className="inline-flex items-center justify-center rounded-lg text-xs font-medium border border-slate-200 text-slate-650 hover:bg-slate-50 hover:text-slate-800 h-9 px-3 gap-1.5 transition-all focus:outline-none focus:ring-1 focus:ring-slate-200 cursor-pointer">
              <KeyRound className="h-3.5 w-3.5" />
              Đổi mật khẩu
            </DialogTrigger>
            <DialogContent className="border-slate-200 bg-white text-slate-900 max-w-sm shadow-xl">
              <DialogHeader>
                <DialogTitle className="text-slate-850 text-base font-semibold">Đổi mật khẩu</DialogTitle>
                <DialogDescription className="text-slate-500 text-xs">
                  Cập nhật mật khẩu tài khoản nhân viên của bạn.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleChangePassword} className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="oldPassword" className="text-slate-700">Mật khẩu hiện tại</Label>
                  <Input
                    id="oldPassword"
                    type="password"
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    disabled={isChangingPass}
                    className="border-slate-200 bg-white text-slate-900 focus-visible:ring-indigo-500 focus-visible:border-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-slate-700">Mật khẩu mới</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isChangingPass}
                    className="border-slate-200 bg-white text-slate-900 focus-visible:ring-indigo-500 focus-visible:border-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-slate-700">Xác nhận mật khẩu mới</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isChangingPass}
                    className="border-slate-200 bg-white text-slate-900 focus-visible:ring-indigo-500 focus-visible:border-indigo-500"
                  />
                </div>
                <DialogFooter className="pt-2">
                  <Button
                    type="submit"
                    disabled={isChangingPass}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/10 text-xs cursor-pointer"
                  >
                    {isChangingPass ? 'Đang cập nhật...' : 'Cập nhật Mật khẩu'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Digital Clock Card */}
        <Card className="border-slate-200/80 bg-white shadow-sm overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-violet-600 via-indigo-650 to-cyan-500" />
          <CardHeader className="text-center pb-2">
            <CardDescription className="text-slate-500 text-xs uppercase tracking-wider flex items-center justify-center gap-1">
              <Clock className="h-3 w-3" /> Giờ Hệ Thống (GMT+7)
            </CardDescription>
            <CardTitle className="text-4xl sm:text-5xl font-extrabold text-slate-800 font-mono py-2 tracking-widest">
              {time || '--:--:--'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center pt-0 pb-4">
            <span className="text-xs text-slate-650 flex items-center justify-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-slate-450" />
              {new Date().toLocaleDateString('vi-VN', {
                timeZone: 'Asia/Ho_Chi_Minh',
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </CardContent>
        </Card>

        {/* Shift Warning/Information Alert */}
        {!shiftState.eligible ? (
          <div className="p-4 border border-rose-100 bg-rose-50/50 rounded-xl flex gap-3 text-sm text-rose-700 shadow-sm">
            <AlertTriangle className="h-5 w-5 shrink-0 text-rose-500" />
            <div>
              <p className="font-semibold text-rose-800">Khung giờ không hợp lệ</p>
              <p className="text-xs mt-1 text-rose-600">
                {shiftState.message || 'Hiện tại không nằm trong khung giờ check-in hợp lệ.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4 border border-emerald-100 bg-emerald-50/50 rounded-xl flex gap-3 text-sm text-emerald-700 shadow-sm">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
            <div>
              <p className="font-semibold text-emerald-800">
                Khung giờ check-in hợp lệ (Ca {shiftState.shift === 'morning' ? 'Sáng' : 'Chiều'})
              </p>
              <p className="text-xs mt-1 text-emerald-600">
                Đang trong khung giờ check-in. Vui lòng bấm nút phía dưới để ghi nhận vị trí của bạn.
              </p>
            </div>
          </div>
        )}

        {/* Check-In Button Card */}
        <Card className="border-slate-200/80 bg-white shadow-sm">
          <CardContent className="pt-6 space-y-4">
            <div className="flex justify-between items-center text-xs text-slate-500 border-b border-slate-100 pb-3">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-slate-400" /> Bán kính kiểm tra:
              </span>
              <span className="font-semibold text-slate-700">{settings.radius_meters}m</span>
            </div>

            <Button
              onClick={handleCheckIn}
              disabled={!shiftState.eligible || isLocating || hasCheckedInCurrentShift}
              className={`w-full py-6 rounded-xl relative overflow-hidden group cursor-pointer transition-all duration-200 ease-in-out ${hasCheckedInCurrentShift
                ? 'bg-[#104275] opacity-60 cursor-not-allowed hover:bg-[#104275] text-white font-bold shadow-none'
                : shiftState.eligible
                  ? 'bg-[#104275] hover:bg-[#0d345c] active:scale-95 text-white font-bold shadow-md hover:shadow-lg'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                }`}
            >
              {isLocating ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Đang CHECK-IN...
                </span>
              ) : hasCheckedInCurrentShift ? (
                <span className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 opacity-80" />
                  ĐÃ CHECK-IN CA {shiftState.shift === 'morning' ? 'SÁNG' : 'CHIỀU'}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 animate-pulse" />
                  CHECK-IN
                </span>
              )}
            </Button>

            {settings.maps_url && (
              <div className="text-center">
                <a
                  href={settings.maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-600 hover:underline inline-flex items-center gap-1 justify-center font-medium"
                >
                  Xem vị trí văn phòng trên Bản đồ <HelpCircle className="h-3 w-3" />
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Check-In History Panel */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1">
              <History className="h-4 w-4 text-slate-400" /> Lịch sử check-in
            </h3>

            <Dialog open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenCalendar}
                className="text-xs border-slate-200 text-slate-600 hover:bg-slate-50 gap-1.5 transition-all cursor-pointer"
              >
                <Calendar className="h-3.5 w-3.5" />
                Lịch Chấm Công
              </Button>
              <DialogContent className="border-slate-200 bg-white text-slate-900 max-w-sm overflow-hidden flex flex-col max-h-[90vh] shadow-xl">
                <DialogHeader className="pb-2 border-b border-slate-100">
                  <DialogTitle className="text-slate-850 text-base font-semibold">Lịch Chấm Công Tháng Này</DialogTitle>
                  <DialogDescription className="text-slate-500 text-xs">
                    Chi tiết chấm công ca Sáng & Chiều trong tháng.
                  </DialogDescription>
                </DialogHeader>

                {isLoadingCalendar ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2">
                    <span className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
                    <span className="text-xs text-slate-500">Đang tải lịch chấm công...</span>
                  </div>
                ) : (
                  <div className="space-y-4 py-2 overflow-y-auto pr-1">
                    {/* Grid Calendar */}
                    <div className="grid grid-cols-7 gap-1.5 justify-items-center">
                      {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((d) => (
                        <div key={d} className="text-[10px] font-semibold text-slate-400 w-10 text-center uppercase">
                          {d}
                        </div>
                      ))}

                      {Array.from({ length: new Date(new Date().getFullYear(), new Date().getMonth(), 1).getDay() }).map((_, i) => (
                        <div key={`empty-${i}`} className="w-10 h-10" />
                      ))}

                      {Array.from({ length: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() }).map((_, i) => {
                        const day = i + 1
                        const dayStr = day.toString().padStart(2, '0')
                        const dateKey = `${monthPrefix}-${dayStr}`
                        const dayData = calendarData[dateKey] || { morning: 'none', afternoon: 'none' }

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
                            case 'weekend':
                              return 'bg-slate-100/70'
                            default:
                              return 'bg-slate-50'
                          }
                        }

                        const isEvent = exceptions[dateKey] === 'event'
                        const isCompOff = exceptions[dateKey] === 'comp_off'
                        const isColored = ['on_time', 'late', 'missing', 'comp_off'].includes(dayData.morning) || ['on_time', 'late', 'missing', 'comp_off'].includes(dayData.afternoon)

                        return (
                          <div
                            key={day}
                            className={`relative h-10 w-10 flex flex-col justify-between rounded-md overflow-hidden bg-slate-50 border ${isEvent
                              ? 'border-violet-500 ring-1 ring-violet-500/50 shadow-[0_0_5px_rgba(139,92,246,0.25)]'
                              : isCompOff
                                ? 'border-slate-300'
                                : 'border-slate-200'
                              }`}
                          >
                            <div className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold z-10 select-none ${isColored ? 'text-white font-semibold' : 'text-slate-800'
                              }`}>
                              {day}
                            </div>
                            <div className="flex flex-col h-full w-full">
                              <div className={`h-1/2 w-full ${getBgClass(dayData.morning)}`} />
                              <div className={`h-1/2 w-full ${getBgClass(dayData.afternoon)}`} />
                            </div>
                            {isEvent && (
                              <div className="absolute bottom-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-violet-600 z-20 ring-1 ring-white" />
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap gap-x-3 gap-y-1.5 justify-center text-[10px] text-slate-600 bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
                      <div className="flex items-center gap-1">
                        <div className="h-2.5 w-3.5 rounded bg-emerald-500" /> Đúng giờ
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="h-2.5 w-3.5 rounded bg-amber-500" /> Đi muộn
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="h-2.5 w-3.5 rounded bg-rose-500" /> Vắng
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="h-2.5 w-3.5 rounded bg-slate-400" /> Nghỉ bù/Phép
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="h-2.5 w-3.5 rounded bg-slate-50 border border-violet-500" /> Trực sự kiện
                      </div>
                    </div>

                    {/* Monthly Statistics Summary */}
                    <div className="space-y-3 bg-slate-50 border border-slate-200 p-3 rounded-lg">
                      <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider text-center">Thống kê tháng này</h4>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-white border border-slate-200 p-1.5 rounded-md">
                          <div className="text-[9px] text-slate-400">Đúng giờ</div>
                          <div className="text-xs font-bold text-emerald-600">{monthlyStats.totalOnTime} ca</div>
                        </div>
                        <div className="bg-white border border-slate-200 p-1.5 rounded-md">
                          <div className="text-[9px] text-slate-400">Đi trễ</div>
                          <div className="text-xs font-bold text-amber-600">{monthlyStats.totalLate} ca</div>
                        </div>
                        <div className="bg-white border border-slate-200 p-1.5 rounded-md">
                          <div className="text-[9px] text-slate-400">Vắng mặt</div>
                          <div className="text-xs font-bold text-rose-600">{monthlyStats.totalMissing} ca</div>
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-1.5 border-t border-slate-200">
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>Tỷ lệ chuyên cần</span>
                          <span className="font-semibold text-indigo-650">
                            {monthlyStats.totalOnTime + monthlyStats.totalLate + monthlyStats.totalMissing > 0
                              ? Math.round(
                                ((monthlyStats.totalOnTime + monthlyStats.totalLate) /
                                  (monthlyStats.totalOnTime +
                                    monthlyStats.totalLate +
                                    monthlyStats.totalMissing)) *
                                100
                              )
                              : 100}
                            %
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-violet-600 to-indigo-600 rounded-full"
                            style={{
                              width: `${monthlyStats.totalOnTime + monthlyStats.totalLate + monthlyStats.totalMissing > 0
                                ? Math.round(
                                  ((monthlyStats.totalOnTime + monthlyStats.totalLate) /
                                    (monthlyStats.totalOnTime +
                                      monthlyStats.totalLate +
                                      monthlyStats.totalMissing)) *
                                  100
                                )
                                : 100
                                }%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            {history.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">Chưa có lịch sử check-in nào.</div>
            ) : (
              <Table>
                <TableHeader className="bg-slate-50/80 border-b border-slate-200">
                  <TableRow className="border-slate-200 hover:bg-transparent">
                    <TableHead className="text-slate-600 text-xs">Thời gian</TableHead>
                    <TableHead className="text-slate-600 text-xs">Ca</TableHead>
                    <TableHead className="text-slate-650 text-xs text-right">Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((item) => (
                    <TableRow key={item.id} className="border-slate-100 hover:bg-slate-50/50">
                      <TableCell className="font-mono text-xs text-slate-700 py-3">
                        {formatDate(item.check_in_time)}
                      </TableCell>
                      <TableCell className="py-3">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${item.shift === 'morning'
                            ? 'bg-sky-50 text-sky-700 border border-sky-100'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                            }`}
                        >
                          {item.shift === 'morning' ? 'Sáng' : 'Chiều'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right py-3">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${item.status === 'on_time'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : 'bg-amber-50 text-amber-700 border border-amber-100'
                            }`}
                        >
                          {item.status === 'on_time' ? 'Đúng giờ' : 'Trễ giờ'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
