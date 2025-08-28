import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import * as XLSX from 'xlsx'

interface UploadRecord {
  title: string
  content: string
  phase: string
  patient_id?: string
  procedure_type?: string
  complexity?: number
  row_number: number
}

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
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

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Please upload CSV or Excel files only.' 
      }, { status: 400 })
    }

    // Create upload record
    const batchId = crypto.randomUUID()
    const { data: uploadRecord, error: uploadError } = await supabase
      .from('note_uploads')
      .insert({
        batch_id: batchId,
        filename: `${batchId}_${file.name}`,
        original_filename: file.name,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: user.id,
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .select()
      .single()

    if (uploadError) {
      console.error('Error creating upload record:', uploadError)
      return NextResponse.json({ error: 'Failed to create upload record' }, { status: 500 })
    }

    // Process file
    try {
      const buffer = await file.arrayBuffer()
      const records = await parseFile(buffer, file.type, file.name)
      
      // Validate all records
      const validationResults = await validateRecords(records, supabase)
      const validRecords = records.filter((_, index) => validationResults[index].valid)
      const invalidRecords = records.filter((_, index) => !validationResults[index].valid)

      // Update upload record with totals
      await supabase
        .from('note_uploads')
        .update({
          total_records: records.length,
          processed_records: records.length,
          validation_errors: invalidRecords.map((record, index) => ({
            row: record.row_number,
            errors: validationResults[records.indexOf(record)].errors,
            warnings: validationResults[records.indexOf(record)].warnings,
            data: record
          }))
        })
        .eq('id', uploadRecord.id)

      // Insert valid records
      if (validRecords.length > 0) {
        const notesToInsert = validRecords.map(record => ({
          title: record.title.trim(),
          content: record.content.trim(),
          phase: normalizePhase(record.phase),
          patient_id: record.patient_id?.trim() || null,
          procedure_type: record.procedure_type?.trim() || null,
          complexity: record.complexity || null,
          batch_id: batchId,
          upload_source: 'bulk_upload',
          source_row_number: record.row_number,
          validation_status: 'valid'
        }))

        const { error: insertError } = await supabase
          .from('surgery_notes')
          .insert(notesToInsert)

        if (insertError) {
          console.error('Error inserting notes:', insertError)
          await supabase
            .from('note_uploads')
            .update({
              status: 'failed',
              errors: [{ error: 'Failed to insert notes', details: insertError.message }],
              completed_at: new Date().toISOString()
            })
            .eq('id', uploadRecord.id)

          return NextResponse.json({ error: 'Failed to insert notes' }, { status: 500 })
        }

        await supabase
          .from('note_uploads')
          .update({
            successful_records: validRecords.length,
            failed_records: invalidRecords.length,
            status: invalidRecords.length > 0 ? 'completed' : 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', uploadRecord.id)
      } else {
        await supabase
          .from('note_uploads')
          .update({
            successful_records: 0,
            failed_records: invalidRecords.length,
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', uploadRecord.id)
      }

      return NextResponse.json({
        success: true,
        batch_id: batchId,
        total_records: records.length,
        successful_records: validRecords.length,
        failed_records: invalidRecords.length,
        validation_errors: invalidRecords.map((record, index) => ({
          row: record.row_number,
          errors: validationResults[records.indexOf(record)].errors,
          data: record
        }))
      })

    } catch (processingError) {
      console.error('Error processing file:', processingError)
      
      await supabase
        .from('note_uploads')
        .update({
          status: 'failed',
          errors: [{ error: 'File processing failed', details: String(processingError) }],
          completed_at: new Date().toISOString()
        })
        .eq('id', uploadRecord.id)

      return NextResponse.json({ 
        error: 'Failed to process file',
        details: String(processingError)
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ 
      error: 'Upload failed',
      details: String(error)
    }, { status: 500 })
  }
}

async function parseFile(buffer: ArrayBuffer, mimeType: string, filename: string): Promise<UploadRecord[]> {
  const records: UploadRecord[] = []

  if (mimeType === 'text/csv' || filename.endsWith('.csv')) {
    // Parse CSV
    const text = new TextDecoder().decode(buffer)
    const lines = text.split('\n')
    
    if (lines.length < 2) {
      throw new Error('CSV file must have at least a header row and one data row')
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase())
    
    // Validate required headers
    const requiredHeaders = ['title', 'content', 'phase']
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h))
    if (missingHeaders.length > 0) {
      throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`)
    }

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const values = parseCSVLine(line)
      if (values.length !== headers.length) {
        console.warn(`Row ${i + 1}: Column count mismatch`)
        continue
      }

      const record: UploadRecord = {
        title: '',
        content: '',
        phase: '',
        row_number: i + 1
      }

      headers.forEach((header, index) => {
        const value = values[index]?.trim().replace(/^"|"$/g, '') || ''
        
        switch (header) {
          case 'title':
            record.title = value
            break
          case 'content':
            record.content = value
            break
          case 'phase':
            record.phase = value
            break
          case 'patient_id':
            record.patient_id = value || undefined
            break
          case 'procedure_type':
            record.procedure_type = value || undefined
            break
          case 'complexity':
            const complexity = parseInt(value)
            record.complexity = isNaN(complexity) ? undefined : complexity
            break
        }
      })

      records.push(record)
    }
  } else {
    // Parse Excel
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

    if (jsonData.length < 2) {
      throw new Error('Excel file must have at least a header row and one data row')
    }

    const headers = jsonData[0].map((h: any) => String(h).trim().toLowerCase())
    
    // Validate required headers
    const requiredHeaders = ['title', 'content', 'phase']
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h))
    if (missingHeaders.length > 0) {
      throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`)
    }

    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i]
      if (!row || row.every(cell => !cell)) continue

      const record: UploadRecord = {
        title: '',
        content: '',
        phase: '',
        row_number: i + 1
      }

      headers.forEach((header, index) => {
        const value = String(row[index] || '').trim()
        
        switch (header) {
          case 'title':
            record.title = value
            break
          case 'content':
            record.content = value
            break
          case 'phase':
            record.phase = value
            break
          case 'patient_id':
            record.patient_id = value || undefined
            break
          case 'procedure_type':
            record.procedure_type = value || undefined
            break
          case 'complexity':
            const complexity = parseInt(value)
            record.complexity = isNaN(complexity) ? undefined : complexity
            break
        }
      })

      records.push(record)
    }
  }

  return records
}

function parseCSVLine(line: string): string[] {
  const result = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  
  result.push(current)
  return result
}

async function validateRecords(records: UploadRecord[], supabase: any): Promise<ValidationResult[]> {
  const results: ValidationResult[] = []
  
  for (const record of records) {
    const { data } = await supabase.rpc('validate_note_data', {
      p_title: record.title,
      p_content: record.content,
      p_phase: record.phase,
      p_patient_id: record.patient_id,
      p_procedure_type: record.procedure_type,
      p_complexity: record.complexity
    })
    
    results.push(data || { valid: false, errors: ['Validation failed'], warnings: [] })
  }
  
  return results
}

function normalizePhase(phase: string): string {
  const normalized = phase.toLowerCase().trim()
  switch (normalized) {
    case '1':
    case 'p1':
    case 'phase 1':
    case 'phase1':
      return '1'
    case '2':
    case 'p2':
    case 'phase 2':
    case 'phase2':
      return '2'
    default:
      return phase
  }
}
