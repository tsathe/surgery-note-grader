"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Users, 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Plus,
  BarChart3
} from "lucide-react"
import AssignmentTable from "./assignment-table"
import BulkAssignmentModal from "./bulk-assignment-modal"
import WorkloadBalance from "./workload-balance"
import CreateAssignmentModal from "./create-assignment-modal"

interface AssignmentStats {
  total_assignments: number
  active_assignments: number
  completed_assignments: number
  overdue_assignments: number
}

interface AssignmentManagerProps {
  onAssignmentUpdate?: () => void
}

export default function AssignmentManager({ onAssignmentUpdate }: AssignmentManagerProps) {
  const [stats, setStats] = useState<AssignmentStats>({
    total_assignments: 0,
    active_assignments: 0,
    completed_assignments: 0,
    overdue_assignments: 0
  })
  const [isLoading, setIsLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    loadStats()
  }, [refreshKey])

  const loadStats = async () => {
    try {
      const response = await fetch('/api/admin/assignments?limit=1000')
      if (response.ok) {
        const data = await response.json()
        const assignments = data.assignments || []
        
        setStats({
          total_assignments: assignments.length,
          active_assignments: assignments.filter((a: any) => 
            ['assigned', 'in_progress'].includes(a.status)
          ).length,
          completed_assignments: assignments.filter((a: any) => 
            a.status === 'completed'
          ).length,
          overdue_assignments: assignments.filter((a: any) => 
            a.is_overdue
          ).length
        })
      }
    } catch (error) {
      console.error('Error loading assignment stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
    onAssignmentUpdate?.()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">Loading assignment data...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Assignment Management</h2>
          <p className="text-muted-foreground">
            Assign surgery notes to graders and track progress
          </p>
        </div>
        <div className="flex space-x-2">
          <BulkAssignmentModal onAssignmentComplete={handleRefresh} />
          <CreateAssignmentModal onAssignmentComplete={handleRefresh} />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assignments</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_assignments}</div>
            <p className="text-xs text-muted-foreground">
              All assignments created
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.active_assignments}</div>
            <p className="text-xs text-muted-foreground">
              In progress or assigned
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed_assignments}</div>
            <p className="text-xs text-muted-foreground">
              Successfully finished
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.overdue_assignments}</div>
            <p className="text-xs text-muted-foreground">
              Past due date
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="assignments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="assignments">All Assignments</TabsTrigger>
          <TabsTrigger value="workload">Workload Balance</TabsTrigger>
        </TabsList>

        <TabsContent value="assignments" className="space-y-4">
          <AssignmentTable 
            refreshKey={refreshKey}
            onAssignmentUpdate={handleRefresh}
          />
        </TabsContent>

        <TabsContent value="workload" className="space-y-4">
          <WorkloadBalance 
            refreshKey={refreshKey}
            onAssignmentUpdate={handleRefresh}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
