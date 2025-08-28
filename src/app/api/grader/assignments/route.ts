import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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

    // Check if user is authorized (exists in users table)
    const { data: userCheck } = await supabase
      .from('users')
      .select('email, role')
      .eq('email', user.email)
      .single()

    if (!userCheck) {
      return NextResponse.json({ error: 'User not authorized' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query for user's assignments
    let query = supabase
      .from('assignment_dashboard')
      .select('*')
      .eq('user_id', user.id)
      .order('assigned_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply status filter
    if (status) {
      query = query.eq('status', status)
    }

    const { data: assignments, error } = await query

    if (error) {
      console.error('Error fetching user assignments:', error)
      return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 })
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('assignments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if (status) {
      countQuery = countQuery.eq('status', status)
    }

    const { count } = await countQuery

    // Get user statistics
    const { data: userStats } = await supabase.rpc('get_user_assignment_stats', {
      user_uuid: user.id
    })

    return NextResponse.json({
      assignments,
      statistics: userStats || {
        total: 0,
        assigned: 0,
        in_progress: 0,
        completed: 0,
        overdue: 0,
        avg_completion_time_hours: 0
      },
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: (count || 0) > offset + limit
      }
    })

  } catch (error) {
    console.error('Error in grader assignments API:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: String(error)
    }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
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

    // Check if user is authorized
    const { data: userCheck } = await supabase
      .from('users')
      .select('email')
      .eq('email', user.email)
      .single()

    if (!userCheck) {
      return NextResponse.json({ error: 'User not authorized' }, { status: 403 })
    }

    const body = await request.json()
    const { assignment_id, status } = body

    // Validate input
    if (!assignment_id || !status) {
      return NextResponse.json({ 
        error: 'assignment_id and status are required' 
      }, { status: 400 })
    }

    if (!['in_progress', 'completed'].includes(status)) {
      return NextResponse.json({ 
        error: 'Status must be either in_progress or completed' 
      }, { status: 400 })
    }

    // Verify assignment belongs to user
    const { data: assignment, error: fetchError } = await supabase
      .from('assignments')
      .select('*')
      .eq('id', assignment_id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    // Update assignment status
    const { data: updatedAssignment, error: updateError } = await supabase
      .from('assignments')
      .update({ status })
      .eq('id', assignment_id)
      .eq('user_id', user.id)
      .select(`
        *,
        surgery_notes (id, title, content, phase, complexity)
      `)
      .single()

    if (updateError) {
      console.error('Error updating assignment:', updateError)
      return NextResponse.json({ 
        error: 'Failed to update assignment',
        details: updateError.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      assignment: updatedAssignment
    })

  } catch (error) {
    console.error('Error updating assignment status:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: String(error)
    }, { status: 500 })
  }
}
