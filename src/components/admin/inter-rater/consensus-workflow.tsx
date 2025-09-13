"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
  AlertTriangle, 
  TrendingUp, 
  Clock, 
  Users,
  FileText,
  CheckCircle2
} from "lucide-react"
import { format } from "date-fns"

interface ConsensusItem {
  id: string
  note_title: string
  primary_grader_name: string
  secondary_grader_name: string
  agreement_score: number
  disagreement_domains: string[]
  created_at: string
  due_date?: string
  consensus_status: string
}

interface ConsensusWorkflowProps {
  refreshKey: number
  onConsensusUpdate: () => void
}

export default function ConsensusWorkflow({ refreshKey, onConsensusUpdate }: ConsensusWorkflowProps) {
  const [consensusItems, setConsensusItems] = useState<ConsensusItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadConsensusItems()
  }, [refreshKey])

  const loadConsensusItems = async () => {
    try {
      setIsLoading(true)
      // Load items that need consensus
      const response = await fetch('/api/admin/inter-rater?needsConsensus=true')
      if (response.ok) {
        const data = await response.json()
        
        // Transform the data for consensus workflow
        const items = (data.assignments || []).map((assignment: any) => ({
          id: assignment.id,
          note_title: assignment.note_title,
          primary_grader_name: `${assignment.primary_grader_first_name} ${assignment.primary_grader_last_name}`,
          secondary_grader_name: `${assignment.secondary_grader_first_name} ${assignment.secondary_grader_last_name}`,
          agreement_score: assignment.agreement_score || 0,
          disagreement_domains: [], // This would come from detailed analysis
          created_at: assignment.created_at,
          due_date: assignment.due_date,
          consensus_status: assignment.consensus_status
        }))
        
        setConsensusItems(items)
      }
    } catch (error) {
      console.error('Error loading consensus items:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleResolveConsensus = async (itemId: string) => {
    try {
      // This would open a consensus resolution modal
      console.log('Resolving consensus for item:', itemId)
      // TODO: Implement consensus resolution modal
      
      // For now, just refresh the data
      onConsensusUpdate()
    } catch (error) {
      console.error('Error resolving consensus:', error)
    }
  }

  const getAgreementBadge = (score: number) => {
    const percentage = (score * 100).toFixed(1)
    if (score >= 0.8) {
      return <Badge variant="default" className="bg-green-100 text-green-800">{percentage}%</Badge>
    } else if (score >= 0.7) {
      return <Badge variant="default" className="bg-yellow-100 text-yellow-800">{percentage}%</Badge>
    } else {
      return <Badge variant="destructive">{percentage}%</Badge>
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="destructive">Consensus Required</Badge>
      case 'in_progress':
        return <Badge variant="outline">In Progress</Badge>
      case 'resolved':
        return <Badge variant="default" className="bg-green-100 text-green-800">Resolved</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Consensus Workflow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading consensus items...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Needs Consensus</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {consensusItems.filter(item => item.consensus_status === 'pending').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Awaiting resolution
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {consensusItems.filter(item => item.consensus_status === 'in_progress').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Being resolved
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved Today</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">0</div>
            <p className="text-xs text-muted-foreground">
              Completed today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Resolution Time</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">-</div>
            <p className="text-xs text-muted-foreground">
              Hours to resolve
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Consensus Items Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Items Requiring Consensus
            <Badge variant="secondary">{consensusItems.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {consensusItems.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-green-600 mb-2">All Caught Up!</h3>
              <p className="text-muted-foreground">
                No items currently require consensus resolution.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Surgery Note</TableHead>
                    <TableHead>Primary Grader</TableHead>
                    <TableHead>Secondary Grader</TableHead>
                    <TableHead>Agreement Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consensusItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div className="font-medium">{item.note_title}</div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="text-sm">{item.primary_grader_name}</div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="text-sm">{item.secondary_grader_name}</div>
                      </TableCell>
                      
                      <TableCell>
                        {getAgreementBadge(item.agreement_score)}
                      </TableCell>
                      
                      <TableCell>
                        {getStatusBadge(item.consensus_status)}
                      </TableCell>
                      
                      <TableCell>
                        <div className="text-sm">
                          {format(new Date(item.created_at), 'MMM dd, yyyy')}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResolveConsensus(item.id)}
                          disabled={item.consensus_status !== 'pending'}
                        >
                          <TrendingUp className="h-4 w-4 mr-2" />
                          Resolve
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Consensus Resolution Process</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-semibold">
                1
              </div>
              <div>
                <div className="font-medium">Review Disagreements</div>
                <div className="text-muted-foreground">
                  Examine scoring differences between graders for each domain
                </div>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-semibold">
                2
              </div>
              <div>
                <div className="font-medium">Determine Final Scores</div>
                <div className="text-muted-foreground">
                  Set consensus scores for each disagreement domain
                </div>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-semibold">
                3
              </div>
              <div>
                <div className="font-medium">Document Resolution</div>
                <div className="text-muted-foreground">
                  Add notes explaining the reasoning for final decisions
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
