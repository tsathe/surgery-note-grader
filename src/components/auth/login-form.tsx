"use client"

import { useState } from "react"
import { signInWithEmail } from "@/lib/auth"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage('')

    const { error } = await signInWithEmail(email)
    
    if (error) {
      setMessage('Error sending magic link. Please try again.')
    } else {
      setMessage('Check your email for the magic link!')
      setEmail('')
    }
    
    setIsLoading(false)
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="text-center space-y-1">
            <h2 className="text-xl font-semibold">Surgery Note Grader</h2>
            <p className="text-sm text-muted-foreground">
              Sign in with your email to access the grading interface
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email address
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Sending…" : "Send Magic Link"}
            </Button>
            {message && (
              <div
                className={`text-sm text-center ${
                  message.includes("Error") ? "text-red-600" : "text-green-600"
                }`}
              >
                {message}
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
