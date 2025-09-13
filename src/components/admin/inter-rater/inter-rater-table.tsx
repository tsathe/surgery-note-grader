"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { 
  Eye, 
  Users2, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  Filter
} from "lucide-react"
import { format } from "date-fns"

interface InterRaterAssignment {
  id: string
  note_id: string
  note_title: string
  note_phase: string
  assignment_group_id: string
  primary_grader_email: string
  primary_grader_first_name: string
  primary_grader_last_name: string
  secondary_grader_email: string
  secondary_grader_first_name: string
  secondary_grader_last_name: string
  consensus_grader_email?: string
  primary_status: string
  secondary_status: string
  consensus_status: string
  agreement_score?: number
  agreement_level: string
  needs_consensus: boolean
  is_overdue: boolean
  created_at: string
  due_date?: string
}

interface InterRaterTableProps {
  refreshKey: number
  onAssignmentUpdate: () => void
}

export default function InterRaterTable({ refreshKey, onAssignmentUpdate }: InterRaterTableProps) {
  const [assignments, setAssignments] = useState<InterRaterAssignment[]>([])
  const [filteredAssignments, setFilteredAssignments] = useState<InterRaterAssignment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [agreementFilter, setAgreementFilter] = useState<string>('all')

  useEffect(() => {
    loadAssignments()
  }, [refreshKey])

  useEffect(() => {
    filterAssignments()
  }, [assignments, searchTerm, statusFilter, agreementFilter])

  const loadAssignments = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/admin/inter-rater?limit=1000')
      if (response.ok) {
        const data = await response.json()
        setAssignments(data.assignments || [])
      }
    } catch (error) {
      console.error('Error loading inter-rater assignments:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filterAssignments = () => {
    let filtered = [...assignments]

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(assignment =>
        assignment.note_title.toLowerCase().includes(term) ||
        assignment.primary_grader_email.toLowerCase().includes(term) ||
        assignment.secondary_grader_email.toLowerCase().includes(term) ||
        `${assignment.primary_grader_first_name} ${assignment.primary_grader_last_name}`.toLowerCase().includes(term) ||
        `${assignment.secondary_grader_first_name} ${assignment.secondary_grader_last_name}`.toLowerCase().includes(term)
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(assignment => {
        switch (statusFilter) {
          case 'pending':
            return assignment.primary_status !== 'completed' || assignment.secondary_status !== 'completed'
          case 'completed':
            return assignment.primary_status === 'completed' && assignment.secondary_status === 'completed'
          case 'needs_consensus':
            return assignment.needs_consensus && assignment.consensus_status === 'pending'
          case 'overdue':
            return assignment.is_overdue
          default:
            return true
        }
      })
    }

    // Agreement filter
    if (agreementFilter !== 'all') {
      filtered = filtered.filter(assignment => 
        assignment.agreement_level === agreementFilter
      )
    }

    setFilteredAssignments(filtered)
  }

  const getStatusBadge = (primaryStatus: string, secondaryStatus: string) => {
    if (primaryStatus === 'completed' && secondaryStatus === 'completed') {
      return <Badge variant="default" className="bg-green-100 text-green-800">Both Complete</Badge>
    } else if (primaryStatus === 'completed' || secondaryStatus === 'completed') {
      return <Badge variant="secondary">Partially Complete</Badge>
    } else if (primaryStatus === 'in_progress' || secondaryStatus === 'in_progress') {
      return <Badge variant="outline">In Progress</Badge>
    } else {
      return <Badge variant="secondary">Assigned</Badge>
    }
  }

  const getAgreementBadge = (level: string, score?: number) => {
    const scoreText = score ? ` (${(score * 100).toFixed(1)}%)` : ''
    
    switch (level) {
      case 'high':
        return <Badge variant="default" className="bg-green-100 text-green-800">High{scoreText}</Badge>
      case 'moderate':
        return <Badge variant="default" className="bg-yellow-100 text-yellow-800">Moderate{scoreText}</Badge>
      case 'low':
        return <Badge variant="destructive">Low{scoreText}</Badge>
      default:
        return <Badge variant="secondary">Pending</Badge>
    }
  }

  const getConsensusStatusBadge = (status: string, needsConsensus: boolean) => {
    if (!needsConsensus && status === 'resolved') {
      return <Badge variant="default" className="bg-green-100 text-green-800">No Consensus Needed</Badge>
    }
    
    switch (status) {
      case 'pending':
        return <Badge variant="destructive">Consensus Required</Badge>
      case 'in_progress':
        return <Badge variant="outline">Resolving</Badge>
      case 'resolved':
        return <Badge variant="default" className="bg-green-100 text-green-800">Resolved</Badge>
      case 'escalated':
        return <Badge variant="destructive">Escalated</Badge>
      default:
        return <Badge variant="secondary">Unknown</Badge>
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Inter-rater Assignments</CardTitle>
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
        <CardTitle className="flex items-center gap-2">
          <Users2 className="h-5 w-5" />
          Inter-rater Assignments
          <Badge variant="secondary">{filteredAssignments.length}</Badge>
        </CardTitle>
        
        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search assignments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="needs_consensus">Needs Consensus</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>

          <Select value={agreementFilter} onValueChange={setAgreementFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by agreement" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agreement Levels</SelectItem>
              <SelectItem value="high">High Agreement</SelectItem>
              <SelectItem value="moderate">Moderate Agreement</SelectItem>
              <SelectItem value="low">Low Agreement</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Note</TableHead>
                <TableHead>Primary Grader</TableHead>
                <TableHead>Secondary Grader</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Agreement</TableHead>
                <TableHead>Consensus</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssignments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No inter-rater assignments found
                  </TableCell>
                </TableRow>
              ) : (
                filteredAssignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{assignment.note_title}</div>
                        <div className="text-sm text-muted-foreground">
                          {assignment.note_phase}
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">
                          {assignment.primary_grader_first_name} {assignment.primary_grader_last_name}
                        </div>
                        <div className="text-muted-foreground">
                          {assignment.primary_grader_email}
                        </div>
                        <Badge 
                          variant={assignment.primary_status === 'completed' ? 'default' : 'secondary'}
                          className="mt-1"
                        >
                          {assignment.primary_status}
                        </Badge>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">
                          {assignment.secondary_grader_first_name} {assignment.secondary_grader_last_name}
                        </div>
                        <div className="text-muted-foreground">
                          {assignment.secondary_grader_email}
                        </div>
                        <Badge 
                          variant={assignment.secondary_status === 'completed' ? 'default' : 'secondary'}
                          className="mt-1"
                        >
                          {assignment.secondary_status}
                        </Badge>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      {getStatusBadge(assignment.primary_status, assignment.secondary_status)}
                      {assignment.is_overdue && (
                        <Badge variant="destructive" className="ml-2">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Overdue
                        </Badge>
                      )}
                    </TableCell>
                    
                    <TableCell>
                      {getAgreementBadge(assignment.agreement_level, assignment.agreement_score)}
                    </TableCell>
                    
                    <TableCell>
                      {getConsensusStatusBadge(assignment.consensus_status, assignment.needs_consensus)}
                    </TableCell>
                    
                    <TableCell>
                      {assignment.due_date ? (
                        <div className="text-sm">
                          {format(new Date(assignment.due_date), 'MMM dd, yyyy')}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No due date</span>
                      )}
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // TODO: Open assignment details modal
                            console.log('View details for assignment:', assignment.id)
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        
                        {assignment.needs_consensus && assignment.consensus_status === 'pending' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // TODO: Open consensus resolution modal
                              console.log('Resolve consensus for assignment:', assignment.id)
                            }}
                          >
                            <TrendingUp className="h-4 w-4" />
                          </Button>
                        )}
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
  )
}
