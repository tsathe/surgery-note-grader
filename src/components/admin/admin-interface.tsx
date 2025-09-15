"use client"

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { SurgeryNote, RubricDomain } from '@/lib/types'
import { Plus, Edit, Trash2, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import BulkUploadModal from './bulk-upload/bulk-upload-modal'
import AssignmentManager from './assignment-manager/assignment-manager'
import SimpleInterRater from './simple-inter-rater'

interface AdminInterfaceProps {
  user: any
}

export default function AdminInterface({ user }: AdminInterfaceProps) {
  const [notes, setNotes] = useState<SurgeryNote[]>([])
  const [domains, setDomains] = useState<RubricDomain[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'notes' | 'assignments' | 'inter-rater' | 'rubric' | 'users' | 'analytics' | 'export'>('notes')
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [showDomainForm, setShowDomainForm] = useState(false)
  const [showImportRubric, setShowImportRubric] = useState(false)
  const [importRubricText, setImportRubricText] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const [editingNote, setEditingNote] = useState<SurgeryNote | null>(null)
  const [editingDomain, setEditingDomain] = useState<RubricDomain | null>(null)
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

  const handleNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingNote) {
        const { error } = await supabase
          .from('surgery_notes')
          .update(noteForm)
          .eq('id', editingNote.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('surgery_notes')
          .insert(noteForm)
        if (error) throw error
      }
      
      setShowNoteForm(false)
      setEditingNote(null)
      setNoteForm({ description: '', note_text: '' })
      await loadData()
    } catch (error) {
      console.error('Error saving note:', error)
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
      const { data: grades, error } = await supabase
        .from('grades')
        .select(`
          *,
          surgery_notes (description, note_text),
          rubric_domains (name)
        `)
      
      if (error) {
        console.error('Supabase error:', error)
        alert(`Error fetching data: ${error.message}`)
        return
      }

      console.log('Grades data:', grades)

      if (!grades || grades.length === 0) {
        alert('No grading data found to export.')
        return
      }

      // Convert to CSV format
      const csvData = grades.map(grade => ({
        'Note Description': grade.surgery_notes?.description || '',
        'Note ID': grade.note_id,
        'Grader ID': grade.grader_id,
        'Total Score': grade.total_score,
        'Feedback': grade.feedback || '',
        'Date': new Date(grade.created_at).toLocaleDateString(),
        ...grade.domain_scores
      }))

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
              { id: 'assignments', label: 'Assignments' },
              { id: 'inter-rater', label: 'Inter-rater Reliability' },
              { id: 'rubric', label: 'Rubric Domains' },
              { id: 'users', label: 'User Access' },
              { id: 'analytics', label: 'Analytics' },
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
                    setShowNoteForm(true)
                    setEditingNote(null)
                    setNoteForm({ description: '', note_text: '' })
                  }}
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Note</span>
                </button>
              </div>
            </div>

            {showNoteForm && (
              <div className="bg-card border p-6 rounded-lg shadow-sm mb-6">
                <h3 className="text-lg font-medium mb-4">
                  {editingNote ? 'Edit Note' : 'Add New Note'}
                </h3>
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
                      onClick={() => setShowNoteForm(false)}
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
              </div>
            )}

            <div className="bg-card border shadow-sm overflow-hidden sm:rounded-md">
              <ul className="divide-y">
                {notes.map((note) => (
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
                            setEditingNote(note)
                            setNoteForm({
                              description: note.description,
                              note_text: note.note_text
                            })
                            setShowNoteForm(true)
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

        {/* Assignments Tab */}
        {activeTab === 'assignments' && (
          <AssignmentManager onAssignmentUpdate={loadData} />
        )}

        {/* Inter-rater Reliability Tab */}
        {activeTab === 'inter-rater' && (
          <SimpleInterRater onUpdate={loadData} />
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


