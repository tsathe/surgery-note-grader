"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Target,
  PieChart,
  Activity
} from "lucide-react"

interface AgreementAnalyticsProps {
  refreshKey: number
  stats: {
    total_assignments: number
    completed_assignments: number
    avg_agreement_score: number
    high_agreement_count: number
    low_agreement_count: number
  }
}

interface DomainAgreement {
  domain_name: string
  avg_agreement: number
  total_comparisons: number
  exact_matches: number
  disagreements: number
}

interface GraderPairAnalysis {
  grader1_name: string
  grader2_name: string
  assignments_together: number
  avg_agreement: number
  improvement_trend: 'improving' | 'stable' | 'declining'
}

export default function AgreementAnalytics({ refreshKey, stats }: AgreementAnalyticsProps) {
  const [domainAnalytics, setDomainAnalytics] = useState<DomainAgreement[]>([])
  const [graderPairs, setGraderPairs] = useState<GraderPairAnalysis[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadAnalytics()
  }, [refreshKey])

  const loadAnalytics = async () => {
    try {
      setIsLoading(true)
      
      // In a real implementation, these would be separate API calls
      // For now, we'll create mock data based on the current stats
      
      // Mock domain analytics
      const mockDomains: DomainAgreement[] = [
        {
          domain_name: "Indication for Surgery",
          avg_agreement: 0.85,
          total_comparisons: 45,
          exact_matches: 38,
          disagreements: 7
        },
        {
          domain_name: "Procedure Description",
          avg_agreement: 0.72,
          total_comparisons: 45,
          exact_matches: 32,
          disagreements: 13
        },
        {
          domain_name: "Complications",
          avg_agreement: 0.91,
          total_comparisons: 45,
          exact_matches: 41,
          disagreements: 4
        },
        {
          domain_name: "Post-operative Plan",
          avg_agreement: 0.68,
          total_comparisons: 45,
          exact_matches: 30,
          disagreements: 15
        }
      ]

      // Mock grader pair analysis
      const mockPairs: GraderPairAnalysis[] = [
        {
          grader1_name: "Dr. Smith",
          grader2_name: "Dr. Johnson",
          assignments_together: 12,
          avg_agreement: 0.82,
          improvement_trend: 'improving'
        },
        {
          grader1_name: "Dr. Brown",
          grader2_name: "Dr. Davis",
          assignments_together: 8,
          avg_agreement: 0.75,
          improvement_trend: 'stable'
        },
        {
          grader1_name: "Dr. Wilson",
          grader2_name: "Dr. Taylor",
          assignments_together: 15,
          avg_agreement: 0.69,
          improvement_trend: 'declining'
        }
      ]

      setDomainAnalytics(mockDomains)
      setGraderPairs(mockPairs)

    } catch (error) {
      console.error('Error loading agreement analytics:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getAgreementColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600'
    if (score >= 0.7) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getAgreementColorClass = (score: number) => {
    if (score >= 0.8) return 'bg-green-100 text-green-800'
    if (score >= 0.7) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-green-600" />
      case 'declining':
        return <TrendingUp className="h-4 w-4 text-red-600 rotate-180" />
      default:
        return <Activity className="h-4 w-4 text-gray-600" />
    }
  }

  const getTrendBadge = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <Badge variant="default" className="bg-green-100 text-green-800">Improving</Badge>
      case 'declining':
        return <Badge variant="destructive">Declining</Badge>
      default:
        return <Badge variant="secondary">Stable</Badge>
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agreement Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading analytics...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Agreement</CardTitle>
            <Target className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getAgreementColor(stats.avg_agreement_score)}`}>
              {(stats.avg_agreement_score * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Across all assignments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Agreement</CardTitle>
            <BarChart3 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.completed_assignments > 0 ? 
                Math.round((stats.high_agreement_count / stats.completed_assignments) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              ≥80% agreement rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Pairs</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{graderPairs.length}</div>
            <p className="text-xs text-muted-foreground">
              Grader combinations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reliability Score</CardTitle>
            <PieChart className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {stats.avg_agreement_score >= 0.8 ? 'Excellent' : 
               stats.avg_agreement_score >= 0.7 ? 'Good' : 'Needs Improvement'}
            </div>
            <p className="text-xs text-muted-foreground">
              Overall reliability
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Domain-wise Agreement Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Agreement by Rubric Domain
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {domainAnalytics.map((domain) => (
              <div key={domain.domain_name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{domain.domain_name}</div>
                  <Badge variant="default" className={getAgreementColorClass(domain.avg_agreement)}>
                    {(domain.avg_agreement * 100).toFixed(1)}%
                  </Badge>
                </div>
                
                <Progress 
                  value={domain.avg_agreement * 100} 
                  className="h-2"
                />
                
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{domain.exact_matches} exact matches</span>
                  <span>{domain.disagreements} disagreements</span>
                  <span>{domain.total_comparisons} total</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Grader Pair Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Grader Pair Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {graderPairs.map((pair, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">
                    {pair.grader1_name} & {pair.grader2_name}
                  </div>
                  <div className="flex items-center gap-2">
                    {getTrendIcon(pair.improvement_trend)}
                    {getTrendBadge(pair.improvement_trend)}
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Assignments Together</div>
                    <div className="font-semibold">{pair.assignments_together}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Average Agreement</div>
                    <div className={`font-semibold ${getAgreementColor(pair.avg_agreement)}`}>
                      {(pair.avg_agreement * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Trend</div>
                    <div className="font-semibold capitalize">{pair.improvement_trend}</div>
                  </div>
                </div>
                
                <Progress 
                  value={pair.avg_agreement * 100} 
                  className="h-2 mt-2"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            {stats.avg_agreement_score < 0.7 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="font-medium text-red-800">Low Overall Agreement Detected</div>
                <div className="text-red-700 mt-1">
                  Consider additional grader training or rubric clarification sessions.
                </div>
              </div>
            )}
            
            {domainAnalytics.some(d => d.avg_agreement < 0.7) && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="font-medium text-yellow-800">Domain-Specific Issues</div>
                <div className="text-yellow-700 mt-1">
                  Focus training on domains with low agreement: {
                    domainAnalytics
                      .filter(d => d.avg_agreement < 0.7)
                      .map(d => d.domain_name)
                      .join(', ')
                  }
                </div>
              </div>
            )}
            
            {graderPairs.some(p => p.improvement_trend === 'declining') && (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-md">
                <div className="font-medium text-orange-800">Declining Pair Performance</div>
                <div className="text-orange-700 mt-1">
                  Monitor grader pairs with declining agreement trends for potential calibration needs.
                </div>
              </div>
            )}
            
            {stats.avg_agreement_score >= 0.8 && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                <div className="font-medium text-green-800">Excellent Inter-rater Reliability</div>
                <div className="text-green-700 mt-1">
                  Your grading system shows high consistency. Consider this as a benchmark for future assessments.
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
