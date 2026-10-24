"use client"

import { signInWithGoogle } from "@/lib/auth"
import { Button } from "@/components/ui/button"

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-3xl font-semibold tracking-tight">APEX</h1>
      <Button onClick={() => void signInWithGoogle()}>Continue with Google</Button>
    </div>
  )
}
