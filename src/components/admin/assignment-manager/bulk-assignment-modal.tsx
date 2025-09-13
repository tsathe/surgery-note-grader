"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Users, 
  FileText, 
  Calendar,
  AlertCircle,
  CheckCircle,
  Loader2,
  Zap
} from "lucide-react"

interface UnassignedNote {
  id: string
  title: string
  phase: string
  complexity?: number
  created_at: string
}

interface User {
  user_id: string
  user_email: string
  total_assignments: number
  active_assignments: number
  completed_assignments: number
  completion_rate: number
}

interface BulkAssignmentResult {
  successful_assignments: Array<{
    note_id: string
    note_title: string
    assignments: any[]
  }>
  failed_assignments: Array<{
    note_id: string
    error: string
  }>
  total_notes: number
  total_assignments_created: number
}

interface BulkAssignmentModalProps {
  onAssignmentComplete: () => void
}

export default function BulkAssignmentModal({ onAssignmentComplete }: BulkAssignmentModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Form state
  const [assignmentType, setAssignmentType] = useState<'auto' | 'specific' | 'duplicate'>('auto')
  const [selectedNotes, setSelectedNotes] = useState<string[]>([])
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState(1)
  const [notes, setNotes] = useState('')

  // Data state
  const [unassignedNotes, setUnassignedNotes] = useState<UnassignedNote[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [result, setResult] = useState<BulkAssignmentResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen])

  const loadData = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/admin/assignments/bulk')
      
      if (response.ok) {
        const data = await response.json()
        setUnassignedNotes(data.unassigned_notes || [])
        setUsers(data.workload_balance || [])
      } else {
        setError('Failed to load assignment data')
      }
    } catch (err) {
      setError('Error loading data: ' + String(err))
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (selectedNotes.length === 0) {
      setError('Please select at least one note')
      return
    }

    if (assignmentType === 'specific' && selectedUsers.length === 0) {
      setError('Please select at least one user for specific assignment')
      return
    }

    try {
      setIsProcessing(true)
      setError(null)

      const response = await fetch('/api/admin/assignments/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          note_ids: selectedNotes,
          user_ids: assignmentType === 'specific' ? selectedUsers : undefined,
          assignment_type: assignmentType,
          due_date: dueDate || null,
          priority,
          notes: notes || null
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setResult(data.results)
        onAssignmentComplete()
      } else {
        setError(data.error || 'Failed to create assignments')
      }
    } catch (err) {
      setError('Error creating assignments: ' + String(err))
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReset = () => {
    setSelectedNotes([])
    setSelectedUsers([])
    setDueDate('')
    setPriority(1)
    setNotes('')
    setResult(null)
    setError(null)
    setAssignmentType('auto')
  }

  const handleClose = () => {
    if (!isProcessing) {
      setIsOpen(false)
      handleReset()
    }
  }

  const toggleNoteSelection = (noteId: string) => {
    setSelectedNotes(prev => 
      prev.includes(noteId) 
        ? prev.filter(id => id !== noteId)
        : [...prev, noteId]
    )
  }

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const selectAllNotes = () => {
    setSelectedNotes(unassignedNotes.map(note => note.id))
  }

  const clearNoteSelection = () => {
    setSelectedNotes([])
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Zap className="h-4 w-4 mr-2" />
          Bulk Assign
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Assignment</DialogTitle>
          <DialogDescription>
            Assign multiple surgery notes to graders efficiently
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading assignment data...
          </div>
        ) : result ? (
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold text-lg">Assignment Complete</h3>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {result.total_notes}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Notes Processed
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {result.total_assignments_created}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Assignments Created
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {result.failed_assignments.length}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Failed
                  </div>
                </CardContent>
              </Card>
            </div>

            {result.failed_assignments.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-red-600">Failed Assignments</h4>
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {result.failed_assignments.map((failure, index) => (
                    <Alert key={index} variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Note {failure.note_id}:</strong> {failure.error}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={handleReset}>
                Create More Assignments
              </Button>
              <Button onClick={handleClose}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Assignment Type */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Assignment Type</Label>
              <div className="grid grid-cols-3 gap-4">
                <Card 
                  className={`cursor-pointer transition-colors ${
                    assignmentType === 'auto' ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setAssignmentType('auto')}
                >
                  <CardContent className="p-4 text-center">
                    <Zap className="h-6 w-6 mx-auto mb-2" />
                    <div className="font-medium">Auto Assign</div>
                    <div className="text-sm text-muted-foreground">
                      Balance workload automatically
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  className={`cursor-pointer transition-colors ${
                    assignmentType === 'specific' ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setAssignmentType('specific')}
                >
                  <CardContent className="p-4 text-center">
                    <Users className="h-6 w-6 mx-auto mb-2" />
                    <div className="font-medium">Specific Users</div>
                    <div className="text-sm text-muted-foreground">
                      Assign to selected users
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  className={`cursor-pointer transition-colors ${
                    assignmentType === 'duplicate' ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setAssignmentType('duplicate')}
                >
                  <CardContent className="p-4 text-center">
                    <FileText className="h-6 w-6 mx-auto mb-2" />
                    <div className="font-medium">Duplicate</div>
                    <div className="text-sm text-muted-foreground">
                      Assign to all users
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Note Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">
                  Select Notes ({selectedNotes.length} selected)
                </Label>
                <div className="space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={selectAllNotes}
                  >
                    Select All
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={clearNoteSelection}
                  >
                    Clear
                  </Button>
                </div>
              </div>
              
              <div className="border rounded-lg max-h-60 overflow-y-auto">
                {unassignedNotes.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    No unassigned notes available
                  </div>
                ) : (
                  <div className="p-2 space-y-2">
                    {unassignedNotes.map((note) => (
                      <div 
                        key={note.id}
                        className="flex items-center space-x-3 p-2 hover:bg-muted/50 rounded"
                      >
                        <Checkbox
                          checked={selectedNotes.includes(note.id)}
                          onCheckedChange={() => toggleNoteSelection(note.id)}
                        />
                        <div className="flex-1">
                          <div className="font-medium">{note.title}</div>
                          <div className="text-sm text-muted-foreground">
                            Phase {note.phase}
                            {note.complexity && ` • Complexity ${note.complexity}`}
                          </div>
                        </div>
                        <Badge variant="outline">
                          {new Date(note.created_at).toLocaleDateString()}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* User Selection (for specific assignment) */}
            {assignmentType === 'specific' && (
              <div className="space-y-3">
                <Label className="text-base font-medium">
                  Select Users ({selectedUsers.length} selected)
                </Label>
                
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  {users.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      No users available
                    </div>
                  ) : (
                    <div className="p-2 space-y-2">
                      {users.map((user) => (
                        <div 
                          key={user.user_id}
                          className="flex items-center space-x-3 p-2 hover:bg-muted/50 rounded"
                        >
                          <Checkbox
                            checked={selectedUsers.includes(user.user_id)}
                            onCheckedChange={() => toggleUserSelection(user.user_id)}
                          />
                          <div className="flex-1">
                            <div className="font-medium">{user.user_email}</div>
                            <div className="text-sm text-muted-foreground">
                              {user.active_assignments} active • {user.completed_assignments} completed
                              • {user.completion_rate}% rate
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Assignment Options */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="due-date">Due Date (Optional)</Label>
                <Input
                  id="due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority.toString()} onValueChange={(value) => setPriority(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - Low</SelectItem>
                    <SelectItem value="2">2 - Normal</SelectItem>
                    <SelectItem value="3">3 - Medium</SelectItem>
                    <SelectItem value="4">4 - High</SelectItem>
                    <SelectItem value="5">5 - Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any special instructions or notes for the assignment..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end space-x-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClose}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={selectedNotes.length === 0 || isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating Assignments...
                  </>
                ) : (
                  'Create Assignments'
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
