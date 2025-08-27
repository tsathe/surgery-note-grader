"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, CheckCircle, Users, FileText, BarChart3, Shield } from "lucide-react"
import { ModeToggle } from "@/components/theme/mode-toggle"

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm hover:text-muted-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Login
          </Link>
          <h1 className="font-semibold">About Surgery Note Grader</h1>
          <ModeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">Surgery Note Grader</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            A professional platform for evaluating surgical consultation notes using evidence-based rubrics
          </p>
        </div>

        {/* Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Project Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              This platform enables medical educators, residents, and researchers to systematically evaluate surgical consultation notes 
              for quality, completeness, and clinical reasoning. By providing a standardized rubric-based assessment tool, we aim to 
              improve surgical documentation standards and create valuable data for medical education research.
            </p>
            <p>
              Each surgical consultation note is evaluated across five critical domains using a 1-5 point scale, with detailed 
              guidance and examples provided for each scoring level to ensure consistent, objective evaluation.
            </p>
          </CardContent>
        </Card>

        {/* Evaluation Domains */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Five Evaluation Domains
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <h3 className="font-semibold">Clinical Assessment & Reasoning</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Evaluation of diagnostic thinking, differential diagnosis consideration, and clinical judgment.
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <h3 className="font-semibold">Documentation Quality</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Assessment of completeness, accuracy, and organization of patient information.
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <h3 className="font-semibold">Treatment Planning</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Review of surgical recommendations, risk assessment, and treatment alternatives.
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <h3 className="font-semibold">Professional Communication</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Evaluation of clarity, professionalism, and patient-centered communication.
                </p>
              </div>
              
              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <h3 className="font-semibold">Overall Clinical Judgment</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Holistic assessment of clinical decision-making and integration of patient care elements.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* How It Works */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              How It Works
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-6 md:grid-cols-3">
              <div className="text-center space-y-2">
                <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto font-semibold">
                  1
                </div>
                <h3 className="font-semibold">Access & Assignment</h3>
                <p className="text-sm text-muted-foreground">
                  Authorized users receive email access and are assigned surgical consultation notes to evaluate.
                </p>
              </div>
              
              <div className="text-center space-y-2">
                <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto font-semibold">
                  2
                </div>
                <h3 className="font-semibold">Structured Evaluation</h3>
                <p className="text-sm text-muted-foreground">
                  Review notes using our comprehensive rubric with detailed scoring guidance for each domain.
                </p>
              </div>
              
              <div className="text-center space-y-2">
                <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto font-semibold">
                  3
                </div>
                <h3 className="font-semibold">Data Collection</h3>
                <p className="text-sm text-muted-foreground">
                  Evaluations are securely stored for research analysis and quality improvement initiatives.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Platform Features
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm">Secure authentication via magic links</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm">Comprehensive rubric with detailed guidance</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm">Progressive disclosure interface design</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm">Real-time progress tracking</span>
                </li>
              </ul>
              
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm">Admin dashboard for user management</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm">CSV data export for analysis</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm">Dark mode support</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm">Responsive design for all devices</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Call to Action */}
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-semibold">Ready to Get Started?</h2>
          <p className="text-muted-foreground">
            Contact your administrator to receive access credentials for the Surgery Note Grader platform.
          </p>
          <Link href="/">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Login
            </Button>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-sm text-muted-foreground">
          <p>© 2024 Surgery Note Grader. Professional medical assessment tool for research and education.</p>
        </div>
      </footer>
    </div>
  )
}
