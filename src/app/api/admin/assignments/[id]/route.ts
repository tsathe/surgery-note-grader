import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params

    // Get assignment with related data
    const { data: assignment, error } = await supabase
      .from('assignment_dashboard')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    // Check permissions - admin or assigned user
    const { data: adminCheck } = await supabase
      .from('admin_emails')
      .select('email')
      .eq('email', user.email)
      .single()

    const isAdmin = !!adminCheck
    const isAssignedUser = assignment.user_id === user.id

    if (!isAdmin && !isAssignedUser) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get assignment history if admin
    let history = null
    if (isAdmin) {
      const { data: historyData } = await supabase
        .from('assignment_history')
        .select(`
          *,
          users!assignment_history_changed_by_fkey (email, first_name, last_name)
        `)
        .eq('assignment_id', id)
        .order('changed_at', { ascending: false })

      history = historyData
    }

    return NextResponse.json({
      assignment,
      history
    })

  } catch (error) {
    console.error('Error fetching assignment:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: String(error)
    }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params
    const body = await request.json()

    // Get current assignment
    const { data: currentAssignment, error: fetchError } = await supabase
      .from('assignments')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !currentAssignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    // Check permissions
    const { data: adminCheck } = await supabase
      .from('admin_emails')
      .select('email')
      .eq('email', user.email)
      .single()

    const isAdmin = !!adminCheck
    const isAssignedUser = currentAssignment.user_id === user.id

    if (!isAdmin && !isAssignedUser) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Prepare update data based on user permissions
    let updateData: any = {}

    if (isAdmin) {
      // Admins can update everything
      const { status, due_date, priority, notes, user_id } = body
      
      if (status) updateData.status = status
      if (due_date !== undefined) updateData.due_date = due_date
      if (priority !== undefined) updateData.priority = priority
      if (notes !== undefined) updateData.notes = notes
      if (user_id && user_id !== currentAssignment.user_id) {
        updateData.user_id = user_id
        updateData.assigned_by = user.id // Track who reassigned
      }
    } else if (isAssignedUser) {
      // Regular users can only update status
      const { status } = body
      if (status && ['in_progress', 'completed'].includes(status)) {
        updateData.status = status
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 })
    }

    // Update assignment
    const { data: updatedAssignment, error: updateError } = await supabase
      .from('assignments')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        surgery_notes (title, phase),
        users!assignments_user_id_fkey (email, first_name, last_name, role)
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
    console.error('Error updating assignment:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: String(error)
    }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params

    // Delete assignment
    const { error } = await supabase
      .from('assignments')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting assignment:', error)
      return NextResponse.json({ 
        error: 'Failed to delete assignment',
        details: error.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Assignment deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting assignment:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: String(error)
    }, { status: 500 })
  }
}
