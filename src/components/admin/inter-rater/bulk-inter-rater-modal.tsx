"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Users2, Zap, AlertCircle, CheckCircle, Info } from "lucide-react"

interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  role: string
}

interface SurgeryNote {
  id: string
  title: string
  phase: string
  complexity?: string
  surgeon?: string
}

interface BulkInterRaterModalProps {
  onAssignmentComplete: () => void
}

export default function BulkInterRaterModal({ onAssignmentComplete }: BulkInterRaterModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [notes, setNotes] = useState<SurgeryNote[]>([])
  const [selectedNotes, setSelectedNotes] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<any>(null)
  
  const [formData, setFormData] = useState({
    strategy: 'balanced_workload',
    dueDate: '',
    excludeUserIds: [] as string[],
    minAgreementThreshold: 0.7
  })

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen])

  const loadData = async () => {
    try {
      const [usersResponse, notesResponse] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/notes?unassigned=true')
      ])

      if (usersResponse.ok) {
        const usersData = await usersResponse.json()
        const graders = usersData.users?.filter((u: User) => u.role !== 'Admin') || []
        setUsers(graders)
      }

      if (notesResponse.ok) {
        const notesData = await notesResponse.json()
        setNotes(notesData.notes || [])
      }
    } catch (error) {
      console.error('Error loading data:', error)
      setError('Failed to load users and notes')
    }
  }

  const handleNoteToggle = (noteId: string, checked: boolean) => {
    if (checked) {
      setSelectedNotes(prev => [...prev, noteId])
    } else {
      setSelectedNotes(prev => prev.filter(id => id !== noteId))
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedNotes(notes.map(note => note.id))
    } else {
      setSelectedNotes([])
    }
  }

  const handleUserExcludeToggle = (userId: string, checked: boolean) => {
    if (checked) {
      setFormData(prev => ({
        ...prev,
        excludeUserIds: [...prev.excludeUserIds, userId]
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        excludeUserIds: prev.excludeUserIds.filter(id => id !== userId)
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setResults(null)

    if (selectedNotes.length === 0) {
      setError('Please select at least one note')
      return
    }

    const availableGraders = users.filter(u => !formData.excludeUserIds.includes(u.id))
    if (availableGraders.length < 2) {
      setError('At least 2 graders must be available for inter-rater assignments')
      return
    }

    try {
      setIsLoading(true)
      
      const response = await fetch('/api/admin/inter-rater/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          noteIds: selectedNotes,
          strategy: formData.strategy,
          dueDate: formData.dueDate || null,
          excludeUserIds: formData.excludeUserIds,
          minAgreementThreshold: formData.minAgreementThreshold
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create bulk inter-rater assignments')
      }

      const result = await response.json()
      setResults(result)

      // If all successful, close modal after a delay
      if (result.failed === 0) {
        setTimeout(() => {
          setIsOpen(false)
          resetForm()
          onAssignmentComplete()
        }, 2000)
      }

    } catch (error) {
      console.error('Error creating bulk inter-rater assignments:', error)
      setError(error instanceof Error ? error.message : 'Failed to create assignments')
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      strategy: 'balanced_workload',
      dueDate: '',
      excludeUserIds: [],
      minAgreementThreshold: 0.7
    })
    setSelectedNotes([])
    setResults(null)
    setError(null)
  }

  const getStrategyDescription = (strategy: string) => {
    switch (strategy) {
      case 'random_pairs':
        return 'Randomly pair graders for each note'
      case 'balanced_workload':
        return 'Balance workload across graders (recommended)'
      case 'experience_based':
        return 'Pair experienced graders with less experienced ones'
      default:
        return ''
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Zap className="h-4 w-4 mr-2" />
          Bulk Inter-rater Assignment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users2 className="h-5 w-5" />
            Bulk Inter-rater Assignment
          </DialogTitle>
        </DialogHeader>

        {!results ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            {/* Assignment Strategy */}
            <div className="space-y-2">
              <Label>Assignment Strategy</Label>
              <Select 
                value={formData.strategy} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, strategy: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="balanced_workload">Balanced Workload</SelectItem>
                  <SelectItem value="random_pairs">Random Pairs</SelectItem>
                  <SelectItem value="experience_based">Experience-based Pairing</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {getStrategyDescription(formData.strategy)}
              </p>
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date (Optional)</Label>
              <Input
                id="dueDate"
                type="datetime-local"
                value={formData.dueDate}
                onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
              />
            </div>

            {/* Exclude Users */}
            <div className="space-y-2">
              <Label>Exclude Graders (Optional)</Label>
              <Card>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 gap-2">
                    {users.map((user) => (
                      <div key={user.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`exclude-${user.id}`}
                          checked={formData.excludeUserIds.includes(user.id)}
                          onCheckedChange={(checked) => 
                            handleUserExcludeToggle(user.id, checked as boolean)
                          }
                        />
                        <Label htmlFor={`exclude-${user.id}`} className="text-sm">
                          {user.first_name} {user.last_name}
                          <Badge variant="secondary" className="ml-2">
                            {user.role}
                          </Badge>
                        </Label>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Note Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Select Surgery Notes</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="select-all"
                    checked={selectedNotes.length === notes.length && notes.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                  <Label htmlFor="select-all" className="text-sm">
                    Select All ({notes.length})
                  </Label>
                </div>
              </div>
              
              <Card className="max-h-64 overflow-y-auto">
                <CardContent className="pt-4">
                  {notes.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No unassigned notes available
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {notes.map((note) => (
                        <div key={note.id} className="flex items-center space-x-2 p-2 border rounded">
                          <Checkbox
                            id={`note-${note.id}`}
                            checked={selectedNotes.includes(note.id)}
                            onCheckedChange={(checked) => 
                              handleNoteToggle(note.id, checked as boolean)
                            }
                          />
                          <div className="flex-1">
                            <Label htmlFor={`note-${note.id}`} className="font-medium">
                              {note.title}
                            </Label>
                            <div className="text-sm text-muted-foreground">
                              {note.phase} • {note.surgeon}
                            </div>
                          </div>
                          {note.complexity && (
                            <Badge variant="outline">{note.complexity}</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {selectedNotes.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  {selectedNotes.length} of {notes.length} notes selected
                </div>
              )}
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || selectedNotes.length === 0}>
                {isLoading ? 'Creating Assignments...' : `Create ${selectedNotes.length} Assignments`}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <h3 className="text-lg font-semibold">Assignment Results</h3>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Total Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{results.summary.totalNotes}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Successful</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{results.created}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Failed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{results.failed}</div>
                </CardContent>
              </Card>
            </div>

            {results.failed === 0 && (
              <div className="p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-md flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                All assignments created successfully! Closing in 2 seconds...
              </div>
            )}

            {results.errors && results.errors.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base text-red-600">Errors</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {results.errors.map((error: any, index: number) => (
                      <div key={index} className="text-sm">
                        <span className="font-medium">Note {error.noteId}:</span> {error.error}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end space-x-2">
              <Button
                onClick={() => {
                  setIsOpen(false)
                  resetForm()
                  onAssignmentComplete()
                }}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
