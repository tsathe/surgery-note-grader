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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Plus, AlertCircle, Loader2 } from "lucide-react"

interface SurgeryNote {
  id: string
  title: string
  phase: string
  complexity?: number
}

interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  role: string
}

interface CreateAssignmentModalProps {
  onAssignmentComplete: () => void
}

export default function CreateAssignmentModal({ onAssignmentComplete }: CreateAssignmentModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Form state
  const [noteId, setNoteId] = useState('')
  const [userId, setUserId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState(1)
  const [notes, setNotes] = useState('')

  // Data state
  const [surgeryNotes, setSurgeryNotes] = useState<SurgeryNote[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen])

  const loadData = async () => {
    try {
      setIsLoading(true)
      
      // Load surgery notes and users in parallel
      const [notesResponse, usersResponse] = await Promise.all([
        fetch('/api/admin/surgery-notes?limit=200'),
        fetch('/api/admin/users')
      ])

      if (notesResponse.ok) {
        const notesData = await notesResponse.json()
        setSurgeryNotes(notesData.notes || [])
      }

      if (usersResponse.ok) {
        const usersData = await usersResponse.json()
        setUsers(usersData.users || [])
      }
    } catch (err) {
      setError('Failed to load data: ' + String(err))
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!noteId || !userId) {
      setError('Please select both a note and a user')
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)

      const response = await fetch('/api/admin/assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          note_id: noteId,
          user_id: userId,
          due_date: dueDate || null,
          priority,
          notes: notes || null
        }),
      })

      const data = await response.json()

      if (response.ok) {
        handleReset()
        setIsOpen(false)
        onAssignmentComplete()
      } else {
        setError(data.error || 'Failed to create assignment')
      }
    } catch (err) {
      setError('Error creating assignment: ' + String(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReset = () => {
    setNoteId('')
    setUserId('')
    setDueDate('')
    setPriority(1)
    setNotes('')
    setError(null)
  }

  const handleClose = () => {
    if (!isSubmitting) {
      setIsOpen(false)
      handleReset()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Create Assignment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Assignment</DialogTitle>
          <DialogDescription>
            Assign a specific surgery note to a grader
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading data...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Surgery Note Selection */}
            <div className="space-y-2">
              <Label htmlFor="note">Surgery Note *</Label>
              <Select value={noteId} onValueChange={setNoteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a surgery note" />
                </SelectTrigger>
                <SelectContent>
                  {surgeryNotes.map((note) => (
                    <SelectItem key={note.id} value={note.id}>
                      <div className="flex flex-col">
                        <span>{note.title}</span>
                        <span className="text-sm text-muted-foreground">
                          Phase {note.phase}
                          {note.complexity && ` • Complexity ${note.complexity}`}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* User Selection */}
            <div className="space-y-2">
              <Label htmlFor="user">Assign to *</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a grader" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex flex-col">
                        <span>{user.first_name} {user.last_name}</span>
                        <span className="text-sm text-muted-foreground">
                          {user.email} • {user.role}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <Label htmlFor="due-date">Due Date (Optional)</Label>
              <Input
                id="due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            {/* Priority */}
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

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="assignment-notes">Notes (Optional)</Label>
              <Textarea
                id="assignment-notes"
                placeholder="Add any special instructions..."
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
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={!noteId || !userId || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Assignment'
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
