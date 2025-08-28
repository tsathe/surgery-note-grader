-- Migration: Assignment Management System
-- Description: Add tables and functionality for assigning notes to specific graders
-- Phase: 1.2
-- Date: 2024-12-19

-- Create assignments table
create table if not exists public.assignments (
    id uuid primary key default gen_random_uuid(),
    note_id uuid references public.surgery_notes(id) on delete cascade not null,
    user_id uuid references auth.users(id) on delete cascade not null,
    assigned_by uuid references auth.users(id) not null,
    assigned_at timestamptz default now(),
    due_date timestamptz,
    status text check (status in ('assigned', 'in_progress', 'completed', 'overdue', 'cancelled')) default 'assigned',
    priority integer default 1 check (priority between 1 and 5),
    notes text,
    started_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    
    -- Prevent duplicate assignments of same note to same user
    unique(note_id, user_id)
);

-- Create assignment_history table for audit trail
create table if not exists public.assignment_history (
    id uuid primary key default gen_random_uuid(),
    assignment_id uuid references public.assignments(id) on delete cascade not null,
    action text not null check (action in ('created', 'updated', 'status_changed', 'reassigned', 'cancelled')),
    old_values jsonb,
    new_values jsonb,
    changed_by uuid references auth.users(id) not null,
    changed_at timestamptz default now(),
    reason text
);

-- Add assignment tracking columns to surgery_notes
alter table public.surgery_notes 
add column if not exists assignment_count integer default 0,
add column if not exists is_assigned boolean default false,
add column if not exists last_assigned_at timestamptz;

-- Create indexes for performance
create index if not exists idx_assignments_user_id on public.assignments(user_id);
create index if not exists idx_assignments_note_id on public.assignments(note_id);
create index if not exists idx_assignments_status on public.assignments(status);
create index if not exists idx_assignments_due_date on public.assignments(due_date) where status != 'completed';
create index if not exists idx_assignments_assigned_by on public.assignments(assigned_by);
create index if not exists idx_assignments_priority on public.assignments(priority);
create index if not exists idx_assignment_history_assignment_id on public.assignment_history(assignment_id);
create index if not exists idx_assignment_history_changed_by on public.assignment_history(changed_by);
create index if not exists idx_surgery_notes_is_assigned on public.surgery_notes(is_assigned);

-- Create updated_at trigger for assignments
drop trigger if exists handle_assignments_updated_at on public.assignments;
create trigger handle_assignments_updated_at
    before update on public.assignments
    for each row execute procedure public.handle_updated_at();

-- Enable RLS on assignments table
alter table public.assignments enable row level security;

-- RLS Policies for assignments

-- Admins can see all assignments
create policy "Admins can view all assignments"
on public.assignments for select
using (
    coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'email' in (
        select email from public.admin_emails
    )
);

-- Users can see their own assignments
create policy "Users can view their own assignments"
on public.assignments for select
using (user_id = auth.uid());

-- Admins can create assignments
create policy "Admins can create assignments"
on public.assignments for insert
with check (
    coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'email' in (
        select email from public.admin_emails
    )
);

-- Admins can update assignments
create policy "Admins can update assignments"
on public.assignments for update
using (
    coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'email' in (
        select email from public.admin_emails
    )
);

-- Users can update status of their own assignments
create policy "Users can update their assignment status"
on public.assignments for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Admins can delete assignments
create policy "Admins can delete assignments"
on public.assignments for delete
using (
    coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'email' in (
        select email from public.admin_emails
    )
);

-- Enable RLS on assignment_history table
alter table public.assignment_history enable row level security;

-- Admins can see all assignment history
create policy "Admins can view all assignment history"
on public.assignment_history for select
using (
    coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'email' in (
        select email from public.admin_emails
    )
);

-- Anyone authenticated can insert history (for audit trail)
create policy "Authenticated users can create assignment history"
on public.assignment_history for insert
with check (auth.uid() is not null);

-- Function to update assignment counts on surgery_notes
create or replace function public.update_note_assignment_counts()
returns trigger as $$
begin
    -- Update the surgery_notes table with assignment stats
    if TG_OP = 'INSERT' then
        update public.surgery_notes 
        set 
            assignment_count = assignment_count + 1,
            is_assigned = true,
            last_assigned_at = now()
        where id = NEW.note_id;
        
        -- Log the assignment creation
        insert into public.assignment_history (assignment_id, action, new_values, changed_by, reason)
        values (NEW.id, 'created', to_jsonb(NEW), NEW.assigned_by, 'Assignment created');
        
        return NEW;
    elsif TG_OP = 'UPDATE' then
        -- Log status changes
        if OLD.status != NEW.status then
            insert into public.assignment_history (assignment_id, action, old_values, new_values, changed_by, reason)
            values (NEW.id, 'status_changed', 
                   jsonb_build_object('status', OLD.status), 
                   jsonb_build_object('status', NEW.status), 
                   coalesce(NEW.assigned_by, auth.uid()), 
                   format('Status changed from %s to %s', OLD.status, NEW.status));
        end if;
        
        -- Update started_at when status changes to in_progress
        if OLD.status != 'in_progress' and NEW.status = 'in_progress' and NEW.started_at is null then
            NEW.started_at = now();
        end if;
        
        -- Update completed_at when status changes to completed
        if OLD.status != 'completed' and NEW.status = 'completed' and NEW.completed_at is null then
            NEW.completed_at = now();
        end if;
        
        return NEW;
    elsif TG_OP = 'DELETE' then
        update public.surgery_notes 
        set 
            assignment_count = greatest(assignment_count - 1, 0),
            is_assigned = case when assignment_count <= 1 then false else true end
        where id = OLD.note_id;
        
        -- Log the assignment deletion
        insert into public.assignment_history (assignment_id, action, old_values, changed_by, reason)
        values (OLD.id, 'cancelled', to_jsonb(OLD), auth.uid(), 'Assignment cancelled');
        
        return OLD;
    end if;
    
    return null;
end;
$$ language plpgsql security definer;

-- Create triggers for assignment tracking
drop trigger if exists assignments_update_counts on public.assignments;
create trigger assignments_update_counts
    after insert or update or delete on public.assignments
    for each row execute procedure public.update_note_assignment_counts();

-- Function to check for overdue assignments
create or replace function public.mark_overdue_assignments()
returns void as $$
begin
    update public.assignments 
    set status = 'overdue'
    where status in ('assigned', 'in_progress') 
      and due_date < now()
      and due_date is not null;
end;
$$ language plpgsql security definer;

-- Function to get assignment statistics for a user
create or replace function public.get_user_assignment_stats(user_uuid uuid)
returns jsonb as $$
declare
    stats jsonb;
begin
    select jsonb_build_object(
        'total', count(*),
        'assigned', count(*) filter (where status = 'assigned'),
        'in_progress', count(*) filter (where status = 'in_progress'),
        'completed', count(*) filter (where status = 'completed'),
        'overdue', count(*) filter (where status = 'overdue'),
        'avg_completion_time_hours', 
            coalesce(
                extract(epoch from avg(completed_at - started_at))/3600, 
                0
            )::numeric(10,2)
    )
    into stats
    from public.assignments 
    where user_id = user_uuid;
    
    return coalesce(stats, '{}'::jsonb);
end;
$$ language plpgsql security definer;

-- Function to get workload balance across all users
create or replace function public.get_workload_balance()
returns table (
    user_id uuid,
    user_email text,
    total_assignments bigint,
    active_assignments bigint,
    completed_assignments bigint,
    completion_rate numeric,
    avg_completion_time_hours numeric
) as $$
begin
    return query
    select 
        u.id as user_id,
        u.email as user_email,
        coalesce(a.total_assignments, 0) as total_assignments,
        coalesce(a.active_assignments, 0) as active_assignments,
        coalesce(a.completed_assignments, 0) as completed_assignments,
        case 
            when coalesce(a.total_assignments, 0) = 0 then 0
            else (coalesce(a.completed_assignments, 0)::numeric / a.total_assignments * 100)::numeric(5,2)
        end as completion_rate,
        coalesce(a.avg_completion_time_hours, 0)::numeric(10,2) as avg_completion_time_hours
    from auth.users u
    left join (
        select 
            user_id,
            count(*) as total_assignments,
            count(*) filter (where status in ('assigned', 'in_progress', 'overdue')) as active_assignments,
            count(*) filter (where status = 'completed') as completed_assignments,
            extract(epoch from avg(completed_at - started_at))/3600 as avg_completion_time_hours
        from public.assignments
        group by user_id
    ) a on u.id = a.user_id
    where exists (select 1 from public.users where email = u.email)
    order by total_assignments desc;
end;
$$ language plpgsql security definer;

-- Function for auto-assignment based on workload
create or replace function public.auto_assign_note(
    p_note_id uuid,
    p_assigned_by uuid,
    p_due_date timestamptz default null,
    p_priority integer default 1
)
returns uuid as $$
declare
    target_user_id uuid;
    assignment_id uuid;
begin
    -- Find user with least active assignments
    select u.id into target_user_id
    from auth.users u
    inner join public.users pu on u.email = pu.email
    left join (
        select user_id, count(*) as active_count
        from public.assignments 
        where status in ('assigned', 'in_progress')
        group by user_id
    ) a on u.id = a.user_id
    order by coalesce(a.active_count, 0) asc, random()
    limit 1;
    
    if target_user_id is null then
        raise exception 'No eligible users found for assignment';
    end if;
    
    -- Create the assignment
    insert into public.assignments (note_id, user_id, assigned_by, due_date, priority)
    values (p_note_id, target_user_id, p_assigned_by, p_due_date, p_priority)
    returning id into assignment_id;
    
    return assignment_id;
end;
$$ language plpgsql security definer;

-- Create view for assignment dashboard
create or replace view public.assignment_dashboard as
select 
    a.id,
    a.note_id,
    a.user_id,
    a.status,
    a.priority,
    a.assigned_at,
    a.due_date,
    a.started_at,
    a.completed_at,
    sn.title as note_title,
    sn.phase as note_phase,
    sn.complexity as note_complexity,
    u.email as assignee_email,
    pu.first_name as assignee_first_name,
    pu.last_name as assignee_last_name,
    pu.role as assignee_role,
    ab.email as assigned_by_email,
    case 
        when a.due_date is not null and a.due_date < now() and a.status not in ('completed', 'cancelled')
        then true else false 
    end as is_overdue,
    case 
        when a.completed_at is not null and a.started_at is not null
        then extract(epoch from (a.completed_at - a.started_at))/3600
        else null
    end as completion_time_hours
from public.assignments a
join public.surgery_notes sn on a.note_id = sn.id
join auth.users u on a.user_id = u.id
join public.users pu on u.email = pu.email
join auth.users ab on a.assigned_by = ab.id;

-- Grant permissions
grant select on public.assignment_dashboard to authenticated;
grant execute on function public.get_user_assignment_stats to authenticated;
grant execute on function public.get_workload_balance to authenticated;
grant execute on function public.auto_assign_note to authenticated;
grant execute on function public.mark_overdue_assignments to authenticated;

-- Add comments for documentation
comment on table public.assignments is 'Tracks assignment of surgery notes to specific graders';
comment on table public.assignment_history is 'Audit trail for assignment changes';
comment on function public.get_user_assignment_stats is 'Returns assignment statistics for a specific user';
comment on function public.get_workload_balance is 'Returns workload balance across all users';
comment on function public.auto_assign_note is 'Automatically assigns a note to the user with least workload';
comment on view public.assignment_dashboard is 'Comprehensive view of assignments with user and note details';
