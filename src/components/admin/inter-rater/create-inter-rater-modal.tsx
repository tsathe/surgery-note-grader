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
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users2, Plus, AlertCircle } from "lucide-react"

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
  surgery_date?: string
}

interface CreateInterRaterModalProps {
  onAssignmentComplete: () => void
}

export default function CreateInterRaterModal({ onAssignmentComplete }: CreateInterRaterModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [notes, setNotes] = useState<SurgeryNote[]>([])
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    noteId: '',
    primaryGraderId: '',
    secondaryGraderId: '',
    dueDate: '',
    notes: ''
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
        // Filter out admin users for grading assignments
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.noteId || !formData.primaryGraderId || !formData.secondaryGraderId) {
      setError('Please select a note and both graders')
      return
    }

    if (formData.primaryGraderId === formData.secondaryGraderId) {
      setError('Primary and secondary graders must be different')
      return
    }

    try {
      setIsLoading(true)
      
      const response = await fetch('/api/admin/inter-rater', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          noteId: formData.noteId,
          primaryGraderId: formData.primaryGraderId,
          secondaryGraderId: formData.secondaryGraderId,
          dueDate: formData.dueDate || null,
          notes: formData.notes || null
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create inter-rater assignment')
      }

      const result = await response.json()
      
      // Reset form and close modal
      setFormData({
        noteId: '',
        primaryGraderId: '',
        secondaryGraderId: '',
        dueDate: '',
        notes: ''
      })
      setIsOpen(false)
      onAssignmentComplete()

    } catch (error) {
      console.error('Error creating inter-rater assignment:', error)
      setError(error instanceof Error ? error.message : 'Failed to create assignment')
    } finally {
      setIsLoading(false)
    }
  }

  const selectedNote = notes.find(n => n.id === formData.noteId)
  const primaryGrader = users.find(u => u.id === formData.primaryGraderId)
  const secondaryGrader = users.find(u => u.id === formData.secondaryGraderId)

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Inter-rater Assignment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users2 className="h-5 w-5" />
            Create Inter-rater Assignment
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {/* Note Selection */}
          <div className="space-y-2">
            <Label htmlFor="noteId">Surgery Note *</Label>
            <Select 
              value={formData.noteId} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, noteId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a surgery note" />
              </SelectTrigger>
              <SelectContent>
                {notes.map((note) => (
                  <SelectItem key={note.id} value={note.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{note.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {note.phase} • {note.surgeon} • {note.surgery_date}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Selected Note Preview */}
          {selectedNote && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Selected Note</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{selectedNote.title}</span>
                  <Badge variant="secondary">{selectedNote.phase}</Badge>
                </div>
                {selectedNote.complexity && (
                  <div className="text-sm text-muted-foreground">
                    Complexity: {selectedNote.complexity}
                  </div>
                )}
                {selectedNote.surgeon && (
                  <div className="text-sm text-muted-foreground">
                    Surgeon: {selectedNote.surgeon}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Grader Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primaryGraderId">Primary Grader *</Label>
              <Select 
                value={formData.primaryGraderId} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, primaryGraderId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select primary grader" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {user.first_name} {user.last_name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {user.email} • {user.role}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="secondaryGraderId">Secondary Grader *</Label>
              <Select 
                value={formData.secondaryGraderId} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, secondaryGraderId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select secondary grader" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem 
                      key={user.id} 
                      value={user.id}
                      disabled={user.id === formData.primaryGraderId}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {user.first_name} {user.last_name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {user.email} • {user.role}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Grader Preview */}
          {primaryGrader && secondaryGrader && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Assignment Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium">Primary Grader</div>
                    <div className="text-sm text-muted-foreground">
                      {primaryGrader.first_name} {primaryGrader.last_name}
                    </div>
                    <Badge variant="secondary" className="mt-1">
                      {primaryGrader.role}
                    </Badge>
                  </div>
                  <div>
                    <div className="text-sm font-medium">Secondary Grader</div>
                    <div className="text-sm text-muted-foreground">
                      {secondaryGrader.first_name} {secondaryGrader.last_name}
                    </div>
                    <Badge variant="secondary" className="mt-1">
                      {secondaryGrader.role}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

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

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Assignment Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any specific instructions or context for this inter-rater assignment..."
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
            />
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
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Assignment'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
