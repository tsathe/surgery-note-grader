"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import LoginForm from "@/components/auth/login-form"
import GradingInterface from "@/components/grading/grading-interface"
import AdminInterface from "@/components/admin/admin-interface"
import Inbox from "@/components/grading/inbox"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ModeToggle } from "@/components/theme/mode-toggle"

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)
  const [activeInterface, setActiveInterface] = useState<'inbox' | 'grading' | 'admin'>('inbox')
  const [inboxKey, setInboxKey] = useState(0)
  const [inboxAutoRefresh, setInboxAutoRefresh] = useState(0)

  useEffect(() => {
    // Check for existing session
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setUser(session?.user ?? null)
        
        if (session?.user) {
          try {
            const allowed = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
              .split(',')
              .map((s) => s.trim().toLowerCase())
              .filter(Boolean)
            const isAdminUser = allowed.includes((session.user.email || '').toLowerCase())
            setIsAdmin(isAdminUser)
            
            // Check if user has access (either admin or in users table)
            if (isAdminUser) {
              setHasAccess(true)
            } else {
              // Check if user exists in users table
              const { data: userData } = await supabase
                .from('users')
                .select('id')
                .eq('email', session.user.email?.toLowerCase())
                .single()
              
              setHasAccess(!!userData)
            }
          } catch (error) {
            console.error('Access check error:', error)
            setIsAdmin(false)
            setHasAccess(false)
          }
        } else {
          setIsAdmin(false)
          setHasAccess(false)
        }
      } catch (error) {
        console.error('Session check error:', error)
        setUser(null)
        setIsAdmin(false)
        setHasAccess(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        setUser(session?.user ?? null)
        if (session?.user) {
          try {
            const allowed = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
              .split(',')
              .map((s) => s.trim().toLowerCase())
              .filter(Boolean)
            const isAdminUser = allowed.includes((session.user.email || '').toLowerCase())
            setIsAdmin(isAdminUser)
            
            // Check if user has access (either admin or in users table)
            if (isAdminUser) {
              setHasAccess(true)
            } else {
              // Check if user exists in users table
              const { data: userData } = await supabase
                .from('users')
                .select('id')
                .eq('email', session.user.email?.toLowerCase())
                .single()
              
              setHasAccess(!!userData)
            }
          } catch (error) {
            console.error('Access check error:', error)
            setIsAdmin(false)
            setHasAccess(false)
          }
        } else {
          setIsAdmin(false)
          setHasAccess(false)
        }
        setIsLoading(false)
      } catch (error) {
        console.error('Auth state change error:', error)
        setIsLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    )
  }

  if (!user) {
    return <LoginForm />
  }

  // Check if user has access (admin or regular user)
  if (!hasAccess && !isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">You don't have permission to access this application.</p>
          <p className="text-sm text-muted-foreground">Please contact an administrator if you believe this is an error.</p>
          <Button variant="outline" onClick={handleSignOut}>Sign Out</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <header className="border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="text-base font-semibold">Surgery Note Grader</div>
            <Tabs value={activeInterface} onValueChange={(v: any) => {
              setActiveInterface(v)
              if (v === 'inbox') {
                // Trigger auto-refresh when switching to inbox
                setInboxAutoRefresh(prev => prev + 1)
              }
            }}>
              <TabsList>
                <TabsTrigger value="inbox">My Assignments</TabsTrigger>
                {isAdmin && <TabsTrigger value="admin">Admin Dashboard</TabsTrigger>}
              </TabsList>
            </Tabs>
          </div>
          <div className="flex items-center gap-2">
            {user?.email && <Badge variant="secondary">{user.email}</Badge>}
            <Button variant="outline" size="sm" onClick={handleSignOut}>Sign Out</Button>
            <ModeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      {activeInterface === "inbox" && (
        <Inbox 
          key={inboxKey} 
          user={user} 
          onOpen={() => setActiveInterface('grading')} 
          autoRefresh={inboxAutoRefresh > 0}
        />
      )}
      {activeInterface === "grading" && (
        <GradingInterface
          user={user}
          onExit={() => {
            setActiveInterface('inbox')
            setInboxKey((k) => k + 1)
            setInboxAutoRefresh(prev => prev + 1)
          }}
          onEvaluationDeleted={() => {
            // Refresh inbox to reflect deleted evaluation
            setInboxKey((k) => k + 1)
            setInboxAutoRefresh(prev => prev + 1)
          }}
        />
      )}
      {activeInterface === "admin" && <AdminInterface user={user} />}
    </div>
  )
}
