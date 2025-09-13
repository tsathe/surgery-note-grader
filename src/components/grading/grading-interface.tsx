"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { SurgeryNote, RubricDomain } from "@/lib/types"
import { DUMMY_NOTES } from "@/lib/dummy"
import RubricDomainComponent from "./rubric-domain"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { useRef } from "react"

interface GradingInterfaceProps {
  user: any
  onExit?: () => void
}

// Dummy notes are imported from '@/lib/dummy'

const DUMMY_DOMAINS: RubricDomain[] = [
  {
    id: 'd1',
    name: 'Completeness',
    description: 'All required elements present (HPI/indication, procedure details, findings, complications, plan).',
    examples: 'Lists indication, steps, findings, blood loss, disposition.',
    max_score: 5,
    order: 1,
    score_guidance: {
      1: 'Major elements missing; inadequate for clinical continuity',
      2: 'Multiple omissions; requires significant addendum',
      3: 'Most elements present; minor gaps',
      4: 'All key elements present with good detail',
      5: 'Exemplary completeness with precise detail',
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'd2',
    name: 'Accuracy',
    description: 'Medically and technically accurate.',
    examples: 'Uses correct anatomy and device names; no contradictions.',
    max_score: 5,
    order: 2,
    score_guidance: {
      1: 'Significant inaccuracies or contradictions',
      2: 'Several inaccuracies; requires correction',
      3: 'Generally accurate; minor imprecision',
      4: 'Accurate and consistent throughout',
      5: 'Highly precise, technically rigorous',
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'd3',
    name: 'Clarity',
    description: 'Clear, concise, and logically organized.',
    examples: 'Chronological steps, short sentences, minimal ambiguity.',
    max_score: 5,
    order: 3,
    score_guidance: {
      1: 'Disorganized, difficult to follow',
      2: 'Some structure but confusing in parts',
      3: 'Understandable with occasional ambiguity',
      4: 'Clear, concise, well organized',
      5: 'Exceptional clarity and flow',
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'd4',
    name: 'Timeliness',
    description: 'Completed and finalized within an appropriate timeframe.',
    examples: 'Completed within 24 hours; updates captured.',
    max_score: 5,
    order: 4,
    score_guidance: {
      1: '>72h late or missing',
      2: '24–72h late',
      3: '0–24h late or incomplete finalization',
      4: 'On time with minor delay',
      5: 'Completed and finalized promptly',
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'd5',
    name: 'Compliance',
    description: 'Meets institutional and regulatory requirements.',
    examples: 'Required signatures, proper headings, appropriate attestations.',
    max_score: 5,
    order: 5,
    score_guidance: {
      1: 'Noncompliant; missing required elements',
      2: 'Partially compliant; multiple issues',
      3: 'Compliant with minor issues',
      4: 'Compliant; well formatted',
      5: 'Fully compliant and exemplary formatting',
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]

export default function GradingInterface({ user, onExit }: GradingInterfaceProps) {
  const [notes, setNotes] = useState<SurgeryNote[]>([])
  const [selectedNote, setSelectedNote] = useState<SurgeryNote | null>(null)
  const [domains, setDomains] = useState<RubricDomain[]>([])
  const [scores, setScores] = useState<Record<string, number>>({})
  const [feedback, setFeedback] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [openDomainId, setOpenDomainId] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<"idle"|"saving"|"saved">("idle")
  const [isClient, setIsClient] = useState(false)
  const saveTimerRef = useRef<number | null>(null)

  const totalDomains = domains.length
  const scoredCount = Object.keys(scores).length
  const canSubmit = totalDomains > 0 && scoredCount === totalDomains

  useEffect(() => {
    setIsClient(true)
    loadData()
  }, [])

  const initializeScores = (loadedDomains: RubricDomain[]) => {
    // Start unanswered: keep scores empty; selections will add keys
    setScores({})
  }

  const loadData = async () => {
    try {
      // Attempt to load from Supabase
      const [{ data: notesData, error: notesError }, { data: domainsData, error: domainsError }] = await Promise.all([
        supabase.from('surgery_notes').select('*').order('created_at', { ascending: false }),
        supabase.from('rubric_domains').select('*').order('order', { ascending: true }),
      ])

      let finalNotes = notesData || []
      const finalDomains = domainsData || []

      // Fallback notes if none available in DB (for demo only)
      if (notesError || finalNotes.length === 0) {
        finalNotes = DUMMY_NOTES
      }

      setNotes(finalNotes)
      setDomains(finalDomains)
      const preferredId = typeof window !== 'undefined' ? localStorage.getItem('sng_selected_note_id') : null
      const initial = preferredId ? finalNotes.find((n: any) => n.id === preferredId) || finalNotes[0] || null : finalNotes[0] || null
      setSelectedNote(initial)
      initializeScores(finalDomains)
      if (initial && user && typeof window !== 'undefined') {
        await prefillExistingGrade(initial.id, user.id)
      }
      // start with all domains collapsed
    } catch (error) {
      // Total fallback to dummy
      setNotes(DUMMY_NOTES)
      setDomains([])
      const first = DUMMY_NOTES[0]
      setSelectedNote(first)
      initializeScores([])
      // local-only prefill if available
      if (first && user && typeof window !== 'undefined') {
        await prefillExistingGrade(first.id, user.id)
      }
      // start with all domains collapsed
    } finally {
      setIsLoading(false)
    }
  }

  const prefillExistingGrade = async (noteId: string, userId: string) => {
    try {
      // Try backend grade first
      const { data, error } = await supabase
        .from('grades')
        .select('domain_scores,feedback')
        .eq('note_id', noteId)
        .eq('grader_id', userId)
        .limit(1)
        .maybeSingle?.() // if available
      if (!error && data) {
        const raw = (data as any).domain_scores || {}
        const { _meta, ...ds } = raw as any
        setScores(ds)
        setFeedback(((data as any).feedback ?? '') as string)
        return
      }
    } catch {}
    // Fallback to local saved last grade
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(`sng_last_grade_${noteId}`)
        if (raw) {
          const obj = JSON.parse(raw) as { scores?: Record<string, number>, feedback?: string }
          if (obj?.scores) setScores(obj.scores)
          if (typeof obj?.feedback === 'string') setFeedback(obj.feedback)
        }
      } catch {}
    }
  }

  const handleScoreChange = (domainId: string, score: number) => {
    const newScores = { ...scores, [domainId]: score }
    setScores(newScores)
    
    // persist partial progress for inbox pips
    if (typeof window !== 'undefined') {
      const key = selectedNote?.id ? `sng_partial_scores_${selectedNote.id}` : null
      if (key) {
        try {
          const raw = localStorage.getItem(key)
          const obj = raw ? JSON.parse(raw) : {}
          obj[domainId] = score
          localStorage.setItem(key, JSON.stringify(obj))
        } catch {}
      }
    }
    
    // autosave feedback indicator
    setSaveState("saving")
    if (typeof window !== 'undefined') {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = window.setTimeout(() => setSaveState("saved"), 600) as unknown as number
    }

    // auto-advance: collapse current, open next domain
    const idx = domains.findIndex((d) => d.id === domainId)
    if (idx >= 0 && idx < domains.length - 1) {
      // Find next unscored domain using the new scores
      const nextUnscored = domains.slice(idx + 1).find(d => !newScores[d.id])
      if (nextUnscored) {
        setOpenDomainId(nextUnscored.id)
      } else {
        // All domains after this are scored, collapse all
        setOpenDomainId(null)
      }
    } else {
      // This was the last domain, collapse all
      setOpenDomainId(null)
    }
  }

  // Keyboard shortcuts: when a domain is open, 1-5 assign score
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!openDomainId) return
      const key = e.key
      if (['1','2','3','4','5'].includes(key)) {
        const value = Number(key)
        handleScoreChange(openDomainId, value)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openDomainId])

  // Auto-open first unscored domain on initial load only
  useEffect(() => {
    if (!domains || domains.length === 0) return
    if (openDomainId) return
    
    // Only auto-open if we have unscored domains
    const unscored = domains.find((d) => scores[d.id] == null)
    if (unscored) {
      setOpenDomainId(unscored.id)
    }
    // Don't auto-open anything if all domains are scored
  }, [domains, scores, openDomainId])

  const calculateTotalScore = () => {
    return Object.values(scores).reduce((sum, s) => sum + (typeof s === 'number' ? s : 0), 0)
  }

  function computeRubricVersion(domainsList: RubricDomain[]): string {
    // Simple deterministic hash for current rubric definition
    const payload = domainsList
      .map((d) => `${d.order}|${d.name}|${d.description}|${d.examples}|${d.max_score}`)
      .join("\n")
    let h = 2166136261 >>> 0
    for (let i = 0; i < payload.length; i++) {
      h ^= payload.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    return (h >>> 0).toString(16)
  }

  const handleSubmitGrade = async () => {
    if (!selectedNote || !user) return
    setIsSubmitting(true)
    try {
      const totalScore = calculateTotalScore()
      // Upsert: update if a grade by this user exists, else insert
      let existingId: string | null = null
      try {
        const { data: existing } = await supabase
          .from('grades')
          .select('id')
          .eq('note_id', selectedNote.id)
          .eq('grader_id', user.id)
          .limit(1)
        if (existing && existing.length > 0) existingId = (existing[0] as any).id
      } catch {}
      const domain_scores_with_meta: any = { ...scores, _meta: { rubric_version: computeRubricVersion(domains), rubric: domains.map((d) => ({ id: d.id, name: d.name, order: d.order, max_score: d.max_score })) } }
      if (existingId) {
        await supabase
          .from('grades')
          .update({ domain_scores: domain_scores_with_meta, total_score: totalScore, feedback: feedback || null })
          .eq('id', existingId)
      } else {
        await supabase.from('grades').insert({
          note_id: selectedNote.id,
          grader_id: user.id,
          domain_scores: domain_scores_with_meta,
          total_score: totalScore,
          feedback: feedback || null,
        })
      }
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`sng_partial_scores_${selectedNote.id}`)
        // Remove from in-progress list for inbox
        try {
          const raw = localStorage.getItem('sng_inprogress_ids') || '[]'
          const arr: string[] = JSON.parse(raw)
          const next = arr.filter((id) => id !== selectedNote.id)
          localStorage.setItem('sng_inprogress_ids', JSON.stringify(next))
        } catch {}
        // Mark as completed (optimistic)
        try {
          const rawCompleted = localStorage.getItem('sng_completed_ids') || '[]'
          const completedArr: string[] = JSON.parse(rawCompleted)
          if (!completedArr.includes(selectedNote.id)) {
            completedArr.push(selectedNote.id)
            localStorage.setItem('sng_completed_ids', JSON.stringify(completedArr))
          }
        } catch {}
        // Persist last submitted for quick reopen in dummy mode
        try {
          localStorage.setItem(`sng_last_grade_${selectedNote.id}`, JSON.stringify({ scores, feedback }))
        } catch {}
      }
      // Reset to defaults (1..5)
      initializeScores(domains)
      setFeedback('')
      // Close grading view after successful submit
      onExit?.()
    } catch (error) {
      // No-op in dummy mode
      console.error('Submit error (ignored in dummy mode):', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-background via-background to-muted/20">
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-6 py-4 md:py-6">
        <div className="h-full grid grid-cols-1 lg:grid-cols-[1fr_1px_1fr] gap-0 min-h-0">
          {/* Left Pane: Note viewer */}
          <div className="flex flex-col min-h-0 relative">
            <div className="absolute inset-0 bg-gradient-to-b from-background/50 to-transparent pointer-events-none z-10" />
            <div className="px-4 py-4 w-full mx-auto max-w-[780px] flex-1 flex flex-col min-h-0">
            {selectedNote ? (
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="mb-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold text-foreground/90">
                      {selectedNote.description}
                    </h2>
                    <p className="text-xs text-muted-foreground">ID: {selectedNote.id.substring(0, 8)}...</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Progress: {scoredCount}/{totalDomains}</span>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalDomains }, (_, i) => (
                          <div
                            key={i}
                            className={`h-1.5 w-8 rounded-full transition-all ${
                              i < scoredCount ? 'bg-emerald-500' : 'bg-border'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                
                <ScrollArea className="flex-1 rounded-lg bg-muted/20 border border-border/30">
                  <div className="p-6">
                    <pre className="whitespace-pre-wrap text-[15px] leading-7 font-mono text-foreground/90 selection:bg-primary/20">
                      {selectedNote.note_text}
                    </pre>
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="flex-1 min-h-0 flex items-center justify-center">
                <div className="text-center space-y-2">
                  <div className="text-muted-foreground text-sm">No note selected</div>
                  <div className="text-xs text-muted-foreground/70">Select a note from your inbox to begin</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Vertical divider */}
        <Separator orientation="vertical" className="hidden lg:block bg-gradient-to-b from-transparent via-border to-transparent" />

          {/* Right Pane: Grading */}
          <div className="flex flex-col min-h-0 relative">
            <div className="absolute inset-0 bg-gradient-to-b from-muted/10 to-transparent pointer-events-none z-10" />
            <div className="px-4 py-4 w-full mx-auto max-w-[720px] flex-1 flex flex-col min-h-0">
            
            <div className="mb-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold">Evaluation</h3>
                  <div className="text-xs text-muted-foreground flex items-center gap-3">
                    <span>Rate each domain 1-5</span>
                    <kbd className="px-2 py-0.5 text-[10px] bg-muted/50 border rounded">1-5 keys</kbd>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="text-2xl font-bold text-foreground/80">
                    {calculateTotalScore()}<span className="text-sm text-muted-foreground font-normal">/{totalDomains * 5}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {isClient && saveState === 'saving' && '💾 Saving...'}
                    {isClient && saveState === 'saved' && '✓ Saved'}
                    {(!isClient || saveState === 'idle') && `${scoredCount}/${totalDomains} complete`}
                  </div>
                </div>
              </div>
              
              {/* Enhanced Progress */}
              <div className="space-y-2">
                <div className="h-2 bg-muted/30 rounded-full overflow-hidden shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700 ease-out shadow-sm"
                    style={{ width: `${Math.round((scoredCount / Math.max(1, totalDomains)) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Domains Section */}
              <div className={`${openDomainId ? 'flex-1 overflow-hidden' : 'flex-none'} transition-all duration-300`}>
                <ScrollArea className={`${openDomainId ? 'h-full' : 'h-auto'} pr-2`}>
                                <div className="bg-card/20 rounded-lg border border-border/20">
                {domains.map((domain, index) => (
                  <RubricDomainComponent
                    key={domain.id}
                    domain={domain}
                    score={scores[domain.id]}
                    onScoreChange={(s) => handleScoreChange(domain.id, s)}
                    isOpen={openDomainId === domain.id}
                    onToggle={() => setOpenDomainId((prev) => (prev === domain.id ? null : domain.id))}
                  />
                ))}
              </div>
                </ScrollArea>
              </div>

              {/* Feedback and Actions - positioned based on domain state */}
              <div className={`flex flex-col gap-4 ${openDomainId ? 'mt-6' : 'mt-8 flex-1 justify-center'} transition-all duration-300`}>
                {/* Feedback Section */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Additional Comments</Label>
                                  <Textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={openDomainId ? 3 : 4}
                  placeholder="Optional: Add specific feedback or observations..."
                  className="resize-none border-border/30 bg-muted/20 focus:bg-card/40 transition-colors"
                />
                </div>

                {/* Action Bar */}
                <div className="p-4 bg-card/20 border border-border/20 rounded-lg">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className={`w-2 h-2 rounded-full ${canSubmit ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        {canSubmit ? 'Ready to submit' : `${totalDomains - scoredCount} domains remaining`}
                      </div>
                      {/* Debug info */}
                      <div className="text-xs text-muted-foreground/60">
                        ({scoredCount}/{totalDomains})
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        onClick={() => onExit?.()}
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleSubmitGrade} 
                        disabled={isSubmitting || !canSubmit}
                        size="sm"
                        className={`transition-all ${canSubmit ? 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/25' : ''}`}
                      >
                        {isSubmitting ? (
                          <>
                            <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin mr-2" />
                            Submitting...
                          </>
                        ) : (
                          'Submit Evaluation'
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
