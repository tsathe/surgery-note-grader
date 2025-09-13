-- Migration: Inter-rater Reliability System (Fixed)
-- Description: Add tables and functionality for duplicate assignments and agreement tracking
-- Phase: 1.3
-- Date: 2024-12-19

-- Create inter_rater_assignments table
create table if not exists public.inter_rater_assignments (
    id uuid primary key default gen_random_uuid(),
    note_id uuid references public.surgery_notes(id) on delete cascade not null,
    primary_grader_id uuid references auth.users(id) on delete cascade not null,
    secondary_grader_id uuid references auth.users(id) on delete cascade not null,
    assignment_group_id uuid not null, -- Groups related assignments together
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
    agreement_score numeric(5,4), -- Calculated agreement score (0-1)
    disagreement_domains text[], -- Array of domain names with disagreement
    needs_consensus boolean default false,
    consensus_grader_id uuid references auth.users(id), -- Who resolves consensus
    
    -- Prevent duplicate assignments
    unique(note_id, primary_grader_id, secondary_grader_id),
    
    -- Ensure graders are different
    check (primary_grader_id != secondary_grader_id)
);

-- Create agreement_calculations table for detailed metrics
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

-- Add inter-rater tracking to surgery_notes
alter table public.surgery_notes 
add column if not exists inter_rater_assignment_count integer default 0,
add column if not exists has_inter_rater_assignment boolean default false,
add column if not exists agreement_score numeric(5,4),
add column if not exists consensus_required boolean default false;

-- Create indexes for performance
create index if not exists idx_inter_rater_note_id on public.inter_rater_assignments(note_id);
create index if not exists idx_inter_rater_primary_grader on public.inter_rater_assignments(primary_grader_id);
create index if not exists idx_inter_rater_secondary_grader on public.inter_rater_assignments(secondary_grader_id);
create index if not exists idx_inter_rater_assignment_group on public.inter_rater_assignments(assignment_group_id);
create index if not exists idx_inter_rater_consensus_status on public.inter_rater_assignments(consensus_status);
create index if not exists idx_inter_rater_needs_consensus on public.inter_rater_assignments(needs_consensus) where needs_consensus = true;
create index if not exists idx_agreement_calculations_assignment on public.agreement_calculations(inter_rater_assignment_id);
create index if not exists idx_consensus_resolutions_assignment on public.consensus_resolutions(inter_rater_assignment_id);

-- Enable RLS on new tables
alter table public.inter_rater_assignments enable row level security;
alter table public.agreement_calculations enable row level security;
alter table public.consensus_resolutions enable row level security;

-- Create admin_emails table if it doesn't exist (for RLS policies)
create table if not exists public.admin_emails (
    email text primary key,
    created_at timestamptz default now()
);

-- Enable RLS on admin_emails
alter table public.admin_emails enable row level security;

-- Allow admins to read admin_emails table
create policy "Admins can view admin emails"
on public.admin_emails for select
using (
    coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'email' = email
);

-- RLS Policies for inter_rater_assignments

-- Admins can see all inter-rater assignments
create policy "Admins can view all inter-rater assignments"
on public.inter_rater_assignments for select
using (
    coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'email' in (
        select email from public.admin_emails
    )
);

-- Users can see assignments where they are primary or secondary grader
create policy "Users can view their inter-rater assignments"
on public.inter_rater_assignments for select
using (primary_grader_id = auth.uid() or secondary_grader_id = auth.uid() or consensus_grader_id = auth.uid());

-- Admins can create inter-rater assignments
create policy "Admins can create inter-rater assignments"
on public.inter_rater_assignments for insert
with check (
    coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'email' in (
        select email from public.admin_emails
    )
);

-- Admins can update inter-rater assignments
create policy "Admins can update inter-rater assignments"
on public.inter_rater_assignments for update
using (
    coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'email' in (
        select email from public.admin_emails
    )
);

-- Users can update status of their assignments
create policy "Users can update their inter-rater assignment status"
on public.inter_rater_assignments for update
using (primary_grader_id = auth.uid() or secondary_grader_id = auth.uid() or consensus_grader_id = auth.uid());

-- Similar policies for other tables
create policy "Admins can view all agreement calculations"
on public.agreement_calculations for select
using (
    coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'email' in (
        select email from public.admin_emails
    )
);

create policy "Users can view their agreement calculations"
on public.agreement_calculations for select
using (
    exists (
        select 1 from public.inter_rater_assignments ira
        where ira.id = inter_rater_assignment_id
        and (ira.primary_grader_id = auth.uid() or ira.secondary_grader_id = auth.uid() or ira.consensus_grader_id = auth.uid())
    )
);

create policy "System can create agreement calculations"
on public.agreement_calculations for insert
with check (auth.uid() is not null);

create policy "Admins can view all consensus resolutions"
on public.consensus_resolutions for select
using (
    coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'email' in (
        select email from public.admin_emails
    )
);

create policy "Users can view their consensus resolutions"
on public.consensus_resolutions for select
using (
    exists (
        select 1 from public.inter_rater_assignments ira
        where ira.id = inter_rater_assignment_id
        and (ira.primary_grader_id = auth.uid() or ira.secondary_grader_id = auth.uid() or ira.consensus_grader_id = auth.uid())
    )
);

create policy "Authorized users can create consensus resolutions"
on public.consensus_resolutions for insert
with check (
    exists (
        select 1 from public.inter_rater_assignments ira
        where ira.id = inter_rater_assignment_id
        and (ira.consensus_grader_id = auth.uid() or 
             coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'email' in (
                 select email from public.admin_emails
             ))
    )
);

-- Function to calculate agreement score between two grading sessions (using grades table)
create or replace function public.calculate_agreement_score(
    p_note_id uuid,
    p_primary_grader_id uuid,
    p_secondary_grader_id uuid
)
returns numeric as $$
declare
    agreement_score numeric := 0;
    total_domains integer := 0;
    exact_matches integer := 0;
    within_1_matches integer := 0;
    domain_record record;
    primary_score numeric;
    secondary_score numeric;
    score_diff numeric;
    primary_grade_record record;
    secondary_grade_record record;
begin
    -- Get the grades for both graders
    select * into primary_grade_record
    from public.grades
    where note_id = p_note_id and grader_id = p_primary_grader_id
    order by created_at desc
    limit 1;

    select * into secondary_grade_record
    from public.grades
    where note_id = p_note_id and grader_id = p_secondary_grader_id
    order by created_at desc
    limit 1;

    -- If either grade is missing, return 0
    if primary_grade_record is null or secondary_grade_record is null then
        return 0;
    end if;

    -- Get all domain scores for comparison
    for domain_record in
        select name as domain_name, max_score
        from public.rubric_domains
        order by "order"
    loop
        -- Extract scores from JSONB domain_scores
        primary_score := coalesce((primary_grade_record.domain_scores ->> domain_record.domain_name)::numeric, 0);
        secondary_score := coalesce((secondary_grade_record.domain_scores ->> domain_record.domain_name)::numeric, 0);

        total_domains := total_domains + 1;
        score_diff := abs(primary_score - secondary_score);

        -- Categorize agreement
        if score_diff = 0 then
            exact_matches := exact_matches + 1;
        elsif score_diff <= 1 then
            within_1_matches := within_1_matches + 1;
        end if;

        -- Store detailed calculation
        insert into public.agreement_calculations (
            inter_rater_assignment_id,
            domain_name,
            primary_score,
            secondary_score,
            difference,
            agreement_type
        )
        select 
            ira.id,
            domain_record.domain_name,
            primary_score,
            secondary_score,
            score_diff,
            case 
                when score_diff = 0 then 'exact'
                when score_diff <= 1 then 'within_1'
                when score_diff <= 2 then 'within_2'
                else 'disagreement'
            end
        from public.inter_rater_assignments ira
        where ira.note_id = p_note_id
          and ira.primary_grader_id = p_primary_grader_id
          and ira.secondary_grader_id = p_secondary_grader_id
        on conflict (inter_rater_assignment_id, domain_name) do update set
            primary_score = excluded.primary_score,
            secondary_score = excluded.secondary_score,
            difference = excluded.difference,
            agreement_type = excluded.agreement_type,
            calculated_at = now();
    end loop;

    -- Calculate weighted agreement score
    -- Exact matches = 1.0, within 1 = 0.8, within 2 = 0.5, disagreement = 0.0
    if total_domains > 0 then
        agreement_score := (
            (exact_matches * 1.0 + within_1_matches * 0.8) / total_domains
        );
    end if;

    return coalesce(agreement_score, 0);
end;
$$ language plpgsql security definer;

-- Function to create inter-rater assignment
create or replace function public.create_inter_rater_assignment(
    p_note_id uuid,
    p_primary_grader_id uuid,
    p_secondary_grader_id uuid,
    p_created_by uuid,
    p_due_date timestamptz default null,
    p_assignment_group_id uuid default null
)
returns uuid as $$
declare
    assignment_id uuid;
    group_id uuid;
begin
    -- Generate group ID if not provided
    group_id := coalesce(p_assignment_group_id, gen_random_uuid());
    
    -- Create the inter-rater assignment
    insert into public.inter_rater_assignments (
        note_id,
        primary_grader_id,
        secondary_grader_id,
        assignment_group_id,
        created_by,
        due_date
    )
    values (
        p_note_id,
        p_primary_grader_id,
        p_secondary_grader_id,
        group_id,
        p_created_by,
        p_due_date
    )
    returning id into assignment_id;
    
    -- Update surgery_notes tracking
    update public.surgery_notes
    set 
        inter_rater_assignment_count = inter_rater_assignment_count + 1,
        has_inter_rater_assignment = true
    where id = p_note_id;
    
    -- Create corresponding regular assignments for each grader (if assignments table exists)
    -- This will fail silently if assignments table doesn't exist yet
    begin
        insert into public.assignments (note_id, user_id, assigned_by, due_date, priority, notes)
        values 
            (p_note_id, p_primary_grader_id, p_created_by, p_due_date, 2, 'Inter-rater reliability assignment (Primary)'),
            (p_note_id, p_secondary_grader_id, p_created_by, p_due_date, 2, 'Inter-rater reliability assignment (Secondary)')
        on conflict (note_id, user_id) do nothing;
    exception when others then
        -- Ignore errors if assignments table doesn't exist
        null;
    end;
    
    return assignment_id;
end;
$$ language plpgsql security definer;

-- Function to check and update inter-rater assignment status (using grades table)
create or replace function public.update_inter_rater_status()
returns trigger as $$
declare
    ira_record record;
    calculated_agreement numeric;
    disagreement_threshold numeric := 0.7; -- Agreement below this triggers consensus
begin
    -- Find inter-rater assignments for this note and user
    for ira_record in
        select * from public.inter_rater_assignments
        where note_id = NEW.note_id
          and (primary_grader_id = NEW.grader_id or secondary_grader_id = NEW.grader_id)
    loop
        -- Update completion status
        if ira_record.primary_grader_id = NEW.grader_id then
            update public.inter_rater_assignments
            set 
                primary_status = 'completed',
                primary_completed_at = now()
            where id = ira_record.id;
        else
            update public.inter_rater_assignments
            set 
                secondary_status = 'completed',
                secondary_completed_at = now()
            where id = ira_record.id;
        end if;
        
        -- Check if both graders have completed
        select * into ira_record from public.inter_rater_assignments where id = ira_record.id;
        
        if ira_record.primary_status = 'completed' and ira_record.secondary_status = 'completed' then
            -- Calculate agreement score
            calculated_agreement := public.calculate_agreement_score(
                ira_record.note_id,
                ira_record.primary_grader_id,
                ira_record.secondary_grader_id
            );
            
            -- Update assignment with agreement score
            update public.inter_rater_assignments
            set 
                agreement_score = calculated_agreement,
                needs_consensus = calculated_agreement < disagreement_threshold,
                consensus_status = case 
                    when calculated_agreement < disagreement_threshold then 'pending'
                    else 'resolved'
                end
            where id = ira_record.id;
            
            -- Update surgery note with agreement info
            update public.surgery_notes
            set 
                agreement_score = calculated_agreement,
                consensus_required = calculated_agreement < disagreement_threshold
            where id = ira_record.note_id;
        end if;
    end loop;
    
    return NEW;
end;
$$ language plpgsql security definer;

-- Create trigger to update inter-rater status when grading is completed (on grades table)
drop trigger if exists update_inter_rater_on_grading_completion on public.grades;
create trigger update_inter_rater_on_grading_completion
    after insert or update on public.grades
    for each row
    execute procedure public.update_inter_rater_status();

-- Function to get inter-rater reliability statistics
create or replace function public.get_inter_rater_stats()
returns table (
    total_assignments bigint,
    completed_assignments bigint,
    pending_consensus bigint,
    avg_agreement_score numeric,
    high_agreement_count bigint,
    low_agreement_count bigint
) as $$
begin
    return query
    select 
        count(*) as total_assignments,
        count(*) filter (where primary_status = 'completed' and secondary_status = 'completed') as completed_assignments,
        count(*) filter (where needs_consensus = true and consensus_status = 'pending') as pending_consensus,
        coalesce(avg(agreement_score), 0)::numeric(5,4) as avg_agreement_score,
        count(*) filter (where agreement_score >= 0.8) as high_agreement_count,
        count(*) filter (where agreement_score < 0.7) as low_agreement_count
    from public.inter_rater_assignments;
end;
$$ language plpgsql security definer;

-- Create users table if it doesn't exist (needed for the view)
create table if not exists public.users (
    id uuid default gen_random_uuid() primary key,
    email text unique not null,
    first_name text,
    last_name text,
    role text default 'Resident',
    created_at timestamptz default now()
);

-- Enable RLS on users table
alter table public.users enable row level security;

-- Allow authenticated users to read users table
create policy "Authenticated users can view users"
on public.users for select
using (auth.uid() is not null);

-- Allow admins to manage users
create policy "Admins can manage users"
on public.users for all
using (
    coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'email' in (
        select email from public.admin_emails
    )
);

-- Create view for inter-rater dashboard
create or replace view public.inter_rater_dashboard as
select 
    ira.id,
    ira.note_id,
    ira.assignment_group_id,
    ira.primary_grader_id,
    ira.secondary_grader_id,
    ira.consensus_grader_id,
    ira.primary_status,
    ira.secondary_status,
    ira.consensus_status,
    ira.agreement_score,
    ira.needs_consensus,
    ira.created_at,
    ira.due_date,
    sn.title as note_title,
    sn.surgery_date,
    sn.surgeon,
    'Phase 1' as note_phase, -- Default since phase column doesn't exist
    pg.email as primary_grader_email,
    coalesce(pgu.first_name, split_part(pg.email, '@', 1)) as primary_grader_first_name,
    coalesce(pgu.last_name, '') as primary_grader_last_name,
    sg.email as secondary_grader_email,
    coalesce(sgu.first_name, split_part(sg.email, '@', 1)) as secondary_grader_first_name,
    coalesce(sgu.last_name, '') as secondary_grader_last_name,
    cg.email as consensus_grader_email,
    case 
        when ira.due_date is not null and ira.due_date < now() 
             and (ira.primary_status != 'completed' or ira.secondary_status != 'completed')
        then true else false 
    end as is_overdue,
    case
        when ira.agreement_score >= 0.8 then 'high'
        when ira.agreement_score >= 0.7 then 'moderate'
        when ira.agreement_score is not null then 'low'
        else 'pending'
    end as agreement_level
from public.inter_rater_assignments ira
join public.surgery_notes sn on ira.note_id = sn.id
join auth.users pg on ira.primary_grader_id = pg.id
left join public.users pgu on pg.email = pgu.email
join auth.users sg on ira.secondary_grader_id = sg.id
left join public.users sgu on sg.email = sgu.email
left join auth.users cg on ira.consensus_grader_id = cg.id;

-- Grant permissions
grant select on public.inter_rater_dashboard to authenticated;
grant execute on function public.calculate_agreement_score to authenticated;
grant execute on function public.create_inter_rater_assignment to authenticated;
grant execute on function public.get_inter_rater_stats to authenticated;

-- Add comments for documentation
comment on table public.inter_rater_assignments is 'Tracks dual assignments for inter-rater reliability assessment';
comment on table public.agreement_calculations is 'Detailed agreement calculations by domain';
comment on table public.consensus_resolutions is 'Records consensus decisions for disagreements';
comment on function public.calculate_agreement_score is 'Calculates agreement score between two graders';
comment on function public.create_inter_rater_assignment is 'Creates inter-rater assignment with dual grader assignment';
comment on view public.inter_rater_dashboard is 'Comprehensive view of inter-rater assignments and agreement metrics';
