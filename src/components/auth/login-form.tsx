"use client"

import { useState } from "react"
import { signInWithEmail } from "@/lib/auth"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ModeToggle } from "@/components/theme/mode-toggle"


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
    <div className="min-h-screen bg-background relative">
      {/* Theme Toggle */}
      <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>
      
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md space-y-8">
          {/* Project Header */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Surgery Note Grader</h1>
            <p className="text-muted-foreground">
              Professional surgical consultation note evaluation platform
            </p>
          </div>

        {/* Login Card */}
        <Card>
          <CardHeader className="text-center">
            <h2 className="text-xl font-semibold">Sign In</h2>
            <p className="text-sm text-muted-foreground">
              Enter your email to receive a secure login link
            </p>
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
                  placeholder="your-email@domain.com"
                />
              </div>
              
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Sending..." : "Send Magic Link"}
              </Button>
              
              {message && (
                <div
                  className={`text-sm text-center p-3 rounded-md ${
                    message.includes("Error") 
                      ? "bg-destructive/10 text-destructive border border-destructive/20" 
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
                  }`}
                >
                  {message}
                </div>
              )}
            </form>
            
            <div className="mt-6 text-center">
              <Link 
                href="/about" 
                className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
              >
                Learn more about this project
              </Link>
            </div>
          </CardContent>
        </Card>
        
          {/* Footer */}
          <div className="text-center text-sm text-muted-foreground">
            <p>Secure authentication • Research-grade evaluation platform</p>
          </div>
        </div>
      </div>
    </div>
  )
}
