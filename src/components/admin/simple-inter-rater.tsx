"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { 
  FileText, 
  Users, 
  TrendingUp,
  AlertTriangle,
  CheckCircle2
} from "lucide-react"
import { format } from "date-fns"

interface NoteReliability {
  note_id: string
  title: string
  surgeon: string
  surgery_date: string
  total_graders: number
  avg_score: number
  score_variance: number
  reliability_level: 'high' | 'medium' | 'low'
  agreement_percentage: number
  last_graded: string
}

interface SimpleInterRaterProps {
  onUpdate?: () => void
}

export default function SimpleInterRater({ onUpdate }: SimpleInterRaterProps) {
  const [notes, setNotes] = useState<NoteReliability[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({
    total_notes: 0,
    high_reliability: 0,
    medium_reliability: 0,
    low_reliability: 0,
    avg_graders_per_note: 0
  })

  useEffect(() => {
    loadReliabilityData()
  }, [])

  const loadReliabilityData = async () => {
    try {
      setIsLoading(true)
      
      // Get all notes with their grading data
      const response = await fetch('/api/admin/inter-rater/simple')
      if (response.ok) {
        const data = await response.json()
        setNotes(data.notes || [])
        setStats(data.stats || {
          total_notes: 0,
          high_reliability: 0,
          medium_reliability: 0,
          low_reliability: 0,
          avg_graders_per_note: 0
        })
      }
    } catch (error) {
      console.error('Error loading reliability data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getReliabilityBadge = (level: string, percentage: number) => {
    const percentageText = `${percentage.toFixed(1)}%`
    
    switch (level) {
      case 'high':
        return <Badge variant="default" className="bg-green-100 text-green-800">High {percentageText}</Badge>
      case 'medium':
        return <Badge variant="default" className="bg-yellow-100 text-yellow-800">Medium {percentageText}</Badge>
      case 'low':
        return <Badge variant="destructive">Low {percentageText}</Badge>
      default:
        return <Badge variant="secondary">Unknown</Badge>
    }
  }

  const getReliabilityColor = (level: string) => {
    switch (level) {
      case 'high':
        return 'text-green-600'
      case 'medium':
        return 'text-yellow-600'
      case 'low':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const getGradersBadge = (count: number) => {
    if (count >= 3) {
      return <Badge variant="default" className="bg-blue-100 text-blue-800">{count} graders</Badge>
    } else if (count === 2) {
      return <Badge variant="outline">{count} graders</Badge>
    } else {
      return <Badge variant="secondary">{count} grader</Badge>
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Inter-rater Reliability</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading reliability data...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Inter-rater Reliability</h2>
          <p className="text-muted-foreground">
            Simple reliability analysis based on multiple graders per note
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Notes</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_notes}</div>
            <p className="text-xs text-muted-foreground">
              Notes with grades
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Reliability</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.high_reliability}</div>
            <p className="text-xs text-muted-foreground">
              ≥80% agreement
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Medium Reliability</CardTitle>
            <TrendingUp className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.medium_reliability}</div>
            <p className="text-xs text-muted-foreground">
              60-79% agreement
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Reliability</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.low_reliability}</div>
            <p className="text-xs text-muted-foreground">
              &lt;60% agreement
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Notes Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Note Reliability Analysis
            <Badge variant="secondary">{notes.length} notes</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Surgery Note</TableHead>
                  <TableHead>Graders</TableHead>
                  <TableHead>Avg Score</TableHead>
                  <TableHead>Reliability</TableHead>
                  <TableHead>Agreement</TableHead>
                  <TableHead>Last Graded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No notes with multiple graders found
                    </TableCell>
                  </TableRow>
                ) : (
                  notes.map((note) => (
                    <TableRow key={note.note_id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{note.title}</div>
                            <div className="text-sm text-muted-foreground">
                              {note.surgeon} • {note.surgery_date}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        {getGradersBadge(note.total_graders)}
                      </TableCell>
                      
                      <TableCell>
                        <div className={`font-semibold ${getReliabilityColor(note.reliability_level)}`}>
                          {note.avg_score.toFixed(1)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ±{note.score_variance.toFixed(1)}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        {getReliabilityBadge(note.reliability_level, note.agreement_percentage)}
                      </TableCell>
                      
                      <TableCell>
                        <div className={`text-sm font-medium ${getReliabilityColor(note.reliability_level)}`}>
                          {note.agreement_percentage.toFixed(1)}%
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="text-sm">
                          {format(new Date(note.last_graded), 'MMM dd, yyyy')}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reliability Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 rounded"></div>
              <span><strong>High (≥80%):</strong> Excellent agreement between graders</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-100 rounded"></div>
              <span><strong>Medium (60-79%):</strong> Good agreement, minor variations</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-100 rounded"></div>
              <span><strong>Low (&lt;60%):</strong> Poor agreement, needs review</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
