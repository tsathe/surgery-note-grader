import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/admin/inter-rater/simple - Get simple reliability analysis
export async function GET(request: NextRequest) {
  try {
    // Get all notes that have been graded by multiple people
    const { data: notesData, error: notesError } = await supabase
      .from('surgery_notes')
      .select(`
        id,
        title,
        surgeon,
        surgery_date,
        grades!inner(
          id,
          grader_id,
          total_score,
          created_at
        )
      `)

    if (notesError) {
      throw notesError
    }

    // Process the data to calculate reliability
    const reliabilityData = notesData?.map(note => {
      const grades = note.grades || []
      
      if (grades.length < 2) {
        return null // Skip notes with less than 2 graders
      }

      // Calculate average score and variance
      const scores = grades.map((g: any) => g.total_score)
      const avgScore = scores.reduce((sum: number, score: number) => sum + score, 0) / scores.length
      
      // Calculate variance (standard deviation)
      const variance = scores.reduce((sum: number, score: number) => 
        sum + Math.pow(score - avgScore, 2), 0) / scores.length
      const standardDeviation = Math.sqrt(variance)

      // Calculate agreement percentage based on score consistency
      // If scores are within 1 point of each other, that's high agreement
      const maxScore = Math.max(...scores)
      const minScore = Math.min(...scores)
      const scoreRange = maxScore - minScore
      
      // Calculate agreement percentage (inverse of variance)
      // Lower variance = higher agreement
      const maxPossibleVariance = 25 // Assuming max score of 5 per domain, 5 domains = 25 max variance
      const agreementPercentage = Math.max(0, 100 - (variance / maxPossibleVariance) * 100)

      // Determine reliability level
      let reliabilityLevel: 'high' | 'medium' | 'low'
      if (agreementPercentage >= 80) {
        reliabilityLevel = 'high'
      } else if (agreementPercentage >= 60) {
        reliabilityLevel = 'medium'
      } else {
        reliabilityLevel = 'low'
      }

      // Get the most recent grading date
      const lastGraded = grades.reduce((latest: string, grade: any) => 
        grade.created_at > latest ? grade.created_at : latest, grades[0].created_at)

      return {
        note_id: note.id,
        title: note.title,
        surgeon: note.surgeon,
        surgery_date: note.surgery_date,
        total_graders: grades.length,
        avg_score: avgScore,
        score_variance: standardDeviation,
        reliability_level: reliabilityLevel,
        agreement_percentage: agreementPercentage,
        last_graded: lastGraded
      }
    }).filter(Boolean) // Remove null entries

    // Calculate overall statistics
    const totalNotes = reliabilityData.length
    const highReliability = reliabilityData.filter(note => note.reliability_level === 'high').length
    const mediumReliability = reliabilityData.filter(note => note.reliability_level === 'medium').length
    const lowReliability = reliabilityData.filter(note => note.reliability_level === 'low').length
    const avgGradersPerNote = reliabilityData.reduce((sum, note) => sum + note.total_graders, 0) / totalNotes

    // Sort by reliability level (high first) then by agreement percentage
    reliabilityData.sort((a, b) => {
      const levelOrder = { high: 3, medium: 2, low: 1 }
      const levelDiff = levelOrder[b.reliability_level] - levelOrder[a.reliability_level]
      if (levelDiff !== 0) return levelDiff
      return b.agreement_percentage - a.agreement_percentage
    })

    return NextResponse.json({
      notes: reliabilityData,
      stats: {
        total_notes: totalNotes,
        high_reliability: highReliability,
        medium_reliability: mediumReliability,
        low_reliability: lowReliability,
        avg_graders_per_note: avgGradersPerNote.toFixed(1)
      }
    })

  } catch (error) {
    console.error('Error in GET /api/admin/inter-rater/simple:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reliability data' },
      { status: 500 }
    )
  }
}
