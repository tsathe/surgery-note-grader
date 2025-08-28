import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(
  request: NextRequest,
  { params }: { params: { batchId: string } }
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

    const { batchId } = params

    // Get upload status
    const { data: uploadData, error: uploadError } = await supabase
      .from('note_uploads')
      .select(`
        *,
        upload_stats (
          success_rate,
          processing_duration_seconds
        )
      `)
      .eq('batch_id', batchId)
      .single()

    if (uploadError) {
      return NextResponse.json({ error: 'Upload not found' }, { status: 404 })
    }

    // Get related notes count
    const { count: notesCount } = await supabase
      .from('surgery_notes')
      .select('*', { count: 'exact', head: true })
      .eq('batch_id', batchId)

    return NextResponse.json({
      batch_id: uploadData.batch_id,
      filename: uploadData.original_filename,
      status: uploadData.status,
      total_records: uploadData.total_records,
      processed_records: uploadData.processed_records,
      successful_records: uploadData.successful_records,
      failed_records: uploadData.failed_records,
      notes_created: notesCount || 0,
      errors: uploadData.errors || [],
      validation_errors: uploadData.validation_errors || [],
      processing_log: uploadData.processing_log || [],
      success_rate: uploadData.upload_stats?.[0]?.success_rate || 0,
      processing_duration: uploadData.upload_stats?.[0]?.processing_duration_seconds || 0,
      started_at: uploadData.started_at,
      completed_at: uploadData.completed_at,
      created_at: uploadData.created_at,
      updated_at: uploadData.updated_at
    })

  } catch (error) {
    console.error('Error fetching upload status:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch upload status',
      details: String(error)
    }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { batchId: string } }
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

    const { batchId } = params

    // Cancel the upload if it's still processing
    const { data: uploadData, error: fetchError } = await supabase
      .from('note_uploads')
      .select('status')
      .eq('batch_id', batchId)
      .single()

    if (fetchError) {
      return NextResponse.json({ error: 'Upload not found' }, { status: 404 })
    }

    if (uploadData.status === 'processing') {
      const { error: cancelError } = await supabase
        .from('note_uploads')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString(),
          errors: [{ error: 'Upload cancelled by user' }]
        })
        .eq('batch_id', batchId)

      if (cancelError) {
        return NextResponse.json({ error: 'Failed to cancel upload' }, { status: 500 })
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Upload cancelled successfully' 
      })
    } else {
      return NextResponse.json({ 
        error: 'Cannot cancel upload',
        message: `Upload is in '${uploadData.status}' status and cannot be cancelled`
      }, { status: 400 })
    }

  } catch (error) {
    console.error('Error cancelling upload:', error)
    return NextResponse.json({ 
      error: 'Failed to cancel upload',
      details: String(error)
    }, { status: 500 })
  }
}
