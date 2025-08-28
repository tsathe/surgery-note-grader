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

    // Check if user is admin
    const { data: adminCheck } = await supabase
      .from('admin_emails')
      .select('email')
      .eq('email', user.email)
      .single()

    if (!adminCheck) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const userId = searchParams.get('user_id')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query
    let query = supabase
      .from('assignment_dashboard')
      .select('*')
      .order('assigned_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }
    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data: assignments, error } = await query

    if (error) {
      console.error('Error fetching assignments:', error)
      return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 })
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('assignments')
      .select('*', { count: 'exact', head: true })

    if (status) {
      countQuery = countQuery.eq('status', status)
    }
    if (userId) {
      countQuery = countQuery.eq('user_id', userId)
    }

    const { count } = await countQuery

    return NextResponse.json({
      assignments,
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: (count || 0) > offset + limit
      }
    })

  } catch (error) {
    console.error('Error in assignments API:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: String(error)
    }, { status: 500 })
  }
}

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
    const { note_id, user_id, due_date, priority, notes } = body

    // Validate required fields
    if (!note_id || !user_id) {
      return NextResponse.json({ 
        error: 'Missing required fields: note_id and user_id are required' 
      }, { status: 400 })
    }

    // Check if note exists
    const { data: note, error: noteError } = await supabase
      .from('surgery_notes')
      .select('id, title')
      .eq('id', note_id)
      .single()

    if (noteError || !note) {
      return NextResponse.json({ error: 'Surgery note not found' }, { status: 404 })
    }

    // Check if user exists and is authorized
    const { data: targetUser, error: userError } = await supabase
      .from('users')
      .select('email')
      .eq('id', user_id)
      .single()

    if (userError || !targetUser) {
      return NextResponse.json({ error: 'Target user not found or not authorized' }, { status: 404 })
    }

    // Check for existing assignment
    const { data: existingAssignment } = await supabase
      .from('assignments')
      .select('id, status')
      .eq('note_id', note_id)
      .eq('user_id', user_id)
      .single()

    if (existingAssignment) {
      return NextResponse.json({ 
        error: 'Assignment already exists',
        existing_assignment: existingAssignment
      }, { status: 409 })
    }

    // Create assignment
    const { data: assignment, error: assignmentError } = await supabase
      .from('assignments')
      .insert({
        note_id,
        user_id,
        assigned_by: user.id,
        due_date: due_date || null,
        priority: priority || 1,
        notes: notes || null
      })
      .select(`
        *,
        surgery_notes (title, phase),
        users!assignments_user_id_fkey (email, first_name, last_name, role)
      `)
      .single()

    if (assignmentError) {
      console.error('Error creating assignment:', assignmentError)
      return NextResponse.json({ 
        error: 'Failed to create assignment',
        details: assignmentError.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      assignment
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating assignment:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: String(error)
    }, { status: 500 })
  }
}
