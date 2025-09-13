export interface SurgeryNote {
  id: string;
  note_text: string;
  created_at: string;
  updated_at: string;
}

export interface RubricDomain {
  id: string;
  name: string;
  description: string;
  examples: string;
  max_score: number;
  order: number;
  score_guidance?: Record<number, string>;
  created_at: string;
  updated_at: string;
}

export interface Grade {
  id: string;
  note_id: string;
  grader_id: string;
  domain_scores: Record<string, number>; // domain_id -> score
  total_score: number;
  feedback?: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  role: 'grader' | 'admin';
  created_at: string;
}
