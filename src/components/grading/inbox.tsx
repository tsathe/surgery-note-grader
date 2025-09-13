"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { DUMMY_NOTES } from "@/lib/dummy"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Inbox as InboxIcon, Loader2, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

type Assignment = {
  id: string
  title: string
  phase: 1 | 2
  status: "pending" | "graded"
  surgery_date?: string | null
  surgeon?: string | null
}

interface InboxProps {
  user: any
  onOpen?: (noteId: string) => void
}

export default function Inbox({ user, onOpen }: InboxProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [query, setQuery] = useState("")
  // Removed phase filter - all cases are Phase 1
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "inprogress" | "graded">("all")
  const [isLoading, setIsLoading] = useState(true)
  const [inProgressIds, setInProgressIds] = useState<Set<string>>(new Set())
  const [domainCount, setDomainCount] = useState<number>(5)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    load()
  }, [])

  async function load() {
    setIsLoading(true)
    try {
      // Example: join of assignments/grades could be used. For now synthesize from surgery_notes + grades presence
      const { data: notes, error } = await supabase
        .from("surgery_notes")
        .select("id,description,note_text")
        .order("created_at", { ascending: false })

      const { data: userGrades } = await supabase
        .from("grades")
        .select("note_id")
        .eq("grader_id", user.id)

      const gradedIds = new Set((userGrades || []).map((g) => g.note_id))
      // also merge local optimistic completed ids so status updates immediately after submit
      if (typeof window !== 'undefined') {
        try {
          const localCompleted = JSON.parse(localStorage.getItem('sng_completed_ids') || '[]') as string[]
          for (const id of localCompleted) gradedIds.add(id)
        } catch {}
      }

      const noteList = error || !notes || notes.length === 0 ? DUMMY_NOTES : notes

      // All cases are Phase 1
      const mapped: Assignment[] = noteList.map((n: any, idx: number) => ({
        id: n.id,
        title: n.description || `Note ${n.id.substring(0, 8)}`,
        phase: 1 as 1 | 2,
        status: gradedIds.has(n.id) ? "graded" : "pending",
        surgery_date: null,
        surgeon: null,
      }))

      setAssignments(mapped)
      // domain count (for progress pips)
      const { data: domains, error: dErr } = await supabase.from("rubric_domains").select("id")
      if (!dErr && domains) setDomainCount(domains.length || 5)
      // restore in-progress from localStorage
      if (typeof window !== 'undefined') {
        try {
          const saved = JSON.parse(localStorage.getItem("sng_inprogress_ids") || "[]") as string[]
          setInProgressIds(new Set(saved))
        } catch {
          setInProgressIds(new Set())
        }
      }
    } finally {
      setIsLoading(false)
    }
  }

  const filtered = useMemo(() => {
    return assignments.filter((a) => {
      const matchesQuery = !query || a.title.toLowerCase().includes(query.toLowerCase())
      const status = a.status
      const isInProgress = inProgressIds.has(a.id) && status !== "graded"
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "pending" && status === "pending" && !isInProgress) ||
        (statusFilter === "inprogress" && isInProgress) ||
        (statusFilter === "graded" && status === "graded")
      return matchesQuery && matchesStatus
    })
  }, [assignments, query, statusFilter, inProgressIds])

  function openNote(id: string) {
    // mark as in-progress
    const next = new Set(inProgressIds)
    next.add(id)
    setInProgressIds(next)
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem("sng_inprogress_ids", JSON.stringify(Array.from(next)))
        // set selected for grading view
        localStorage.setItem("sng_selected_note_id", id)
      } catch {
        // localStorage might be disabled
      }
    }
    onOpen?.(id)
  }

  const counts = useMemo(() => {
    const graded = assignments.filter((a) => a.status === "graded").length
    const inprogress = assignments.filter((a) => inProgressIds.has(a.id) && a.status !== "graded").length
    const pending = assignments.length - graded - inprogress
    return { pending, inprogress, graded, total: assignments.length }
  }, [assignments, inProgressIds])

  function renderPips(id: string) {
    if (!isClient) {
      return (
        <div className="flex items-center gap-1" title="No progress">
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} className="h-1.5 w-6 rounded-full bg-muted" />
          ))}
        </div>
      )
    }
    
    try {
      const raw = localStorage.getItem(`sng_partial_scores_${id}`)
      const filled = raw ? Math.min(domainCount, Object.keys(JSON.parse(raw)).length) : 0
      const total = Math.max(1, domainCount)
      const show = Array.from({ length: 5 }, (_, i) => i < Math.round((filled / total) * 5))
      return (
        <div className="flex items-center gap-1" title={filled ? `${filled}/${total} domains scored` : "No progress"}>
          {show.map((on, i) => (
            <span key={i} className={`h-1.5 w-6 rounded-full ${on ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>
      )
    } catch {
      return (
        <div className="flex items-center gap-1" title="No progress">
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} className="h-1.5 w-6 rounded-full bg-muted" />
          ))}
        </div>
      )
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
      {/* Enhanced Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card
          className={cn(
            "group cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5",
            statusFilter === 'pending' 
              ? 'ring-2 ring-blue-500/40 border-blue-500/30 bg-gradient-to-br from-blue-50/50 to-blue-100/30 dark:from-blue-950/20 dark:to-blue-900/10' 
              : 'border-border/50 hover:border-border bg-gradient-to-br from-card to-card/80'
          )}
          onClick={() => setStatusFilter('pending')}
        >
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground/80">
                Inbox
              </div>
              <div className="text-3xl font-bold text-foreground/90">{counts.pending}</div>
              <div className="text-xs text-muted-foreground">
                of {counts.total} total assignments
              </div>
              <div className="h-1 w-12 bg-blue-500/30 rounded-full mt-2 group-hover:bg-blue-500/50 transition-colors" />
            </div>
            <div className="relative">
              <InboxIcon className="h-8 w-8 text-muted-foreground/60 group-hover:text-blue-500/70 transition-colors" />
              {counts.pending > 0 && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card
          className={cn(
            "group cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5",
            statusFilter === 'inprogress' 
              ? 'ring-2 ring-amber-500/40 border-amber-500/30 bg-gradient-to-br from-amber-50/50 to-amber-100/30 dark:from-amber-950/20 dark:to-amber-900/10' 
              : 'border-border/50 hover:border-border bg-gradient-to-br from-card to-card/80'
          )}
          onClick={() => setStatusFilter('inprogress')}
        >
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground/80">
                In Progress
              </div>
              <div className="text-3xl font-bold text-foreground/90">{counts.inprogress}</div>
              <div className="text-xs text-muted-foreground">
                actively being graded
              </div>
              <div className="h-1 w-12 bg-amber-500/30 rounded-full mt-2 group-hover:bg-amber-500/50 transition-colors" />
            </div>
            <div className="relative">
              <Loader2 className="h-8 w-8 text-muted-foreground/60 group-hover:text-amber-500/70 transition-colors animate-spin" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={cn(
            "group cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5",
            statusFilter === 'graded' 
              ? 'ring-2 ring-emerald-500/40 border-emerald-500/30 bg-gradient-to-br from-emerald-50/50 to-emerald-100/30 dark:from-emerald-950/20 dark:to-emerald-900/10' 
              : 'border-border/50 hover:border-border bg-gradient-to-br from-card to-card/80'
          )}
          onClick={() => setStatusFilter('graded')}
        >
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground/80">
                Completed
              </div>
              <div className="text-3xl font-bold text-foreground/90">{counts.graded}</div>
              <div className="text-xs text-muted-foreground">
                evaluations submitted
              </div>
              <div className="h-1 w-12 bg-emerald-500/30 rounded-full mt-2 group-hover:bg-emerald-500/50 transition-colors" />
            </div>
            <div className="relative">
              <CheckCircle2 className="h-8 w-8 text-muted-foreground/60 group-hover:text-emerald-500/70 transition-colors" />
              {counts.graded > 0 && (
                <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-foreground/90">Surgery Notes</h2>
          <p className="text-sm text-muted-foreground">Click any note to begin your evaluation</p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            placeholder="Search notes..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 w-64 bg-card/30 border-border/50 focus:bg-card/60 transition-colors"
          />
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 bg-muted/20">
              <TableHead className="font-semibold">Note Description</TableHead>
              <TableHead className="w-[200px] font-semibold text-center">Progress</TableHead>
              <TableHead className="w-[120px] text-center font-semibold">Status</TableHead>
              <TableHead className="w-[100px] text-center font-semibold">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Loading assignments...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12">
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">No assignments found</div>
                    <div className="text-xs text-muted-foreground/70">
                      {query ? "Try adjusting your search" : "Check back later for new assignments"}
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((a) => (
                <TableRow
                  key={a.id}
                  className="group hover:bg-accent/40 transition-all duration-150 border-border/30"
                >
                  <TableCell className="py-4">
                    <div className="space-y-1">
                      <div className="font-medium text-foreground/90 group-hover:text-foreground transition-colors">
                        {a.title}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-4 text-center">
                    {renderPips(a.id)}
                  </TableCell>
                  <TableCell className="py-4 text-center">
                    {a.status === "graded" ? (
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                        ✓ Completed
                      </Badge>
                    ) : inProgressIds.has(a.id) ? (
                      <Badge variant="outline" className="border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400">
                        In Progress
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-border/60 text-muted-foreground hover:border-border hover:text-foreground transition-colors">
                        Pending
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="py-4 text-center">
                    <Button
                      onClick={(e) => {
                        e.stopPropagation()
                        openNote(a.id)
                      }}
                      size="sm"
                      className="h-8 px-3 text-xs font-medium"
                    >
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}


