import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// POST /api/admin/inter-rater/bulk - Create multiple inter-rater assignments
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      noteIds, 
      strategy, 
      dueDate,
      excludeUserIds = [],
      minAgreementThreshold = 0.7
    } = body

    if (!noteIds || !Array.isArray(noteIds) || noteIds.length === 0) {
      return NextResponse.json(
        { error: 'noteIds array is required' },
        { status: 400 }
      )
    }

    if (!strategy || !['random_pairs', 'balanced_workload', 'experience_based'].includes(strategy)) {
      return NextResponse.json(
        { error: 'Valid strategy is required (random_pairs, balanced_workload, experience_based)' },
        { status: 400 }
      )
    }

    // Get current user for created_by
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get available graders (excluding specified users)
    let gradersQuery = supabase
      .from('users')
      .select('id, email, first_name, last_name, role')
      .neq('role', 'Admin')

    if (excludeUserIds.length > 0) {
      // Convert email to user IDs if needed
      const { data: excludeUsers } = await supabase
        .from('users')
        .select('id')
        .in('email', excludeUserIds)

      const excludeIds = excludeUsers?.map(u => u.id) || []
      if (excludeIds.length > 0) {
        gradersQuery = gradersQuery.not('id', 'in', `(${excludeIds.join(',')})`)
      }
    }

    const { data: graders, error: gradersError } = await gradersQuery

    if (gradersError) {
      throw gradersError
    }

    if (!graders || graders.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 graders are required for inter-rater assignments' },
        { status: 400 }
      )
    }

    // Get current workload for balanced assignment
    const { data: workloadData, error: workloadError } = await supabase
      .rpc('get_workload_balance')

    if (workloadError) {
      console.error('Error getting workload data:', workloadError)
    }

    const workloadMap = new Map()
    if (workloadData) {
      workloadData.forEach((w: any) => {
        workloadMap.set(w.user_id, w.active_assignments || 0)
      })
    }

    const results = []
    const errors = []
    const assignmentGroupId = crypto.randomUUID()

    // Create assignments based on strategy
    for (const noteId of noteIds) {
      try {
        let primaryGrader, secondaryGrader

        switch (strategy) {
          case 'random_pairs':
            const shuffled = [...graders].sort(() => Math.random() - 0.5)
            primaryGrader = shuffled[0]
            secondaryGrader = shuffled[1]
            break

          case 'balanced_workload':
            const sortedByWorkload = [...graders].sort((a, b) => {
              const aWorkload = workloadMap.get(a.id) || 0
              const bWorkload = workloadMap.get(b.id) || 0
              return aWorkload - bWorkload
            })
            primaryGrader = sortedByWorkload[0]
            secondaryGrader = sortedByWorkload[1]
            // Update workload tracking
            workloadMap.set(primaryGrader.id, (workloadMap.get(primaryGrader.id) || 0) + 1)
            workloadMap.set(secondaryGrader.id, (workloadMap.get(secondaryGrader.id) || 0) + 1)
            break

          case 'experience_based':
            // Pair experienced with less experienced
            const experienced = graders.filter(g => g.role === 'Attending' || g.role === 'Fellow')
            const lessExperienced = graders.filter(g => g.role === 'Resident' || g.role === 'Student')
            
            if (experienced.length > 0 && lessExperienced.length > 0) {
              primaryGrader = experienced[Math.floor(Math.random() * experienced.length)]
              secondaryGrader = lessExperienced[Math.floor(Math.random() * lessExperienced.length)]
            } else {
              // Fallback to random if not enough variety
              const shuffled = [...graders].sort(() => Math.random() - 0.5)
              primaryGrader = shuffled[0]
              secondaryGrader = shuffled[1]
            }
            break

          default:
            throw new Error('Invalid strategy')
        }

        // Create the assignment
        const { data: assignmentId, error: createError } = await supabase
          .rpc('create_inter_rater_assignment', {
            p_note_id: noteId,
            p_primary_grader_id: primaryGrader.id,
            p_secondary_grader_id: secondaryGrader.id,
            p_created_by: user.id,
            p_due_date: dueDate || null,
            p_assignment_group_id: assignmentGroupId
          })

        if (createError) {
          throw createError
        }

        results.push({
          noteId,
          assignmentId,
          primaryGrader: {
            id: primaryGrader.id,
            name: `${primaryGrader.first_name} ${primaryGrader.last_name}`,
            email: primaryGrader.email
          },
          secondaryGrader: {
            id: secondaryGrader.id,
            name: `${secondaryGrader.first_name} ${secondaryGrader.last_name}`,
            email: secondaryGrader.email
          }
        })

      } catch (error) {
        console.error(`Error creating assignment for note ${noteId}:`, error)
        errors.push({
          noteId,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      assignmentGroupId,
      created: results.length,
      failed: errors.length,
      results,
      errors,
      strategy,
      summary: {
        totalNotes: noteIds.length,
        successfulAssignments: results.length,
        failedAssignments: errors.length,
        gradersUsed: graders.length
      }
    })

  } catch (error) {
    console.error('Error in POST /api/admin/inter-rater/bulk:', error)
    return NextResponse.json(
      { error: 'Failed to create bulk inter-rater assignments' },
      { status: 500 }
    )
  }
}
