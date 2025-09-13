import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/admin/inter-rater - Get inter-rater assignments
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const status = searchParams.get('status')
    const needsConsensus = searchParams.get('needsConsensus')

    let query = supabase
      .from('inter_rater_dashboard')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (status) {
      query = query.eq('consensus_status', status)
    }

    if (needsConsensus === 'true') {
      query = query.eq('needs_consensus', true)
    }

    const { data: assignments, error: assignmentsError } = await query

    if (assignmentsError) {
      throw assignmentsError
    }

    // Get statistics
    const { data: stats, error: statsError } = await supabase
      .rpc('get_inter_rater_stats')

    if (statsError) {
      console.error('Error getting inter-rater stats:', statsError)
    }

    return NextResponse.json({
      assignments: assignments || [],
      stats: stats?.[0] || {
        total_assignments: 0,
        completed_assignments: 0,
        pending_consensus: 0,
        avg_agreement_score: 0,
        high_agreement_count: 0,
        low_agreement_count: 0
      },
      pagination: {
        limit,
        offset,
        total: assignments?.length || 0
      }
    })

  } catch (error) {
    console.error('Error in GET /api/admin/inter-rater:', error)
    return NextResponse.json(
      { error: 'Failed to fetch inter-rater assignments' },
      { status: 500 }
    )
  }
}

// POST /api/admin/inter-rater - Create new inter-rater assignment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      noteId, 
      primaryGraderId, 
      secondaryGraderId, 
      dueDate,
      assignmentGroupId 
    } = body

    if (!noteId || !primaryGraderId || !secondaryGraderId) {
      return NextResponse.json(
        { error: 'noteId, primaryGraderId, and secondaryGraderId are required' },
        { status: 400 }
      )
    }

    if (primaryGraderId === secondaryGraderId) {
      return NextResponse.json(
        { error: 'Primary and secondary graders must be different' },
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

    // Create inter-rater assignment using database function
    const { data, error } = await supabase
      .rpc('create_inter_rater_assignment', {
        p_note_id: noteId,
        p_primary_grader_id: primaryGraderId,
        p_secondary_grader_id: secondaryGraderId,
        p_created_by: user.id,
        p_due_date: dueDate || null,
        p_assignment_group_id: assignmentGroupId || null
      })

    if (error) {
      throw error
    }

    // Fetch the created assignment details
    const { data: assignment, error: fetchError } = await supabase
      .from('inter_rater_dashboard')
      .select('*')
      .eq('id', data)
      .single()

    if (fetchError) {
      console.error('Error fetching created assignment:', fetchError)
    }

    return NextResponse.json({
      success: true,
      assignmentId: data,
      assignment: assignment
    })

  } catch (error) {
    console.error('Error in POST /api/admin/inter-rater:', error)
    return NextResponse.json(
      { error: 'Failed to create inter-rater assignment' },
      { status: 500 }
    )
  }
}
