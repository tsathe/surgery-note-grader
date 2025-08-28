"use client"

import { useState, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Upload, FileText, AlertCircle, CheckCircle, X, Download } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface ValidationError {
  row: number
  errors: string[]
  warnings?: string[]
  data: any
}

interface UploadResult {
  success: boolean
  batch_id: string
  total_records: number
  successful_records: number
  failed_records: number
  validation_errors: ValidationError[]
}

interface BulkUploadModalProps {
  onUploadComplete?: (result: UploadResult) => void
}

export default function BulkUploadModal({ onUploadComplete }: BulkUploadModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setError(null)
      setUploadResult(null)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    setUploadProgress(0)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90))
      }, 200)

      const response = await fetch('/api/admin/upload-notes', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed')
      }

      setUploadResult(result)
      onUploadComplete?.(result)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleReset = () => {
    setSelectedFile(null)
    setUploadResult(null)
    setError(null)
    setUploadProgress(0)
    setIsUploading(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClose = () => {
    if (!isUploading) {
      setIsOpen(false)
      handleReset()
    }
  }

  const downloadTemplate = () => {
    const csvContent = `title,content,phase,patient_id,procedure_type,complexity
"Example Appendectomy Consult","Patient presents with acute right lower quadrant pain...",1,P001,General Surgery,2
"Cholecystectomy Evaluation","45-year-old female with symptomatic cholelithiasis...",2,P002,General Surgery,3`

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'surgery_notes_template.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="h-4 w-4 mr-2" />
          Bulk Upload Notes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Upload Surgery Notes</DialogTitle>
          <DialogDescription>
            Upload multiple surgery notes from a CSV or Excel file
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Template Download */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div>
              <h4 className="font-medium">Need a template?</h4>
              <p className="text-sm text-muted-foreground">
                Download a CSV template with the correct format
              </p>
            </div>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
          </div>

          {/* File Selection */}
          {!uploadResult && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium mb-2">
                    Choose a file to upload
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Supports CSV and Excel files (.csv, .xlsx, .xls)
                  </p>
                  <Button type="button" variant="outline">
                    Select File
                  </Button>
                </label>
              </div>

              {selectedFile && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <FileText className="h-4 w-4" />
                        <span className="font-medium">{selectedFile.name}</span>
                        <Badge variant="secondary">
                          {(selectedFile.size / 1024).toFixed(1)} KB
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedFile(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Required Format Info */}
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Required columns:</strong> title, content, phase<br />
                  <strong>Optional columns:</strong> patient_id, procedure_type, complexity<br />
                  Phase should be: 1, 2, P1, P2, "Phase 1", or "Phase 2"
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="font-medium mb-2">Processing your file...</p>
                <Progress value={uploadProgress} className="w-full" />
                <p className="text-sm text-muted-foreground mt-2">
                  {uploadProgress < 90 ? 'Uploading...' : 'Processing records...'}
                </p>
              </div>
            </div>
          )}

          {/* Upload Results */}
          {uploadResult && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold text-lg">Upload Complete</h3>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {uploadResult.total_records}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Total Records
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {uploadResult.successful_records}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Successful
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {uploadResult.failed_records}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Failed
                    </div>
                  </CardContent>
                </Card>
              </div>

              {uploadResult.validation_errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-red-600">Validation Errors</h4>
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {uploadResult.validation_errors.map((error, index) => (
                      <Alert key={index} variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Row {error.row}:</strong> {error.errors.join(', ')}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-2">
            {uploadResult ? (
              <>
                <Button variant="outline" onClick={handleReset}>
                  Upload Another File
                </Button>
                <Button onClick={handleClose}>
                  Close
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={handleClose} disabled={isUploading}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleUpload} 
                  disabled={!selectedFile || isUploading}
                >
                  {isUploading ? 'Uploading...' : 'Upload'}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
