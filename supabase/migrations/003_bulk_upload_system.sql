-- Migration: Bulk Note Upload System
-- Description: Add tables and functionality for bulk uploading surgery notes
-- Phase: 1.1
-- Date: 2024-12-19

-- Create table for tracking bulk upload batches
create table if not exists public.note_uploads (
    id uuid primary key default gen_random_uuid(),
    batch_id uuid not null default gen_random_uuid(),
    filename text not null,
    original_filename text not null,
    file_size integer,
    mime_type text,
    total_records integer default 0,
    processed_records integer default 0,
    successful_records integer default 0,
    failed_records integer default 0,
    status text check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')) default 'pending',
    errors jsonb default '[]'::jsonb,
    validation_errors jsonb default '[]'::jsonb,
    processing_log jsonb default '[]'::jsonb,
    uploaded_by uuid references auth.users(id) not null,
    started_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Add batch tracking columns to surgery_notes
alter table public.surgery_notes 
add column if not exists batch_id uuid,
add column if not exists upload_source text default 'manual',
add column if not exists source_row_number integer,
add column if not exists validation_status text check (validation_status in ('valid', 'warning', 'error')) default 'valid',
add column if not exists validation_notes jsonb default '[]'::jsonb;

-- Create indexes for performance
create index if not exists idx_note_uploads_batch_id on public.note_uploads(batch_id);
create index if not exists idx_note_uploads_status on public.note_uploads(status);
create index if not exists idx_note_uploads_uploaded_by on public.note_uploads(uploaded_by);
create index if not exists idx_surgery_notes_batch_id on public.surgery_notes(batch_id);
create index if not exists idx_surgery_notes_upload_source on public.surgery_notes(upload_source);

-- Create updated_at trigger for note_uploads
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists handle_note_uploads_updated_at on public.note_uploads;
create trigger handle_note_uploads_updated_at
    before update on public.note_uploads
    for each row execute procedure public.handle_updated_at();

-- RLS Policies for note_uploads table

-- Enable RLS
alter table public.note_uploads enable row level security;

-- Admin users can see all uploads
create policy "Admins can view all note uploads"
on public.note_uploads for select
using (
    coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'email' in (
        select email from public.admin_emails
    )
);

-- Admin users can insert uploads
create policy "Admins can create note uploads"
on public.note_uploads for insert
with check (
    coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'email' in (
        select email from public.admin_emails
    )
);

-- Admin users can update uploads
create policy "Admins can update note uploads"
on public.note_uploads for update
using (
    coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'email' in (
        select email from public.admin_emails
    )
);

-- Users can see their own uploads
create policy "Users can view their own uploads"
on public.note_uploads for select
using (uploaded_by = auth.uid());

-- Create a view for upload statistics
create or replace view public.upload_stats as
select 
    batch_id,
    filename,
    status,
    total_records,
    successful_records,
    failed_records,
    (successful_records::float / nullif(total_records, 0) * 100)::numeric(5,2) as success_rate,
    uploaded_by,
    created_at,
    completed_at,
    extract(epoch from (completed_at - started_at))::integer as processing_duration_seconds
from public.note_uploads
where total_records > 0;

-- Grant permissions on the view
grant select on public.upload_stats to authenticated;

-- Create function to validate note data
create or replace function public.validate_note_data(
    p_title text,
    p_content text,
    p_phase text,
    p_patient_id text default null,
    p_procedure_type text default null,
    p_complexity integer default null
)
returns jsonb
language plpgsql
as $$
declare
    validation_result jsonb := '{"valid": true, "errors": [], "warnings": []}'::jsonb;
    errors text[] := array[]::text[];
    warnings text[] := array[]::text[];
begin
    -- Required field validation
    if p_title is null or trim(p_title) = '' then
        errors := array_append(errors, 'Title is required');
    elsif length(p_title) > 200 then
        errors := array_append(errors, 'Title must be 200 characters or less');
    end if;
    
    if p_content is null or trim(p_content) = '' then
        errors := array_append(errors, 'Content is required');
    elsif length(p_content) < 50 then
        warnings := array_append(warnings, 'Content seems very short (less than 50 characters)');
    end if;
    
    if p_phase is null or p_phase not in ('1', '2', 'P1', 'P2', 'Phase 1', 'Phase 2') then
        errors := array_append(errors, 'Phase must be 1, 2, P1, P2, Phase 1, or Phase 2');
    end if;
    
    -- Optional field validation
    if p_patient_id is not null and length(p_patient_id) > 50 then
        errors := array_append(errors, 'Patient ID must be 50 characters or less');
    end if;
    
    if p_procedure_type is not null and length(p_procedure_type) > 100 then
        errors := array_append(errors, 'Procedure type must be 100 characters or less');
    end if;
    
    if p_complexity is not null and (p_complexity < 1 or p_complexity > 5) then
        errors := array_append(errors, 'Complexity must be between 1 and 5');
    end if;
    
    -- Build result
    validation_result := jsonb_set(validation_result, '{errors}', to_jsonb(errors));
    validation_result := jsonb_set(validation_result, '{warnings}', to_jsonb(warnings));
    validation_result := jsonb_set(validation_result, '{valid}', to_jsonb(array_length(errors, 1) is null));
    
    return validation_result;
end;
$$;

-- Grant execute permission on validation function
grant execute on function public.validate_note_data to authenticated;

-- Create function to normalize phase values
create or replace function public.normalize_phase(phase_input text)
returns text
language plpgsql
as $$
begin
    case lower(trim(phase_input))
        when '1', 'p1', 'phase 1', 'phase1' then return '1';
        when '2', 'p2', 'phase 2', 'phase2' then return '2';
        else return phase_input; -- Return original if no match
    end case;
end;
$$;

-- Grant execute permission on normalize function
grant execute on function public.normalize_phase to authenticated;

-- Add comment for documentation
comment on table public.note_uploads is 'Tracks bulk upload operations for surgery notes';
comment on table public.surgery_notes is 'Surgery consultation notes with batch tracking support';
comment on function public.validate_note_data is 'Validates surgery note data for bulk uploads';
comment on function public.normalize_phase is 'Normalizes phase input to standard format';
