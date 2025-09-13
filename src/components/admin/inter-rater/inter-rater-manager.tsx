"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Users2, 
  FileText, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  BarChart3
} from "lucide-react"
import InterRaterTable from "./inter-rater-table"
import BulkInterRaterModal from "./bulk-inter-rater-modal"
import CreateInterRaterModal from "./create-inter-rater-modal"
import ConsensusWorkflow from "./consensus-workflow"
import AgreementAnalytics from "./agreement-analytics"

interface InterRaterStats {
  total_assignments: number
  completed_assignments: number
  pending_consensus: number
  avg_agreement_score: number
  high_agreement_count: number
  low_agreement_count: number
}

interface InterRaterManagerProps {
  onAssignmentUpdate?: () => void
}

export default function InterRaterManager({ onAssignmentUpdate }: InterRaterManagerProps) {
  const [stats, setStats] = useState<InterRaterStats>({
    total_assignments: 0,
    completed_assignments: 0,
    pending_consensus: 0,
    avg_agreement_score: 0,
    high_agreement_count: 0,
    low_agreement_count: 0
  })
  const [isLoading, setIsLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    loadStats()
  }, [refreshKey])

  const loadStats = async () => {
    try {
      const response = await fetch('/api/admin/inter-rater?limit=1000')
      if (response.ok) {
        const data = await response.json()
        setStats(data.stats || {
          total_assignments: 0,
          completed_assignments: 0,
          pending_consensus: 0,
          avg_agreement_score: 0,
          high_agreement_count: 0,
          low_agreement_count: 0
        })
      }
    } catch (error) {
      console.error('Error loading inter-rater stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
    onAssignmentUpdate?.()
  }

  const formatAgreementScore = (score: number) => {
    return (score * 100).toFixed(1) + '%'
  }

  const getAgreementColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600'
    if (score >= 0.7) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">Loading inter-rater reliability data...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Inter-rater Reliability</h2>
          <p className="text-muted-foreground">
            Manage dual assignments and track agreement between graders
          </p>
        </div>
        <div className="flex space-x-2">
          <BulkInterRaterModal onAssignmentComplete={handleRefresh} />
          <CreateInterRaterModal onAssignmentComplete={handleRefresh} />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pairs</CardTitle>
            <Users2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_assignments}</div>
            <p className="text-xs text-muted-foreground">
              Inter-rater assignments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed_assignments}</div>
            <p className="text-xs text-muted-foreground">
              Both graders finished
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Agreement</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getAgreementColor(stats.avg_agreement_score)}`}>
              {formatAgreementScore(stats.avg_agreement_score)}
            </div>
            <p className="text-xs text-muted-foreground">
              Overall agreement rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Agreement</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.high_agreement_count}</div>
            <p className="text-xs text-muted-foreground">
              ≥80% agreement
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Agreement</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.low_agreement_count}</div>
            <p className="text-xs text-muted-foreground">
              &lt;70% agreement
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Need Consensus</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending_consensus}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting resolution
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="assignments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="assignments">All Assignments</TabsTrigger>
          <TabsTrigger value="consensus">Consensus Workflow</TabsTrigger>
          <TabsTrigger value="analytics">Agreement Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="assignments" className="space-y-4">
          <InterRaterTable 
            refreshKey={refreshKey}
            onAssignmentUpdate={handleRefresh}
          />
        </TabsContent>

        <TabsContent value="consensus" className="space-y-4">
          <ConsensusWorkflow 
            refreshKey={refreshKey}
            onConsensusUpdate={handleRefresh}
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <AgreementAnalytics 
            refreshKey={refreshKey}
            stats={stats}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
