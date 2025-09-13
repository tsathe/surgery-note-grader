-- Part 1: Create Tables Only
-- Migration: Inter-rater Reliability System (Part 1 - Tables)

-- Create inter_rater_assignments table
create table if not exists public.inter_rater_assignments (
    id uuid primary key default gen_random_uuid(),
    note_id uuid references public.surgery_notes(id) on delete cascade not null,
    primary_grader_id uuid references auth.users(id) on delete cascade not null,
    secondary_grader_id uuid references auth.users(id) on delete cascade not null,
    assignment_group_id uuid not null,
    created_by uuid references auth.users(id) not null,
    created_at timestamptz default now(),
    due_date timestamptz,
    
    -- Status tracking
    primary_status text check (primary_status in ('assigned', 'in_progress', 'completed', 'overdue')) default 'assigned',
    secondary_status text check (secondary_status in ('assigned', 'in_progress', 'completed', 'overdue')) default 'assigned',
    consensus_status text check (consensus_status in ('pending', 'in_progress', 'resolved', 'escalated')) default 'pending',
    
    -- Completion tracking
    primary_completed_at timestamptz,
    secondary_completed_at timestamptz,
    consensus_completed_at timestamptz,
    
    -- Agreement metrics
    agreement_score numeric(5,4),
    disagreement_domains text[],
    needs_consensus boolean default false,
    consensus_grader_id uuid references auth.users(id),
    
    -- Constraints
    unique(note_id, primary_grader_id, secondary_grader_id),
    check (primary_grader_id != secondary_grader_id)
);

-- Create agreement_calculations table
create table if not exists public.agreement_calculations (
    id uuid primary key default gen_random_uuid(),
    inter_rater_assignment_id uuid references public.inter_rater_assignments(id) on delete cascade not null,
    domain_name text not null,
    primary_score numeric,
    secondary_score numeric,
    difference numeric,
    agreement_type text check (agreement_type in ('exact', 'within_1', 'within_2', 'disagreement')) not null,
    weight numeric default 1.0,
    calculated_at timestamptz default now(),
    
    unique(inter_rater_assignment_id, domain_name)
);

-- Create consensus_resolutions table
create table if not exists public.consensus_resolutions (
    id uuid primary key default gen_random_uuid(),
    inter_rater_assignment_id uuid references public.inter_rater_assignments(id) on delete cascade not null,
    domain_name text not null,
    primary_score numeric,
    secondary_score numeric,
    final_score numeric not null,
    resolution_method text check (resolution_method in ('average', 'primary_preferred', 'secondary_preferred', 'third_party', 'discussion')) not null,
    resolved_by uuid references auth.users(id) not null,
    resolution_notes text,
    resolved_at timestamptz default now(),
    
    unique(inter_rater_assignment_id, domain_name)
);

-- Create supporting tables
create table if not exists public.admin_emails (
    email text primary key,
    created_at timestamptz default now()
);

create table if not exists public.users (
    id uuid default gen_random_uuid() primary key,
    email text unique not null,
    first_name text,
    last_name text,
    role text default 'Resident',
    created_at timestamptz default now()
);

-- Add columns to surgery_notes
alter table public.surgery_notes 
add column if not exists inter_rater_assignment_count integer default 0,
add column if not exists has_inter_rater_assignment boolean default false,
add column if not exists agreement_score numeric(5,4),
add column if not exists consensus_required boolean default false;
