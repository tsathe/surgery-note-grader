"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDown, ChevronRight, Info } from "lucide-react"
import { RubricDomain } from "@/lib/types"
import { cn } from "@/lib/utils"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface RubricDomainProps {
  domain: RubricDomain
  score?: number
  onScoreChange: (score: number) => void
  isOpen?: boolean
  onToggle?: () => void
}

export default function RubricDomainComponent({ domain, score, onScoreChange, isOpen, onToggle }: RubricDomainProps) {
  const [isExpandedLocal, setIsExpandedLocal] = useState(false)
  const isExpanded = isOpen ?? isExpandedLocal
  const toggle = () => (onToggle ? onToggle() : setIsExpandedLocal(!isExpandedLocal))
  const contentRef = useRef<HTMLDivElement | null>(null)
  const [measured, setMeasured] = useState(0)

  // Measure content height to enable smooth sweep animations
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const measure = () => setMeasured(el.scrollHeight)
    measure()
    // Re-measure on resize to keep animation correct
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div className={cn(
      "group relative transition-all duration-200",
      isExpanded 
        ? "bg-accent/10" 
        : "hover:bg-accent/5",
      score ? "bg-emerald-50/50 dark:bg-emerald-950/10" : ""
    )}>
      <div className="p-4 border-b border-border/20 last:border-b-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={toggle}
              className={cn(
                "p-1.5 rounded-md transition-all hover:bg-accent/60",
                isExpanded ? "bg-accent/40" : ""
              )}
              aria-label={isExpanded ? "Collapse details" : "Expand details"}
            >
              {isExpanded ? 
                <ChevronDown className="h-4 w-4 text-foreground/80" /> : 
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground/80" />
              }
            </button>
            
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground/90">{domain.name}</h3>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={toggle}
                      className="p-1 rounded hover:bg-accent/60 transition-colors"
                      aria-label="View details"
                    >
                      <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground/70" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-sm text-xs leading-5 bg-popover/95 backdrop-blur-sm">
                    {domain.description}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {typeof score === 'number' && score > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{score}</span>
                </div>
                <span className="text-xs text-muted-foreground">/ {domain.max_score}</span>
              </div>
            )}
            {(!score || score === 0) && (
              <div className="text-xs text-muted-foreground/60">Not scored</div>
            )}
          </div>
        </div>
        
        {/* Sweep animation container */}
        <div
          style={{ height: isExpanded ? measured : 0 }}
          className="overflow-hidden transition-[height] duration-300 ease-out"
          aria-hidden={!isExpanded}
        >
          <div ref={contentRef} className="mt-4 pt-4 border-t border-border/30">
            <div className="mb-4">
              <div className="text-xs font-medium text-muted-foreground mb-1">Select rating</div>
              <div className="text-xs text-muted-foreground/70">{domain.description}</div>
            </div>
            
            <RadioGroup
              value={typeof score === 'number' && score > 0 ? String(score) : undefined}
              onValueChange={(v) => onScoreChange(Number(v))}
              className="space-y-2"
            >
              {Array.from({ length: domain.max_score }, (_, i) => i + 1).map((v) => (
                <label
                  key={v}
                  htmlFor={`${domain.id}-${v}`}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-md cursor-pointer transition-all duration-150",
                    score === v
                      ? "bg-emerald-100/80 dark:bg-emerald-900/20 shadow-sm ring-1 ring-emerald-400/30"
                      : "hover:bg-accent/30"
                  )}
                >
                  <RadioGroupItem 
                    className={cn(
                      "mt-0.5 h-4 w-4 transition-colors",
                      score === v ? "border-emerald-500 text-emerald-600" : ""
                    )} 
                    value={String(v)} 
                    id={`${domain.id}-${v}`} 
                  />
                  <div className="flex-1 min-w-0">
                    {(() => {
                      const raw = domain.score_guidance?.[v]
                      const idx = typeof raw === 'string' ? raw.indexOf(':') : -1
                      const label = idx >= 0 ? raw!.slice(0, idx).trim() : undefined
                      const desc = idx >= 0 ? raw!.slice(idx + 1).trim() : (raw ?? `Score ${v}`)
                      return (
                        <>
                          <div className="text-sm font-medium text-foreground/90 mb-1">
                            <span className="text-muted-foreground/80">Level {v}</span>
                            {label && <span className="mx-2 text-muted-foreground/60">•</span>}
                            {label && <span>{label}</span>}
                          </div>
                          <div className="text-xs text-muted-foreground/80 leading-relaxed">{desc}</div>
                        </>
                      )
                    })()}
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>
        </div>
      </div>
    </div>
  )
}
