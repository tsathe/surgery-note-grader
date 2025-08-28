# Feature Specifications

## Phase 1.1: Bulk Note Upload System

### Overview
Allow administrators to upload multiple surgery notes at once via CSV/Excel files, with validation, error handling, and progress tracking.

### User Stories
- **As an admin**, I want to upload 50+ surgery notes at once so I don't have to enter them individually
- **As an admin**, I want to see validation errors so I can fix data issues before import
- **As an admin**, I want to track upload progress so I know when large batches are complete

### Technical Requirements

#### Database Schema Changes
```sql
-- New table for tracking bulk uploads
CREATE TABLE note_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL,
    filename TEXT NOT NULL,
    total_records INTEGER,
    processed_records INTEGER DEFAULT 0,
    successful_records INTEGER DEFAULT 0,
    failed_records INTEGER DEFAULT 0,
    status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
    errors JSONB,
    uploaded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Add batch tracking to surgery_notes
ALTER TABLE surgery_notes ADD COLUMN batch_id UUID;
ALTER TABLE surgery_notes ADD COLUMN upload_source TEXT DEFAULT 'manual';
```

#### Required CSV Format
```csv
title,content,phase,patient_id,procedure_type,complexity
"Appendectomy Consult","Patient presents with...",1,"P001","General Surgery",2
```

#### API Endpoints
- `POST /api/admin/upload-notes` - Upload CSV file
- `GET /api/admin/upload-status/:batchId` - Check upload progress
- `GET /api/admin/upload-errors/:batchId` - Get validation errors

#### Components to Build
1. `BulkUploadModal` - File upload interface
2. `UploadProgressTracker` - Real-time progress display
3. `ValidationErrorsList` - Display and fix errors
4. `BatchManagementTable` - View all upload batches

### Acceptance Criteria
- [ ] Admin can select and upload CSV/Excel files
- [ ] System validates all required fields
- [ ] Progress bar shows real-time upload status
- [ ] Detailed error messages for invalid data
- [ ] Successfully uploaded notes appear in system
- [ ] Failed uploads don't corrupt existing data
- [ ] Upload history is maintained

### Testing Strategy
- Unit tests for CSV parsing logic
- Integration tests for database operations
- E2E tests for complete upload workflow
- Performance tests with large files (1000+ records)

---

## Phase 1.2: Assignment Management System

### Overview
Allow administrators to assign specific notes to specific graders, manage workloads, and track assignment status.

### User Stories
- **As an admin**, I want to assign notes to graders so I can control who evaluates what
- **As an admin**, I want to balance workloads so no grader is overwhelmed
- **As a grader**, I want to see only my assigned notes so I'm not confused

### Technical Requirements

#### Database Schema Changes
```sql
CREATE TABLE assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID REFERENCES surgery_notes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES auth.users(id),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    due_date TIMESTAMPTZ,
    status TEXT CHECK (status IN ('assigned', 'in_progress', 'completed', 'overdue')) DEFAULT 'assigned',
    priority INTEGER DEFAULT 1,
    notes TEXT,
    completed_at TIMESTAMPTZ,
    UNIQUE(note_id, user_id)
);

-- Index for performance
CREATE INDEX idx_assignments_user_status ON assignments(user_id, status);
CREATE INDEX idx_assignments_due_date ON assignments(due_date) WHERE status != 'completed';
```

#### API Endpoints
- `POST /api/admin/assignments` - Create new assignment
- `PUT /api/admin/assignments/:id` - Update assignment
- `GET /api/admin/assignments` - List all assignments (admin)
- `GET /api/grader/assignments` - List my assignments (grader)
- `POST /api/admin/assignments/bulk` - Bulk assignment creation

#### Components to Build
1. `AssignmentManager` - Main assignment interface
2. `WorkloadBalancer` - Auto-assign based on capacity
3. `AssignmentTable` - View and manage assignments
4. `GraderInbox` - Updated to show only assigned notes

### Acceptance Criteria
- [ ] Admin can assign individual notes to graders
- [ ] Admin can bulk assign notes with rules
- [ ] System prevents double assignments
- [ ] Graders see only their assigned notes
- [ ] Assignment status updates automatically
- [ ] Workload balancing suggests optimal assignments

---

*Continue adding specifications for each feature...*
