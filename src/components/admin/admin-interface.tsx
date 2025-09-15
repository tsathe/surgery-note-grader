"use client"

import { useState, useEffect, useRef } from 'react'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { SurgeryNote, RubricDomain } from '@/lib/types'
import { Plus, Edit, Trash2, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import BulkUploadModal from './bulk-upload/bulk-upload-modal'

interface AdminInterfaceProps {
  user: any
}

export default function AdminInterface({ user }: AdminInterfaceProps) {
  const [notes, setNotes] = useState<SurgeryNote[]>([])
  const [domains, setDomains] = useState<RubricDomain[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'notes' | 'rubric' | 'users' | 'data' | 'completion' | 'export'>('notes')
  const [showDomainForm, setShowDomainForm] = useState(false)
  const [showImportRubric, setShowImportRubric] = useState(false)
  const [importRubricText, setImportRubricText] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const [editingNote, setEditingNote] = useState<SurgeryNote | null>(null)
  const [editingDomain, setEditingDomain] = useState<RubricDomain | null>(null)
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [dataTableData, setDataTableData] = useState<any[]>([])
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [completionData, setCompletionData] = useState<any[]>([])
  const [isLoadingCompletion, setIsLoadingCompletion] = useState(false)
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  
  // User management state
  const [users, setUsers] = useState<Array<{id: string, email: string, first_name: string, last_name: string, role: string, created_at: string}>>([])
  const [showAddUserDialog, setShowAddUserDialog] = useState(false)
  const [newUserForm, setNewUserForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'Resident'
  })
  const [userError, setUserError] = useState<string | null>(null)
  const [showCsvUpload, setShowCsvUpload] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvError, setCsvError] = useState<string | null>(null)

  // Form states
  const [noteForm, setNoteForm] = useState({
    description: '',
    note_text: ''
  })

  const [domainForm, setDomainForm] = useState({
    name: '',
    description: '',
    examples: '',
    max_score: 5,
    order: 0
  })

  useEffect(() => {
    loadData()
  }, [])

  // Auto-load data table when switching to data tab
  useEffect(() => {
    if (activeTab === 'data') {
      loadDataTable()
    }
  }, [activeTab])

  // Auto-load completion data when switching to completion tab
  useEffect(() => {
    if (activeTab === 'completion') {
      loadCompletionData()
    }
  }, [activeTab])

  const loadData = async () => {
    try {
      const [notesData, domainsData, usersData] = await Promise.all([
        supabase.from('surgery_notes').select('*').order('created_at', { ascending: false }),
        supabase.from('rubric_domains').select('*').order('order', { ascending: true }),
        supabase.from('users').select('*').order('created_at', { ascending: false })
      ])

      if (notesData.error) throw notesData.error
      if (domainsData.error) throw domainsData.error
      if (usersData.error) throw usersData.error

      setNotes(notesData.data || [])
      setDomains(domainsData.data || [])
      setUsers(usersData.data || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadDataTable = async () => {
    setIsLoadingData(true)
    try {
      // Fetch grades data
      const { data: grades, error: gradesError } = await supabase
        .from('grades')
        .select('*')
      
      if (gradesError) {
        console.error('Grades error:', gradesError)
        return
      }

      // Fetch surgery notes data
      const { data: notes, error: notesError } = await supabase
        .from('surgery_notes')
        .select('id, description, note_text')
      
      if (notesError) {
        console.error('Notes error:', notesError)
        return
      }

      // Fetch rubric domains data
      const { data: domains, error: domainsError } = await supabase
        .from('rubric_domains')
        .select('id, name')
        .order('order', { ascending: true })
      
      if (domainsError) {
        console.error('Domains error:', domainsError)
        return
      }

      // Fetch auth users data for emails using admin client
      let usersMap = new Map()
      
      try {
        console.log('Fetching auth users with admin client...')
        const { data: authUsers, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers()
        
        if (authUsersError) {
          console.error('Auth users error:', authUsersError)
          // Fallback to custom users table if admin access fails
          const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id, email, first_name, last_name')
          
          if (usersError) {
            console.error('Users error:', usersError)
            return
          }
          
          usersMap = new Map(users?.map(user => [user.id, user]) || [])
        } else {
          console.log('Successfully fetched auth users:', authUsers?.users?.length || 0)
          usersMap = new Map(authUsers?.users?.map(user => [user.id, { email: user.email }]) || [])
        }
      } catch (error) {
        console.error('Auth admin access failed:', error)
        // Fallback to custom users table
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('id, email, first_name, last_name')
        
        if (usersError) {
          console.error('Users error:', usersError)
          return
        }
        
        usersMap = new Map(users?.map(user => [user.id, user]) || [])
      }

      // Create lookup maps
      const notesMap = new Map(notes?.map(note => [note.id, note]) || [])
      const domainsMap = new Map(domains?.map(domain => [domain.id, domain]) || [])

      // Get ordered domain names for consistent column ordering
      const orderedDomains = domains?.map(domain => domain.name) || []

      // Convert to table format
      const tableData = grades?.map(grade => {
        const note = notesMap.get(grade.note_id)
        const user = usersMap.get(grade.grader_id)
        const domainScores = grade.domain_scores || {}
        
        // Create a row with all the data
        const row = {
          'Grader ID': grade.grader_id,
          'Grader Email': user?.email || `User ${grade.grader_id}`,
          'Note ID': grade.note_id,
          'Note Description': note?.description || '',
        }

        // Add individual domain scores in order
        orderedDomains.forEach(domainName => {
          const domainId = domains?.find(d => d.name === domainName)?.id
          const score = domainId ? domainScores[domainId] : ''
          // Clean domain name for display (remove commas and quotes)
          const cleanDomainName = domainName.replace(/[",]/g, ' ').trim()
          row[cleanDomainName] = score || ''
        })

        // Add total score and comments at the end
        row['Total Score'] = grade.total_score
        row['Comments'] = grade.feedback || ''
        row['Created At'] = new Date(grade.created_at).toLocaleDateString()

        return row
      }) || []

      setDataTableData(tableData)
    } catch (error) {
      console.error('Error loading data table:', error)
    } finally {
      setIsLoadingData(false)
    }
  }

  // Helper function to get score color based on value
  const getScoreColor = (score: number, maxScore: number = 5) => {
    if (score === 0) return 'bg-slate-100 text-slate-500'
    const percentage = (score / maxScore) * 100
    if (percentage >= 80) return 'bg-emerald-100 text-emerald-700'
    if (percentage >= 60) return 'bg-green-100 text-green-700'
    if (percentage >= 40) return 'bg-yellow-100 text-yellow-700'
    if (percentage >= 20) return 'bg-orange-100 text-orange-700'
    return 'bg-red-100 text-red-700'
  }

  // Helper function to toggle comment expansion
  const toggleCommentExpansion = (gradeId: string) => {
    const newExpanded = new Set(expandedComments)
    if (newExpanded.has(gradeId)) {
      newExpanded.delete(gradeId)
    } else {
      newExpanded.add(gradeId)
    }
    setExpandedComments(newExpanded)
  }

  const loadCompletionData = async () => {
    setIsLoadingCompletion(true)
    try {
      // Fetch grades data
      const { data: grades, error: gradesError } = await supabase
        .from('grades')
        .select('*')
      
      if (gradesError) {
        console.error('Grades error:', gradesError)
        return
      }

      // Fetch surgery notes data
      const { data: notes, error: notesError } = await supabase
        .from('surgery_notes')
        .select('id, description')
        .order('description', { ascending: true })
      
      if (notesError) {
        console.error('Notes error:', notesError)
        return
      }

      // Fetch rubric domains data
      const { data: domains, error: domainsError } = await supabase
        .from('rubric_domains')
        .select('id, name')
        .order('order', { ascending: true })
      
      if (domainsError) {
        console.error('Domains error:', domainsError)
        return
      }

      // Fetch auth users data for emails using admin client
      let usersMap = new Map()
      
      try {
        console.log('Fetching auth users for completion data...')
        const { data: authUsers, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers()
        
        if (authUsersError) {
          console.error('Auth users error:', authUsersError)
          // Fallback to custom users table if admin access fails
          const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id, email, first_name, last_name')
          
          if (usersError) {
            console.error('Users error:', usersError)
            return
          }
          
          usersMap = new Map(users?.map(user => [user.id, user]) || [])
        } else {
          console.log('Successfully fetched auth users for completion:', authUsers?.users?.length || 0)
          usersMap = new Map(authUsers?.users?.map(user => [user.id, { email: user.email }]) || [])
        }
      } catch (error) {
        console.error('Auth admin access failed for completion:', error)
        // Fallback to custom users table
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('id, email, first_name, last_name')
        
        if (usersError) {
          console.error('Users error:', usersError)
          return
        }
        
        usersMap = new Map(users?.map(user => [user.id, user]) || [])
      }

      // Create completion matrix
      const completionMatrix = []
      
      // Get all unique graders
      const graderIds = [...new Set(grades?.map(grade => grade.grader_id) || [])]
      
      for (const graderId of graderIds) {
        const user = usersMap.get(graderId)
        const userEmail = user?.email || `User ${graderId}`
        
        const row = {
          userId: graderId,
          userEmail: userEmail,
          totalNotes: notes?.length || 0,
          completedNotes: 0,
          completionRate: 0,
          noteCompletions: {}
        }
        
        // Check which notes this grader has completed
        const userGrades = grades?.filter(grade => grade.grader_id === graderId) || []
        row.completedNotes = userGrades.length
        
        // Create note completion status
        for (const note of notes || []) {
          const userGrade = userGrades.find(grade => grade.note_id === note.id)
          const hasCompleted = !!userGrade
          const isPartiallyCompleted = hasCompleted && userGrade?.domain_scores && 
            Object.keys(userGrade.domain_scores).length > 0 && 
            Object.keys(userGrade.domain_scores).length < (domains?.length || 0)
          
          row.noteCompletions[note.id] = {
            completed: hasCompleted,
            partiallyCompleted: isPartiallyCompleted,
            noteDescription: note.description,
            gradeId: hasCompleted ? userGrade?.id : null,
            completedDomains: hasCompleted ? Object.keys(userGrade?.domain_scores || {}).length : 0,
            totalDomains: domains?.length || 0
          }
        }
        
        row.completionRate = notes?.length > 0 ? (row.completedNotes / notes.length) * 100 : 0
        completionMatrix.push(row)
      }
      
      // Sort by completion rate (highest first)
      completionMatrix.sort((a, b) => b.completionRate - a.completionRate)
      
      setCompletionData({
        matrix: completionMatrix,
        notes: notes || [],
        totalGraders: graderIds.length,
        totalNotes: notes?.length || 0
      })
    } catch (error) {
      console.error('Error loading completion data:', error)
    } finally {
      setIsLoadingCompletion(false)
    }
  }

  const handleNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      console.log('Submitting note:', { editingNote, noteForm })
      
      if (editingNote) {
        console.log('Updating note with ID:', editingNote.id)
        const { data, error } = await supabase
          .from('surgery_notes')
          .update(noteForm)
          .eq('id', editingNote.id)
          .select()
        
        console.log('Update result:', { data, error })
        if (error) {
          console.error('Update error:', error)
          alert(`Error updating note: ${error.message}`)
          throw error
        }
        alert('Note updated successfully!')
      } else {
        console.log('Creating new note')
        const { data, error } = await supabase
          .from('surgery_notes')
          .insert(noteForm)
          .select()
        
        console.log('Insert result:', { data, error })
        if (error) {
          console.error('Insert error:', error)
          alert(`Error creating note: ${error.message}`)
          throw error
        }
        alert('Note created successfully!')
      }
      
      setShowNoteModal(false)
      setEditingNote(null)
      setNoteForm({ description: '', note_text: '' })
      await loadData()
    } catch (error) {
      console.error('Error saving note:', error)
      alert(`Error saving note: ${error}`)
    }
  }

  const handleDomainSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingDomain) {
        const { error } = await supabase
          .from('rubric_domains')
          .update(domainForm)
          .eq('id', editingDomain.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('rubric_domains')
          .insert(domainForm)
        if (error) throw error
      }
      
      setShowDomainForm(false)
      setEditingDomain(null)
      setDomainForm({ name: '', description: '', examples: '', max_score: 5, order: 0 })
      await loadData()
    } catch (error) {
      console.error('Error saving domain:', error)
    }
  }

  const handleImportRubric = async () => {
    setImportError(null)
    try {
      // Expected JSON shape: [{ name, description, examples, max_score, order?, score_guidance? }]
      const parsed = JSON.parse(importRubricText)
      if (!Array.isArray(parsed)) throw new Error('JSON must be an array of domains')
      const prepared = parsed.map((d: any, idx: number) => ({
        name: String(d.name ?? ''),
        description: String(d.description ?? ''),
        examples: String(d.examples ?? ''),
        max_score: Number(d.max_score ?? 5),
        order: Number(d.order ?? idx + 1),
        score_guidance: d.score_guidance ?? null,
      }))
      if (prepared.some((d: any) => !d.name || !d.description)) {
        throw new Error('Each domain needs at least a name and description')
      }
      // Replace all rubric domains
      const del = await supabase.from('rubric_domains').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      if (del.error) throw del.error
      const ins = await supabase.from('rubric_domains').insert(prepared)
      if (ins.error) throw ins.error
      setShowImportRubric(false)
      setImportRubricText('')
      await loadData()
    } catch (err: any) {
      setImportError(err?.message ?? 'Failed to import rubric')
    }
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null)
    try {
      const file = e.target.files?.[0]
      if (!file) return
      const text = await file.text()
      setImportRubricText(text)
      setShowImportRubric(true)
    } catch (err: any) {
      setImportError(err?.message ?? 'Could not read file')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const loadSampleRubric = async () => {
    setImportError(null)
    try {
      const res = await fetch('/rubrics/surgical-consult-rubric.json')
      const text = await res.text()
      setImportRubricText(text)
      setShowImportRubric(true)
    } catch (err: any) {
      setImportError('Failed to load sample rubric')
    }
  }

  const handleDeleteNote = async (id: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return
    
    try {
      console.log('Attempting to delete note with ID:', id)
      const { data, error } = await supabase
        .from('surgery_notes')
        .delete()
        .eq('id', id)
        .select()
      
      if (error) {
        console.error('Supabase error:', error)
        alert(`Error deleting note: ${error.message}`)
        return
      }
      
      console.log('Delete successful:', data)
      await loadData()
      alert('Note deleted successfully!')
    } catch (error) {
      console.error('Error deleting note:', error)
      alert(`Error deleting note: ${error}`)
    }
  }

  const handleDeleteDomain = async (id: string) => {
    if (!confirm('Are you sure you want to delete this domain?')) return
    
    try {
      const { error } = await supabase
        .from('rubric_domains')
        .delete()
        .eq('id', id)
      if (error) throw error
      await loadData()
    } catch (error) {
      console.error('Error deleting domain:', error)
    }
  }

  const exportData = async () => {
    try {
      console.log('Starting export...')
      
      // Fetch grades data
      const { data: grades, error: gradesError } = await supabase
        .from('grades')
        .select('*')
      
      if (gradesError) {
        console.error('Grades error:', gradesError)
        alert(`Error fetching grades: ${gradesError.message}`)
        return
      }

      // Fetch surgery notes data
      const { data: notes, error: notesError } = await supabase
        .from('surgery_notes')
        .select('id, description, note_text')
      
      if (notesError) {
        console.error('Notes error:', notesError)
        alert(`Error fetching notes: ${notesError.message}`)
        return
      }

      // Fetch rubric domains data
      const { data: domains, error: domainsError } = await supabase
        .from('rubric_domains')
        .select('id, name')
        .order('order', { ascending: true })
      
      if (domainsError) {
        console.error('Domains error:', domainsError)
        alert(`Error fetching domains: ${domainsError.message}`)
        return
      }

      // Fetch auth users data for emails using admin client
      let usersMap = new Map()
      let usersData = []
      
      try {
        console.log('Fetching auth users for export with admin client...')
        const { data: authUsers, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers()
        
        if (authUsersError) {
          console.error('Auth users error:', authUsersError)
          // Fallback to custom users table if admin access fails
          const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id, email, first_name, last_name')
          
          if (usersError) {
            console.error('Users error:', usersError)
            alert(`Error fetching users: ${usersError.message}`)
            return
          }
          
          usersData = users || []
          usersMap = new Map(users?.map(user => [user.id, user]) || [])
        } else {
          console.log('Successfully fetched auth users for export:', authUsers?.users?.length || 0)
          usersData = authUsers?.users || []
          usersMap = new Map(authUsers?.users?.map(user => [user.id, { email: user.email }]) || [])
        }
      } catch (error) {
        console.error('Auth admin access failed for export:', error)
        // Fallback to custom users table
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('id, email, first_name, last_name')
        
        if (usersError) {
          console.error('Users error:', usersError)
          alert(`Error fetching users: ${usersError.message}`)
          return
        }
        
        usersData = users || []
        usersMap = new Map(users?.map(user => [user.id, user]) || [])
      }

      console.log('Grades data:', grades)
      console.log('Notes data:', notes)
      console.log('Domains data:', domains)
      console.log('Users data:', usersData)
      
      // Debug: Check if we have any grades with grader_id
      if (grades && grades.length > 0) {
        console.log('Sample grade grader_id:', grades[0].grader_id)
        console.log('Sample grade feedback:', grades[0].feedback)
      }

      if (!grades || grades.length === 0) {
        alert('No grading data found to export.')
        return
      }

      // Create lookup maps
      const notesMap = new Map(notes?.map(note => [note.id, note]) || [])
      const domainsMap = new Map(domains?.map(domain => [domain.id, domain]) || [])
      // usersMap already created above

      // Get ordered domain names for consistent column ordering
      const orderedDomains = domains?.map(domain => domain.name) || []

      // Convert to CSV format
      const csvData = grades.map(grade => {
        const note = notesMap.get(grade.note_id)
        const user = usersMap.get(grade.grader_id)
        const domainScores = grade.domain_scores || {}
        
        // Create a row with all the data in the requested order
        const row = {
          'Grader Email': user?.email || `User ${grade.grader_id}`,
          'Note ID': grade.note_id,
          'Note Description': note?.description || '',
        }

        // Add individual domain scores in order
        orderedDomains.forEach(domainName => {
          const domainId = domains?.find(d => d.name === domainName)?.id
          const score = domainId ? domainScores[domainId] : ''
          // Clean domain name for CSV (remove commas and quotes)
          const cleanDomainName = domainName.replace(/[",]/g, ' ').trim()
          row[cleanDomainName] = score || ''
        })

        // Add total score and comments at the end
        row['Total Score'] = grade.total_score
        row['Comments'] = grade.feedback || ''

        return row
      })

      console.log('CSV data:', csvData)

      // Create and download CSV
      const csv = [
        Object.keys(csvData[0] || {}).join(','),
        ...csvData.map(row => Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      ].join('\n')

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `surgery-note-grades-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      
      alert(`Successfully exported ${grades.length} grading records!`)
    } catch (error) {
      console.error('Error exporting data:', error)
      alert(`Error exporting data: ${error}`)
    }
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setUserError(null)
    
    if (!newUserForm.email.trim() || !newUserForm.firstName.trim() || !newUserForm.lastName.trim()) {
      setUserError('All fields are required')
      return
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newUserForm.email.trim())) {
      setUserError('Please enter a valid email address')
      return
    }
    
    // Check if user already exists
    const existingUser = users.find(u => u.email.toLowerCase() === newUserForm.email.trim().toLowerCase())
    if (existingUser) {
      setUserError('This email is already authorized')
      return
    }
    
    try {
      const { error } = await supabase
        .from('users')
        .insert({ 
          email: newUserForm.email.trim().toLowerCase(),
          first_name: newUserForm.firstName.trim(),
          last_name: newUserForm.lastName.trim(),
          role: newUserForm.role
        })
      
      if (error) throw error
      
      setNewUserForm({
        email: '',
        firstName: '',
        lastName: '',
        role: 'Resident'
      })
      setShowAddUserDialog(false)
      await loadData()
    } catch (error: any) {
      setUserError(error?.message || 'Failed to add user')
    }
  }

  const handleRemoveUser = async (userId: string, email: string) => {
    if (!confirm(`Remove access for ${email}?`)) return
    
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId)
      
      if (error) throw error
      await loadData()
    } catch (error: any) {
      setUserError(error?.message || 'Failed to remove user')
    }
  }

  const handleCsvUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    setCsvError(null)
    
    if (!csvFile) {
      setCsvError('Please select a CSV file')
      return
    }
    
    try {
      const text = await csvFile.text()
      const lines = text.split('\n').filter(line => line.trim())
      
      if (lines.length < 2) {
        setCsvError('CSV file must contain at least a header row and one data row')
        return
      }
      
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
      const requiredHeaders = ['email', 'first_name', 'last_name', 'role']
      
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h))
      if (missingHeaders.length > 0) {
        setCsvError(`Missing required columns: ${missingHeaders.join(', ')}. Expected: email, first_name, last_name, role`)
        return
      }
      
      const emailIndex = headers.indexOf('email')
      const firstNameIndex = headers.indexOf('first_name')
      const lastNameIndex = headers.indexOf('last_name')
      const roleIndex = headers.indexOf('role')
      
      const usersToAdd = []
      const errors = []
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim())
        
        if (values.length !== headers.length) {
          errors.push(`Row ${i + 1}: Incorrect number of columns`)
          continue
        }
        
        const email = values[emailIndex]?.toLowerCase()
        const firstName = values[firstNameIndex]
        const lastName = values[lastNameIndex]
        const role = values[roleIndex]
        
        if (!email || !firstName || !lastName || !role) {
          errors.push(`Row ${i + 1}: Missing required fields`)
          continue
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
          errors.push(`Row ${i + 1}: Invalid email format`)
          continue
        }
        
        if (!['resident', 'faculty'].includes(role.toLowerCase())) {
          errors.push(`Row ${i + 1}: Role must be 'Resident' or 'Faculty'`)
          continue
        }
        
        // Check if user already exists
        const existingUser = users.find(u => u.email.toLowerCase() === email)
        if (existingUser) {
          errors.push(`Row ${i + 1}: Email ${email} already exists`)
          continue
        }
        
        usersToAdd.push({
          email,
          first_name: firstName,
          last_name: lastName,
          role: role.charAt(0).toUpperCase() + role.slice(1).toLowerCase()
        })
      }
      
      if (errors.length > 0) {
        setCsvError(`Validation errors:\n${errors.join('\n')}`)
        return
      }
      
      if (usersToAdd.length === 0) {
        setCsvError('No valid users found to add')
        return
      }
      
      // Insert users in batches
      const { error } = await supabase
        .from('users')
        .insert(usersToAdd)
      
      if (error) throw error
      
      setCsvFile(null)
      setShowCsvUpload(false)
      await loadData()
      
      alert(`Successfully added ${usersToAdd.length} users`)
    } catch (error: any) {
      setCsvError(error?.message || 'Failed to process CSV file')
    }
  }

  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="border-b mb-8">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'notes', label: 'Surgery Notes' },
              { id: 'rubric', label: 'Rubric Domains' },
              { id: 'users', label: 'User Access' },
              { id: 'data', label: 'Grading Data' },
              { id: 'completion', label: 'Completion Heatmap' },
              { id: 'export', label: 'Export Data' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Notes Tab */}
        {activeTab === 'notes' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Surgery Notes</h2>
              <div className="flex space-x-3">
                <BulkUploadModal onUploadComplete={async () => await loadData()} />
                <button
                  onClick={() => {
                    setEditingNote(null)
                    setNoteForm({ description: '', note_text: '' })
                    setShowNoteModal(true)
                  }}
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Note</span>
                </button>
              </div>
            </div>

            {/* Note Modal */}
            <Dialog open={showNoteModal} onOpenChange={setShowNoteModal}>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingNote ? 'Edit Note' : 'Add New Note'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleNoteSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium">Description</label>
                    <input
                      type="text"
                      value={noteForm.description}
                      onChange={(e) => setNoteForm({ ...noteForm, description: e.target.value })}
                      className="mt-1 block w-full border rounded-md px-3 py-2 bg-background"
                      placeholder="e.g., Note A, Cholecystectomy - Patient B, etc."
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Note Text</label>
                    <textarea
                      value={noteForm.note_text}
                      onChange={(e) => setNoteForm({ ...noteForm, note_text: e.target.value })}
                      rows={8}
                      className="mt-1 block w-full border rounded-md px-3 py-2 bg-background"
                      placeholder="Paste your surgery note text here..."
                      required
                    />
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowNoteModal(false)}
                      className="px-4 py-2 border rounded-md hover:bg-accent"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                    >
                      {editingNote ? 'Update' : 'Create'} Note
                    </button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            <div className="bg-card border shadow-sm overflow-hidden sm:rounded-md">
              <ul className="divide-y">
                {notes
                  .sort((a, b) => a.description.localeCompare(b.description))
                  .map((note) => (
                  <li key={note.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-sm font-medium">{note.description}</h3>
                        <p className="text-xs text-muted-foreground mt-1">ID: {note.id.substring(0, 8)}...</p>
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
                          {note.note_text.substring(0, 300)}{note.note_text.length > 300 ? '...' : ''}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            console.log('Edit button clicked for note:', note)
                            setEditingNote(note)
                            setNoteForm({
                              description: note.description,
                              note_text: note.note_text
                            })
                            setShowNoteModal(true)
                            console.log('Edit modal should now be visible')
                          }}
                          className="p-2 text-muted-foreground hover:text-foreground"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="p-2 text-muted-foreground hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}


        {/* Rubric Tab */}
        {activeTab === 'rubric' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Rubric Domains</h2>
              <button
                onClick={() => {
                  setShowDomainForm(true)
                  setEditingDomain(null)
                  setDomainForm({ name: '', description: '', examples: '', max_score: 5, order: 0 })
                }}
                className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Add Domain</span>
              </button>
            </div>

            {/* Import rubric JSON */}
            <div className="mb-6">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowImportRubric((v) => !v)}
                  className="px-3 py-2 rounded-md border text-sm hover:bg-accent"
                >
                  {showImportRubric ? 'Hide Paste Area' : 'Paste JSON'}
                </button>
                <Button variant="outline" className="h-9 px-3 text-sm" onClick={() => fileInputRef.current?.click()}>Upload JSON</Button>
                <Button variant="secondary" className="h-9 px-3 text-sm" onClick={loadSampleRubric}>Load sample</Button>
                <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleFileSelected} />
              </div>
              {showImportRubric && (
                <div className="mt-3 bg-card p-4 rounded-lg border">
                  <p className="text-sm text-muted-foreground mb-2">
                    Paste JSON array of domains here. Each item should include
                    {` `}
                    <code className="px-1 py-0.5 bg-muted rounded">name</code>,
                    {` `}
                    <code className="px-1 py-0.5 bg-muted rounded">description</code>,
                    {` `}
                    <code className="px-1 py-0.5 bg-muted rounded">examples</code>,
                    {` `}
                    <code className="px-1 py-0.5 bg-muted rounded">max_score</code>, optional
                    {` `}
                    <code className="px-1 py-0.5 bg-muted rounded">order</code> and
                    {` `}
                    <code className="px-1 py-0.5 bg-muted rounded">score_guidance</code> (map 1–5 to text).
                  </p>
                  <textarea
                    value={importRubricText}
                    onChange={(e) => setImportRubricText(e.target.value)}
                    rows={10}
                    className="w-full border rounded-md px-3 py-2 font-mono text-sm bg-background"
                    placeholder='[
  {"name":"Completeness","description":"...","examples":"...","max_score":5,"order":1,
   "score_guidance": {"1":"...","2":"...","3":"...","4":"...","5":"..."}}
]'
                  />
                  <div className="mt-3 flex items-center gap-2">
                    <button onClick={handleImportRubric} className="px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm">Import</button>
                    <button onClick={() => setShowImportRubric(false)} className="px-3 py-2 border rounded-md text-sm hover:bg-accent">Cancel</button>
                    {importError && <span className="text-sm text-red-600">{importError}</span>}
                  </div>
                </div>
              )}
            </div>

            {showDomainForm && (
              <div className="bg-card border p-6 rounded-lg shadow-sm mb-6">
                <h3 className="text-lg font-medium mb-4">
                  {editingDomain ? 'Edit Domain' : 'Add New Domain'}
                </h3>
                <form onSubmit={handleDomainSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium">Name</label>
                      <input
                        type="text"
                        value={domainForm.name}
                        onChange={(e) => setDomainForm({ ...domainForm, name: e.target.value })}
                        className="mt-1 block w-full border rounded-md px-3 py-2 bg-background"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">Max Score</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={domainForm.max_score}
                        onChange={(e) => setDomainForm({ ...domainForm, max_score: parseInt(e.target.value) })}
                        className="mt-1 block w-full border rounded-md px-3 py-2 bg-background"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Description</label>
                    <textarea
                      value={domainForm.description}
                      onChange={(e) => setDomainForm({ ...domainForm, description: e.target.value })}
                      rows={3}
                      className="mt-1 block w-full border rounded-md px-3 py-2 bg-background"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Examples</label>
                    <textarea
                      value={domainForm.examples}
                      onChange={(e) => setDomainForm({ ...domainForm, examples: e.target.value })}
                      rows={3}
                      className="mt-1 block w-full border rounded-md px-3 py-2 bg-background"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Order</label>
                    <input
                      type="number"
                      min="0"
                      value={domainForm.order}
                      onChange={(e) => setDomainForm({ ...domainForm, order: parseInt(e.target.value) })}
                      className="mt-1 block w-full border rounded-md px-3 py-2 bg-background"
                      required
                    />
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowDomainForm(false)}
                      className="px-4 py-2 border rounded-md hover:bg-accent"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                    >
                      {editingDomain ? 'Update' : 'Create'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="bg-card border shadow-sm overflow-hidden sm:rounded-md">
              <ul className="divide-y">
                {domains.map((domain) => (
                  <li key={domain.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-sm font-medium">{domain.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Max Score: {domain.max_score} • Order: {domain.order}
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">{domain.description}</p>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setEditingDomain(domain)
                            setDomainForm({
                              name: domain.name,
                              description: domain.description,
                              examples: domain.examples,
                              max_score: domain.max_score,
                              order: domain.order
                            })
                            setShowDomainForm(true)
                          }}
                          className="p-2 text-muted-foreground hover:text-foreground"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteDomain(domain.id)}
                          className="p-2 text-muted-foreground hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Data Tab */}
        {activeTab === 'data' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-semibold">Grading Data</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Data refreshes automatically when you visit this tab
                </p>
              </div>
              <button
                onClick={loadDataTable}
                disabled={isLoadingData}
                className="bg-secondary text-secondary-foreground px-3 py-2 rounded-md hover:bg-secondary/80 flex items-center space-x-2 disabled:opacity-50 text-sm"
              >
                {isLoadingData ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            {isLoadingData ? (
              <div className="flex justify-center items-center py-8">
                <div className="text-muted-foreground">Loading grading data...</div>
              </div>
            ) : dataTableData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No grading data found. Start grading some notes to see data here.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-card border p-4 rounded-lg">
                    <div className="text-2xl font-bold text-primary">{dataTableData.length}</div>
                    <div className="text-sm text-muted-foreground">Total Grades</div>
                  </div>
                  <div className="bg-card border p-4 rounded-lg">
                    <div className="text-2xl font-bold text-primary">
                      {Math.round(dataTableData.reduce((acc, row) => acc + (row['Total Score'] || 0), 0) / dataTableData.length)}
                    </div>
                    <div className="text-sm text-muted-foreground">Avg Total Score</div>
                  </div>
                  <div className="bg-card border p-4 rounded-lg">
                    <div className="text-2xl font-bold text-primary">
                      {new Set(dataTableData.map(row => row['Grader Email'])).size}
                    </div>
                    <div className="text-sm text-muted-foreground">Unique Graders</div>
                  </div>
                  <div className="bg-card border p-4 rounded-lg">
                    <div className="text-2xl font-bold text-primary">
                      {new Set(dataTableData.map(row => row['Note ID'])).size}
                    </div>
                    <div className="text-sm text-muted-foreground">Unique Notes</div>
                  </div>
                </div>

                {/* Beautiful Data Table */}
                <div className="bg-card border shadow-sm overflow-hidden sm:rounded-lg">
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider sticky left-0 bg-muted/50 z-10 min-w-[200px]">
                            Grader
                          </th>
                          <th className="px-3 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider min-w-[120px]">
                            Note
                          </th>
                          {Object.keys(dataTableData[0] || {})
                            .filter(key => !['Grader Email', 'Grader ID', 'Note ID', 'Note Description', 'Total Score', 'Comments', 'Created At'].includes(key))
                            .map((key) => (
                              <th
                                key={key}
                                className="px-2 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider min-w-[80px]"
                                title={key}
                              >
                                <div className="truncate max-w-[60px]">{key}</div>
                              </th>
                            ))}
                          <th className="px-3 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider min-w-[80px]">
                            Total
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider min-w-[200px]">
                            Comments
                          </th>
                          <th className="px-3 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider min-w-[100px]">
                            Date
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-background divide-y divide-border">
                        {dataTableData.map((row, index) => {
                          const gradeId = `${row['Grader ID']}-${row['Note ID']}`
                          const isCommentExpanded = expandedComments.has(gradeId)
                          const comment = row['Comments'] || ''
                          const commentPreview = comment.length > 50 ? comment.substring(0, 50) + '...' : comment
                          
                          return (
                            <tr key={index} className="hover:bg-muted/30 transition-colors">
                              {/* Grader Email - Sticky */}
                              <td className="px-4 py-3 text-sm font-medium text-foreground sticky left-0 bg-background z-10">
                                <div className="truncate max-w-[180px]" title={row['Grader Email']}>
                                  {row['Grader Email']}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {row['Note Description']}
                                </div>
                              </td>
                              
                              {/* Note Info */}
                              <td className="px-3 py-3 text-center">
                                <div className="text-xs font-mono text-muted-foreground">
                                  {row['Note ID'].substring(0, 8)}...
                                </div>
                              </td>
                              
                              {/* Domain Scores with Heat Mapping */}
                              {Object.keys(row)
                                .filter(key => !['Grader Email', 'Grader ID', 'Note ID', 'Note Description', 'Total Score', 'Comments', 'Created At'].includes(key))
                                .map((key) => {
                                  const score = row[key] || 0
                                  const maxScore = 5 // Assuming max score is 5
                                  return (
                                    <td key={key} className="px-2 py-3 text-center">
                                      <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold ${getScoreColor(score, maxScore)}`}>
                                        {score || '-'}
                                      </div>
                                    </td>
                                  )
                                })}
                              
                              {/* Total Score */}
                              <td className="px-3 py-3 text-center">
                                <div className={`inline-flex items-center justify-center w-10 h-8 rounded-full text-sm font-bold ${getScoreColor(row['Total Score'], 25)}`}>
                                  {row['Total Score'] || 0}
                                </div>
                              </td>
                              
                              {/* Comments - Expandable */}
                              <td className="px-3 py-3 text-sm text-foreground">
                                {comment ? (
                                  <div className="space-y-1">
                                    <div className="text-xs text-muted-foreground">
                                      {isCommentExpanded ? comment : commentPreview}
                                    </div>
                                    {comment.length > 50 && (
                                      <button
                                        onClick={() => toggleCommentExpansion(gradeId)}
                                        className="text-xs text-primary hover:text-primary/80 font-medium"
                                      >
                                        {isCommentExpanded ? 'Show less' : 'Show more'}
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground italic">No comments</span>
                                )}
                              </td>
                              
                              {/* Created Date */}
                              <td className="px-3 py-3 text-center">
                                <div className="text-xs text-muted-foreground">
                                  {row['Created At']}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Legend for Score Colors */}
                <div className="flex items-center justify-center space-x-4 text-sm text-muted-foreground">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-xs font-semibold">5</div>
                    <span>Excellent (4-5)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-semibold">3</div>
                    <span>Good (3-4)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-yellow-100 text-yellow-700 rounded-full flex items-center justify-center text-xs font-semibold">2</div>
                    <span>Fair (2-3)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center text-xs font-semibold">1</div>
                    <span>Poor (1-2)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center text-xs font-semibold">-</div>
                    <span>Not scored</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Completion Heatmap Tab */}
        {activeTab === 'completion' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-semibold">Completion Heatmap</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Visual overview of grading progress by user and note
                </p>
              </div>
              <button
                onClick={loadCompletionData}
                disabled={isLoadingCompletion}
                className="bg-secondary text-secondary-foreground px-3 py-2 rounded-md hover:bg-secondary/80 flex items-center space-x-2 disabled:opacity-50 text-sm"
              >
                {isLoadingCompletion ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            {isLoadingCompletion ? (
              <div className="flex justify-center items-center py-8">
                <div className="text-muted-foreground">Loading completion data...</div>
              </div>
            ) : !completionData.matrix || completionData.matrix.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No grading data found. Start grading some notes to see the heatmap.
              </div>
            ) : (
              <div className="space-y-6">
                {/* Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-card border p-4 rounded-lg">
                    <div className="text-2xl font-bold text-primary">{completionData.totalGraders}</div>
                    <div className="text-sm text-muted-foreground">Active Graders</div>
                  </div>
                  <div className="bg-card border p-4 rounded-lg">
                    <div className="text-2xl font-bold text-primary">{completionData.totalNotes}</div>
                    <div className="text-sm text-muted-foreground">Total Notes</div>
                  </div>
                  <div className="bg-card border p-4 rounded-lg">
                    <div className="text-2xl font-bold text-primary">
                      {Math.round(completionData.matrix.reduce((acc, user) => acc + user.completionRate, 0) / completionData.matrix.length)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Avg Completion</div>
                  </div>
                </div>

                {/* Heatmap Table */}
                <div className="bg-card border shadow-sm overflow-hidden sm:rounded-lg">
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider sticky left-0 bg-muted/50 z-10">
                            Grader
                          </th>
                          <th className="px-2 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Progress
                          </th>
                          {completionData.notes.map((note) => (
                            <th
                              key={note.id}
                              className="px-2 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider min-w-[80px]"
                              title={note.description}
                            >
                              <div className="truncate max-w-[60px]">{note.description}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-background divide-y divide-border">
                        {completionData.matrix.map((user, userIndex) => (
                          <tr key={user.userId} className="hover:bg-muted/30">
                            <td className="px-4 py-3 text-sm font-medium text-foreground sticky left-0 bg-background z-10">
                              <div className="truncate max-w-[200px]" title={user.userEmail}>
                                {user.userEmail}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {user.completedNotes}/{user.totalNotes} notes
                              </div>
                            </td>
                            <td className="px-2 py-3 text-center">
                              <div className="flex items-center justify-center space-x-2">
                                <div className="w-16 bg-slate-200 rounded-full h-2">
                                  <div
                                    className="bg-emerald-400 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${user.completionRate}%` }}
                                  />
                                </div>
                                <span className="text-xs font-medium text-muted-foreground min-w-[35px]">
                                  {Math.round(user.completionRate)}%
                                </span>
                              </div>
                            </td>
                            {completionData.notes.map((note) => {
                              const completion = user.noteCompletions[note.id]
                              return (
                                <td key={note.id} className="px-2 py-3 text-center">
                                  <div
                                    className={`w-6 h-6 mx-auto rounded-full flex items-center justify-center text-xs font-medium transition-all duration-200 ${
                                      completion?.completed && !completion?.partiallyCompleted
                                        ? 'bg-emerald-400 text-white shadow-sm shadow-emerald-400/20'
                                        : completion?.partiallyCompleted
                                        ? 'bg-amber-400 text-white shadow-sm shadow-amber-400/20'
                                        : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                                    }`}
                                    title={
                                      completion?.completed && !completion?.partiallyCompleted
                                        ? `Completed: ${note.description}`
                                        : completion?.partiallyCompleted
                                        ? `In Progress: ${note.description} (${completion.completedDomains}/${completion.totalDomains} domains)`
                                        : `Not started: ${note.description}`
                                    }
                                  >
                                    {completion?.completed && !completion?.partiallyCompleted
                                      ? '✓'
                                      : completion?.partiallyCompleted
                                      ? '◐'
                                      : '○'}
                                  </div>
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex items-center justify-center space-x-6 text-sm text-muted-foreground">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-emerald-400 rounded-full flex items-center justify-center text-white text-xs">✓</div>
                    <span>Completed</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center text-white text-xs">◐</div>
                    <span>In Progress</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-slate-200 rounded-full flex items-center justify-center text-slate-500 text-xs">○</div>
                    <span>Not Started</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* User Management Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">User Access Management</h2>
              <p className="text-muted-foreground">Manage who can access the surgery note grader</p>
            </div>

            {userError && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive">{userError}</p>
              </div>
            )}

            {/* Add User Actions */}
            <div className="flex gap-4">
              <button
                onClick={() => setShowAddUserDialog(true)}
                className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Single User
              </button>
              <button
                onClick={() => setShowCsvUpload(true)}
                className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/90 flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Upload CSV
              </button>
            </div>

            {/* Users List */}
            <div className="bg-card border p-6 rounded-lg shadow-sm">
              <h3 className="text-lg font-semibold mb-4">Authorized Users ({users.length})</h3>
              <p className="text-muted-foreground mb-4">Users who can access the surgery note grader</p>
              
              {users.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No users found</p>
                  <p className="text-sm">Add users above to grant access</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {users.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-4 border rounded-md bg-background/50">
                      <div className="space-y-1">
                        <div className="font-medium">
                          {user.first_name || 'User'} {user.last_name || 'Name'}
                        </div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className={`px-2 py-1 rounded-full ${
                            user.role === 'Faculty' 
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                              : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          }`}>
                            {user.role || 'Faculty'}
                          </span>
                          <span className="text-muted-foreground">
                            Added {new Date(user.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveUser(user.id, user.email)}
                        className="text-destructive hover:text-destructive/80 px-3 py-1 border border-destructive/20 rounded-md hover:bg-destructive/10 transition-colors"
                      >
                        Remove Access
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Export Tab */}
        {activeTab === 'export' && (
          <div>
            <div className="bg-card border p-6 rounded-lg shadow-sm">
              <h2 className="text-xl font-semibold mb-4">Export Data</h2>
              <p className="text-muted-foreground mb-6">
                Download all grading data as a CSV file for analysis.
              </p>
              <button
                onClick={exportData}
                className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Add User Dialog */}
      {showAddUserDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-background border rounded-lg shadow-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Add New User</h3>
            
            {userError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md mb-4">
                <p className="text-sm text-destructive">{userError}</p>
              </div>
            )}

            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email *</label>
                <input
                  type="email"
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({...newUserForm, email: e.target.value})}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background"
                  placeholder="user@example.com"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">First Name *</label>
                  <input
                    type="text"
                    value={newUserForm.firstName}
                    onChange={(e) => setNewUserForm({...newUserForm, firstName: e.target.value})}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background"
                    placeholder="John"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Last Name *</label>
                  <input
                    type="text"
                    value={newUserForm.lastName}
                    onChange={(e) => setNewUserForm({...newUserForm, lastName: e.target.value})}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background"
                    placeholder="Doe"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Role *</label>
                <select
                  value={newUserForm.role}
                  onChange={(e) => setNewUserForm({...newUserForm, role: e.target.value})}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background"
                  required
                >
                  <option value="Resident">Resident</option>
                  <option value="Faculty">Faculty</option>
                </select>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddUserDialog(false)
                    setUserError(null)
                    setNewUserForm({email: '', firstName: '', lastName: '', role: 'Resident'})
                  }}
                  className="flex-1 px-4 py-2 border border-border rounded-md hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90"
                >
                  Add User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Upload Dialog */}
      {showCsvUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-background border rounded-lg shadow-lg max-w-2xl w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Upload Users via CSV</h3>
            
            <div className="mb-4 p-4 bg-muted/50 rounded-md">
              <h4 className="font-medium mb-2">CSV Format Requirements:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Required columns: <code className="bg-muted px-1 rounded">email</code>, <code className="bg-muted px-1 rounded">first_name</code>, <code className="bg-muted px-1 rounded">last_name</code>, <code className="bg-muted px-1 rounded">role</code></li>
                <li>• Role must be either "Resident" or "Faculty"</li>
                <li>• First row should contain column headers</li>
                <li>• No duplicate emails allowed</li>
              </ul>
              <div className="mt-3">
                <p className="text-sm font-medium">Example:</p>
                <pre className="text-xs bg-background p-2 rounded mt-1 overflow-x-auto">
email,first_name,last_name,role{'\n'}john.doe@example.com,John,Doe,Resident{'\n'}jane.smith@example.com,Jane,Smith,Faculty
                </pre>
              </div>
            </div>

            {csvError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md mb-4">
                <p className="text-sm text-destructive whitespace-pre-line">{csvError}</p>
              </div>
            )}

            <form onSubmit={handleCsvUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Select CSV File</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background"
                  required
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCsvUpload(false)
                    setCsvError(null)
                    setCsvFile(null)
                  }}
                  className="flex-1 px-4 py-2 border border-border rounded-md hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90"
                >
                  Upload Users
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}


