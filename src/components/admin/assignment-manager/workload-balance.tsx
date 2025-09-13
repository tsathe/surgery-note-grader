"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  BarChart3, 
  Users, 
  Clock, 
  CheckCircle,
  TrendingUp,
  RefreshCw
} from "lucide-react"

interface UserWorkload {
  user_id: string
  user_email: string
  total_assignments: number
  active_assignments: number
  completed_assignments: number
  completion_rate: number
  avg_completion_time_hours: number
}

interface WorkloadBalanceProps {
  refreshKey: number
  onAssignmentUpdate: () => void
}

export default function WorkloadBalance({ refreshKey, onAssignmentUpdate }: WorkloadBalanceProps) {
  const [workloadData, setWorkloadData] = useState<UserWorkload[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({
    totalUsers: 0,
    avgWorkload: 0,
    maxWorkload: 0,
    minWorkload: 0,
    avgCompletionRate: 0
  })

  useEffect(() => {
    loadWorkloadData()
  }, [refreshKey])

  const loadWorkloadData = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/admin/assignments/bulk')
      
      if (response.ok) {
        const data = await response.json()
        const workload = data.workload_balance || []
        setWorkloadData(workload)
        
        // Calculate stats
        if (workload.length > 0) {
          const totalUsers = workload.length
          const activeAssignments = workload.map((u: UserWorkload) => u.active_assignments)
          const completionRates = workload.map((u: UserWorkload) => u.completion_rate)
          
          setStats({
            totalUsers,
            avgWorkload: activeAssignments.reduce((sum, val) => sum + val, 0) / totalUsers,
            maxWorkload: Math.max(...activeAssignments),
            minWorkload: Math.min(...activeAssignments),
            avgCompletionRate: completionRates.reduce((sum, val) => sum + val, 0) / totalUsers
          })
        }
      }
    } catch (error) {
      console.error('Error loading workload data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getWorkloadColor = (activeAssignments: number) => {
    if (activeAssignments === 0) return 'text-gray-500'
    if (activeAssignments <= stats.avgWorkload) return 'text-green-600'
    if (activeAssignments <= stats.avgWorkload * 1.5) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getWorkloadLevel = (activeAssignments: number) => {
    if (activeAssignments === 0) return 'No Load'
    if (activeAssignments <= stats.avgWorkload) return 'Light'
    if (activeAssignments <= stats.avgWorkload * 1.5) return 'Moderate'
    return 'Heavy'
  }

  const getCompletionRateColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600'
    if (rate >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Workload Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading workload data...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Graders</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">Active users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Workload</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgWorkload.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">
              Range: {stats.minWorkload} - {stats.maxWorkload}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgCompletionRate.toFixed(0)}%</div>
            <p className="text-xs text-muted-foreground">Overall performance</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actions</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                loadWorkloadData()
                onAssignmentUpdate()
              }}
              className="w-full"
            >
              Refresh Data
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* User Workload Details */}
      <Card>
        <CardHeader>
          <CardTitle>Individual Workload Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {workloadData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No workload data available
            </div>
          ) : (
            <div className="space-y-4">
              {workloadData
                .sort((a, b) => b.active_assignments - a.active_assignments)
                .map((user) => (
                  <div key={user.user_id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="font-medium">{user.user_email}</div>
                        <div className="text-sm text-muted-foreground">
                          {user.total_assignments} total assignments
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge 
                          variant="outline"
                          className={getWorkloadColor(user.active_assignments)}
                        >
                          {getWorkloadLevel(user.active_assignments)}
                        </Badge>
                        <Badge variant="secondary">
                          {user.active_assignments} active
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span>Completed</span>
                          <span className="font-medium">{user.completed_assignments}</span>
                        </div>
                        <Progress 
                          value={user.total_assignments > 0 
                            ? (user.completed_assignments / user.total_assignments) * 100 
                            : 0
                          } 
                          className="h-2"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span>Success Rate</span>
                          <span className={`font-medium ${getCompletionRateColor(user.completion_rate)}`}>
                            {user.completion_rate.toFixed(0)}%
                          </span>
                        </div>
                        <Progress 
                          value={user.completion_rate} 
                          className="h-2"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span>Avg Time</span>
                          <span className="font-medium">
                            {user.avg_completion_time_hours > 0 
                              ? `${user.avg_completion_time_hours.toFixed(1)}h`
                              : 'N/A'
                            }
                          </span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {user.avg_completion_time_hours > 0 
                              ? user.avg_completion_time_hours < 24 
                                ? 'Same day' 
                                : 'Multi-day'
                              : 'No data'
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recommendations */}
      {workloadData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Workload Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* High workload users */}
              {workloadData.filter(u => u.active_assignments > stats.avgWorkload * 1.5).length > 0 && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <h4 className="font-medium text-red-800 dark:text-red-200 mb-1">
                    Heavy Workload Alert
                  </h4>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    {workloadData.filter(u => u.active_assignments > stats.avgWorkload * 1.5)
                      .map(u => u.user_email).join(', ')} {' '}
                    {workloadData.filter(u => u.active_assignments > stats.avgWorkload * 1.5).length === 1 
                      ? 'has' : 'have'} high workload. Consider redistributing assignments.
                  </p>
                </div>
              )}

              {/* Low workload users */}
              {workloadData.filter(u => u.active_assignments < stats.avgWorkload * 0.5).length > 0 && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <h4 className="font-medium text-green-800 dark:text-green-200 mb-1">
                    Available Capacity
                  </h4>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    {workloadData.filter(u => u.active_assignments < stats.avgWorkload * 0.5)
                      .map(u => u.user_email).join(', ')} {' '}
                    {workloadData.filter(u => u.active_assignments < stats.avgWorkload * 0.5).length === 1 
                      ? 'has' : 'have'} light workload and can take on more assignments.
                  </p>
                </div>
              )}

              {/* Performance insights */}
              {workloadData.filter(u => u.completion_rate < 60 && u.total_assignments > 2).length > 0 && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                    Performance Support Needed
                  </h4>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    {workloadData.filter(u => u.completion_rate < 60 && u.total_assignments > 2)
                      .map(u => u.user_email).join(', ')} {' '}
                    {workloadData.filter(u => u.completion_rate < 60 && u.total_assignments > 2).length === 1 
                      ? 'has' : 'have'} low completion rates. Consider providing additional support.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
