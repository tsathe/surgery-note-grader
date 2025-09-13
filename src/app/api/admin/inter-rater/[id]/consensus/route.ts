import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// POST /api/admin/inter-rater/[id]/consensus - Resolve consensus for disagreements
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { 
      domainResolutions, 
      resolutionMethod = 'third_party',
      resolutionNotes 
    } = body

    if (!domainResolutions || !Array.isArray(domainResolutions)) {
      return NextResponse.json(
        { error: 'domainResolutions array is required' },
        { status: 400 }
      )
    }

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get the inter-rater assignment
    const { data: assignment, error: assignmentError } = await supabase
      .from('inter_rater_assignments')
      .select('*')
      .eq('id', params.id)
      .single()

    if (assignmentError || !assignment) {
      return NextResponse.json(
        { error: 'Inter-rater assignment not found' },
        { status: 404 }
      )
    }

    // Check if user is authorized to resolve consensus
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    const userEmail = currentUser?.email

    // Check if user is admin or assigned consensus grader
    const { data: isAdmin } = await supabase
      .from('admin_emails')
      .select('email')
      .eq('email', userEmail)
      .single()

    if (!isAdmin && assignment.consensus_grader_id !== user.id) {
      return NextResponse.json(
        { error: 'Not authorized to resolve consensus for this assignment' },
        { status: 403 }
      )
    }

    // Get existing agreement calculations
    const { data: calculations, error: calcError } = await supabase
      .from('agreement_calculations')
      .select('*')
      .eq('inter_rater_assignment_id', params.id)

    if (calcError) {
      throw calcError
    }

    const calculationsMap = new Map()
    if (calculations) {
      calculations.forEach(calc => {
        calculationsMap.set(calc.domain_name, calc)
      })
    }

    // Process each domain resolution
    const resolutionResults = []
    const errors = []

    for (const resolution of domainResolutions) {
      const { domainName, finalScore } = resolution

      if (!domainName || finalScore === undefined || finalScore === null) {
        errors.push({
          domainName,
          error: 'domainName and finalScore are required'
        })
        continue
      }

      try {
        const calculation = calculationsMap.get(domainName)
        
        if (!calculation) {
          errors.push({
            domainName,
            error: 'No agreement calculation found for this domain'
          })
          continue
        }

        // Insert or update consensus resolution
        const { data, error: resolutionError } = await supabase
          .from('consensus_resolutions')
          .upsert({
            inter_rater_assignment_id: params.id,
            domain_name: domainName,
            primary_score: calculation.primary_score,
            secondary_score: calculation.secondary_score,
            final_score: finalScore,
            resolution_method: resolutionMethod,
            resolved_by: user.id,
            resolution_notes: resolutionNotes,
            resolved_at: new Date().toISOString()
          }, {
            onConflict: 'inter_rater_assignment_id,domain_name'
          })

        if (resolutionError) {
          throw resolutionError
        }

        resolutionResults.push({
          domainName,
          primaryScore: calculation.primary_score,
          secondaryScore: calculation.secondary_score,
          finalScore,
          resolutionMethod
        })

      } catch (error) {
        console.error(`Error resolving consensus for domain ${domainName}:`, error)
        errors.push({
          domainName,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Update inter-rater assignment status
    const { error: updateError } = await supabase
      .from('inter_rater_assignments')
      .update({
        consensus_status: 'resolved',
        consensus_grader_id: user.id,
        consensus_completed_at: new Date().toISOString()
      })
      .eq('id', params.id)

    if (updateError) {
      console.error('Error updating assignment status:', updateError)
    }

    // Update surgery note consensus status
    const { error: noteUpdateError } = await supabase
      .from('surgery_notes')
      .update({
        consensus_required: false
      })
      .eq('id', assignment.note_id)

    if (noteUpdateError) {
      console.error('Error updating note consensus status:', noteUpdateError)
    }

    return NextResponse.json({
      success: true,
      resolved: resolutionResults.length,
      failed: errors.length,
      resolutions: resolutionResults,
      errors,
      assignmentId: params.id,
      resolutionMethod,
      resolvedBy: user.id
    })

  } catch (error) {
    console.error('Error in POST /api/admin/inter-rater/[id]/consensus:', error)
    return NextResponse.json(
      { error: 'Failed to resolve consensus' },
      { status: 500 }
    )
  }
}

// GET /api/admin/inter-rater/[id]/consensus - Get consensus details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get the inter-rater assignment with details
    const { data: assignment, error: assignmentError } = await supabase
      .from('inter_rater_dashboard')
      .select('*')
      .eq('id', params.id)
      .single()

    if (assignmentError || !assignment) {
      return NextResponse.json(
        { error: 'Inter-rater assignment not found' },
        { status: 404 }
      )
    }

    // Get agreement calculations
    const { data: calculations, error: calcError } = await supabase
      .from('agreement_calculations')
      .select('*')
      .eq('inter_rater_assignment_id', params.id)
      .order('domain_name')

    if (calcError) {
      throw calcError
    }

    // Get existing consensus resolutions
    const { data: resolutions, error: resolutionError } = await supabase
      .from('consensus_resolutions')
      .select(`
        *,
        resolved_by_user:resolved_by (email)
      `)
      .eq('inter_rater_assignment_id', params.id)
      .order('domain_name')

    if (resolutionError) {
      throw resolutionError
    }

    // Combine calculations with resolutions
    const domainDetails = (calculations || []).map(calc => {
      const resolution = resolutions?.find(r => r.domain_name === calc.domain_name)
      return {
        domainName: calc.domain_name,
        primaryScore: calc.primary_score,
        secondaryScore: calc.secondary_score,
        difference: calc.difference,
        agreementType: calc.agreement_type,
        finalScore: resolution?.final_score || null,
        resolutionMethod: resolution?.resolution_method || null,
        resolutionNotes: resolution?.resolution_notes || null,
        resolvedBy: resolution?.resolved_by_user?.email || null,
        resolvedAt: resolution?.resolved_at || null,
        needsResolution: calc.agreement_type === 'disagreement' && !resolution
      }
    })

    return NextResponse.json({
      assignment,
      domainDetails,
      summary: {
        totalDomains: domainDetails.length,
        disagreements: domainDetails.filter(d => d.agreementType === 'disagreement').length,
        resolved: domainDetails.filter(d => d.finalScore !== null).length,
        needingResolution: domainDetails.filter(d => d.needsResolution).length,
        overallAgreementScore: assignment.agreement_score
      }
    })

  } catch (error) {
    console.error('Error in GET /api/admin/inter-rater/[id]/consensus:', error)
    return NextResponse.json(
      { error: 'Failed to fetch consensus details' },
      { status: 500 }
    )
  }
}
