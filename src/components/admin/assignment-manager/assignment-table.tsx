"use client"

import { useState, useEffect } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  MoreHorizontal, 
  Search, 
  Filter,
  Calendar,
  User,
  FileText,
  Trash2,
  Edit
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface Assignment {
  id: string
  note_id: string
  user_id: string
  status: string
  priority: number
  assigned_at: string
  due_date?: string
  started_at?: string
  completed_at?: string
  note_title: string
  note_phase: string
  note_complexity?: number
  assignee_email: string
  assignee_first_name: string
  assignee_last_name: string
  assignee_role: string
  assigned_by_email: string
  is_overdue: boolean
  completion_time_hours?: number
}

interface AssignmentTableProps {
  refreshKey: number
  onAssignmentUpdate: () => void
}

export default function AssignmentTable({ refreshKey, onAssignmentUpdate }: AssignmentTableProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [filteredAssignments, setFilteredAssignments] = useState<Assignment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [userFilter, setUserFilter] = useState("all")
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    has_more: false
  })

  useEffect(() => {
    loadAssignments()
  }, [refreshKey])

  useEffect(() => {
    applyFilters()
  }, [assignments, searchTerm, statusFilter, userFilter])

  const loadAssignments = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/admin/assignments?limit=200')
      
      if (response.ok) {
        const data = await response.json()
        setAssignments(data.assignments || [])
        setPagination(data.pagination || {
          total: 0,
          limit: 50,
          offset: 0,
          has_more: false
        })
      } else {
        console.error('Failed to load assignments')
      }
    } catch (error) {
      console.error('Error loading assignments:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = assignments

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(assignment =>
        assignment.note_title.toLowerCase().includes(term) ||
        assignment.assignee_email.toLowerCase().includes(term) ||
        assignment.assignee_first_name.toLowerCase().includes(term) ||
        assignment.assignee_last_name.toLowerCase().includes(term)
      )
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(assignment => assignment.status === statusFilter)
    }

    // User filter
    if (userFilter !== "all") {
      filtered = filtered.filter(assignment => assignment.user_id === userFilter)
    }

    setFilteredAssignments(filtered)
  }

  const handleStatusUpdate = async (assignmentId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/admin/assignments/${assignmentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        loadAssignments()
        onAssignmentUpdate()
      } else {
        console.error('Failed to update assignment status')
      }
    } catch (error) {
      console.error('Error updating assignment:', error)
    }
  }

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to delete this assignment?')) return

    try {
      const response = await fetch(`/api/admin/assignments/${assignmentId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        loadAssignments()
        onAssignmentUpdate()
      } else {
        console.error('Failed to delete assignment')
      }
    } catch (error) {
      console.error('Error deleting assignment:', error)
    }
  }

  const getStatusBadge = (status: string, isOverdue: boolean) => {
    if (isOverdue && status !== 'completed') {
      return <Badge variant="destructive">Overdue</Badge>
    }

    switch (status) {
      case 'assigned':
        return <Badge variant="secondary">Assigned</Badge>
      case 'in_progress':
        return <Badge variant="default">In Progress</Badge>
      case 'completed':
        return <Badge variant="outline" className="border-green-200 text-green-700 bg-green-50">Completed</Badge>
      case 'cancelled':
        return <Badge variant="outline">Cancelled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getPriorityBadge = (priority: number) => {
    const colors = {
      1: 'bg-gray-100 text-gray-800',
      2: 'bg-blue-100 text-blue-800',
      3: 'bg-yellow-100 text-yellow-800',
      4: 'bg-orange-100 text-orange-800',
      5: 'bg-red-100 text-red-800'
    }
    
    return (
      <Badge variant="outline" className={colors[priority as keyof typeof colors] || colors[1]}>
        P{priority}
      </Badge>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  // Get unique users for filter
  const uniqueUsers = Array.from(
    new Map(assignments.map(a => [a.user_id, a])).values()
  )

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading assignments...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Assignments ({filteredAssignments.length})</span>
          <Button variant="outline" onClick={loadAssignments} size="sm">
            Refresh
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search by note title or assignee..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              {uniqueUsers.map((user) => (
                <SelectItem key={user.user_id} value={user.user_id}>
                  {user.assignee_first_name} {user.assignee_last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Note</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssignments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {assignments.length === 0 ? 'No assignments found' : 'No assignments match your filters'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredAssignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{assignment.note_title}</div>
                        <div className="text-sm text-muted-foreground">
                          Phase {assignment.note_phase}
                          {assignment.note_complexity && (
                            <span> • Complexity {assignment.note_complexity}</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">
                          {assignment.assignee_first_name} {assignment.assignee_last_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {assignment.assignee_role}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(assignment.status, assignment.is_overdue)}
                    </TableCell>
                    <TableCell>
                      {getPriorityBadge(assignment.priority)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {formatDate(assignment.assigned_at)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {assignment.due_date ? (
                        <div className={`text-sm ${
                          assignment.is_overdue ? 'text-red-600 font-medium' : ''
                        }`}>
                          {formatDate(assignment.due_date)}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">No due date</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm space-y-1">
                        {assignment.started_at && (
                          <div>Started: {formatDateTime(assignment.started_at)}</div>
                        )}
                        {assignment.completed_at && (
                          <div className="text-green-600">
                            Completed: {formatDateTime(assignment.completed_at)}
                          </div>
                        )}
                        {assignment.completion_time_hours && (
                          <div className="text-muted-foreground">
                            {assignment.completion_time_hours.toFixed(1)}h
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {assignment.status === 'assigned' && (
                            <DropdownMenuItem
                              onClick={() => handleStatusUpdate(assignment.id, 'in_progress')}
                            >
                              Mark In Progress
                            </DropdownMenuItem>
                          )}
                          {assignment.status === 'in_progress' && (
                            <DropdownMenuItem
                              onClick={() => handleStatusUpdate(assignment.id, 'completed')}
                            >
                              Mark Completed
                            </DropdownMenuItem>
                          )}
                          {assignment.status !== 'completed' && (
                            <DropdownMenuItem
                              onClick={() => handleStatusUpdate(assignment.id, 'cancelled')}
                            >
                              Cancel Assignment
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleDeleteAssignment(assignment.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination info */}
        {filteredAssignments.length > 0 && (
          <div className="text-sm text-muted-foreground">
            Showing {filteredAssignments.length} of {assignments.length} assignments
          </div>
        )}
      </CardContent>
    </Card>
  )
}
