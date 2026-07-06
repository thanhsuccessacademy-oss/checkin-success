'use client'

import { useState, useTransition, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { login } from './actions'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import Image from 'next/image'
import { CalendarCheck, ShieldAlert, LogIn } from 'lucide-react'

function LoginForm() {
  const searchParams = useSearchParams()
  const errorParam = searchParams.get('error')

  const [isPending, startTransition] = useTransition()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (errorParam === 'inactive') {
      toast.error('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin.', {
        duration: 5000,
      })
    }
  }, [errorParam])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const formData = new FormData()
    formData.append('email', email)
    formData.append('password', password)

    startTransition(async () => {
      const result = await login(null, formData)
      if (result?.error) {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="w-full max-w-md relative z-10">
      {/* Brand/App Title */}
      <div className="flex flex-col items-center mb-8">
        <div className="mb-4">
          <Image
            src="/logo-success.png"
            alt="Success Academy Logo"
            width={140}
            height={50}
            className="object-contain"
            priority
          />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">SUCCESS Academy</h1>
        <p className="text-sm text-slate-500 mt-1">Hệ thống Check-in GPS Nội bộ</p>
      </div>

      <Card className="border-slate-200/80 bg-white/95 backdrop-blur-xl shadow-xl">
        <CardHeader>
          <CardTitle className="text-xl text-slate-850">Chào mừng trở lại</CardTitle>
          <CardDescription className="text-slate-500">
            Đăng nhập bằng tài khoản nội bộ để tiếp tục check-in
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {errorParam === 'inactive' && (
              <div className="flex items-center gap-2 p-3 text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>Tài khoản này hiện đang bị khóa.</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-700">Email công ty</Label>
              <Input
                id="email"
                type="email"
                placeholder="employee@successacademy.edu.vn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isPending}
                className="border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-indigo-500 focus-visible:border-indigo-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700">Mật khẩu</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isPending}
                className="border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-indigo-500 focus-visible:border-indigo-500"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              disabled={isPending}
              className="w-full bg-[#104275] hover:bg-[#0d345c] text-white font-semibold transition-all duration-200 active:scale-95 shadow-md hover:shadow-lg cursor-pointer"
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Đang xử lý...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="h-4 w-4" /> Đăng nhập
                </span>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <main className="relative min-h-screen flex items-center justify-center bg-slate-50/50 px-4 overflow-hidden">
      {/* Decorative background glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-violet-500/5 blur-[120px] pointer-events-none" />

      <Suspense
        fallback={
          <div className="flex flex-col items-center gap-2">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
            <span className="text-slate-500 text-sm">Đang tải trang...</span>
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  )
}
