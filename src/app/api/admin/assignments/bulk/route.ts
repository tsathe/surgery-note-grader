import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options)
              })
            } catch (error) {
              // Handle cookie setting errors
            }
          },
        },
      }
    )

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: adminCheck } = await supabase
      .from('admin_emails')
      .select('email')
      .eq('email', user.email)
      .single()

    if (!adminCheck) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { 
      note_ids, 
      user_ids, 
      assignment_type, 
      due_date, 
      priority = 1,
      notes 
    } = body

    // Validate input
    if (!note_ids || !Array.isArray(note_ids) || note_ids.length === 0) {
      return NextResponse.json({ 
        error: 'note_ids is required and must be a non-empty array' 
      }, { status: 400 })
    }

    if (assignment_type === 'specific' && (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0)) {
      return NextResponse.json({ 
        error: 'user_ids is required for specific assignment type' 
      }, { status: 400 })
    }

    if (!['auto', 'specific', 'duplicate'].includes(assignment_type)) {
      return NextResponse.json({ 
        error: 'assignment_type must be one of: auto, specific, duplicate' 
      }, { status: 400 })
    }

    const results = {
      successful_assignments: [],
      failed_assignments: [],
      total_notes: note_ids.length,
      total_assignments_created: 0
    }

    // Process each note
    for (const note_id of note_ids) {
      try {
        // Verify note exists
        const { data: note, error: noteError } = await supabase
          .from('surgery_notes')
          .select('id, title')
          .eq('id', note_id)
          .single()

        if (noteError || !note) {
          results.failed_assignments.push({
            note_id,
            error: 'Note not found'
          })
          continue
        }

        let targetUsers = []

        if (assignment_type === 'auto') {
          // Auto-assign to user with least workload
          const { data: workloadData } = await supabase.rpc('get_workload_balance')
          if (workloadData && workloadData.length > 0) {
            // Sort by active assignments (ascending) then by random
            const sortedUsers = workloadData.sort((a, b) => {
              if (a.active_assignments !== b.active_assignments) {
                return a.active_assignments - b.active_assignments
              }
              return Math.random() - 0.5 // Random tiebreaker
            })
            targetUsers = [sortedUsers[0].user_id]
          }
        } else if (assignment_type === 'specific') {
          targetUsers = user_ids
        } else if (assignment_type === 'duplicate') {
          // Assign to all available users for inter-rater reliability
          const { data: availableUsers } = await supabase
            .from('users')
            .select('id')
          
          if (availableUsers) {
            targetUsers = availableUsers.map(u => u.id)
          }
        }

        if (targetUsers.length === 0) {
          results.failed_assignments.push({
            note_id,
            error: 'No target users found'
          })
          continue
        }

        // Create assignments for each target user
        const assignmentsToCreate = []
        for (const target_user_id of targetUsers) {
          // Check for existing assignment
          const { data: existingAssignment } = await supabase
            .from('assignments')
            .select('id')
            .eq('note_id', note_id)
            .eq('user_id', target_user_id)
            .single()

          if (!existingAssignment) {
            assignmentsToCreate.push({
              note_id,
              user_id: target_user_id,
              assigned_by: user.id,
              due_date: due_date || null,
              priority,
              notes: notes || null
            })
          }
        }

        if (assignmentsToCreate.length > 0) {
          const { data: createdAssignments, error: createError } = await supabase
            .from('assignments')
            .insert(assignmentsToCreate)
            .select(`
              *,
              surgery_notes (title, phase),
              users!assignments_user_id_fkey (email, first_name, last_name, role)
            `)

          if (createError) {
            results.failed_assignments.push({
              note_id,
              error: createError.message
            })
          } else {
            results.successful_assignments.push({
              note_id,
              note_title: note.title,
              assignments: createdAssignments
            })
            results.total_assignments_created += createdAssignments.length
          }
        } else {
          results.failed_assignments.push({
            note_id,
            error: 'All target users already have assignments for this note'
          })
        }

      } catch (error) {
        results.failed_assignments.push({
          note_id,
          error: String(error)
        })
      }
    }

    return NextResponse.json({
      success: true,
      results
    })

  } catch (error) {
    console.error('Error in bulk assignment:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: String(error)
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options)
              })
            } catch (error) {
              // Handle cookie setting errors
            }
          },
        },
      }
    )

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: adminCheck } = await supabase
      .from('admin_emails')
      .select('email')
      .eq('email', user.email)
      .single()

    if (!adminCheck) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get workload balance for assignment planning
    const { data: workloadBalance, error: workloadError } = await supabase.rpc('get_workload_balance')

    if (workloadError) {
      console.error('Error fetching workload balance:', workloadError)
      return NextResponse.json({ error: 'Failed to fetch workload data' }, { status: 500 })
    }

    // Get unassigned notes
    const { data: unassignedNotes, error: notesError } = await supabase
      .from('surgery_notes')
      .select('id, title, phase, complexity, created_at')
      .eq('is_assigned', false)
      .order('created_at', { ascending: false })
      .limit(100)

    if (notesError) {
      console.error('Error fetching unassigned notes:', notesError)
      return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
    }

    return NextResponse.json({
      workload_balance: workloadBalance,
      unassigned_notes: unassignedNotes,
      statistics: {
        total_unassigned: unassignedNotes?.length || 0,
        total_users: workloadBalance?.length || 0,
        avg_workload: workloadBalance && workloadBalance.length > 0 
          ? (workloadBalance.reduce((sum, user) => sum + Number(user.active_assignments), 0) / workloadBalance.length).toFixed(1)
          : '0'
      }
    })

  } catch (error) {
    console.error('Error fetching bulk assignment data:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: String(error)
    }, { status: 500 })
  }
}
