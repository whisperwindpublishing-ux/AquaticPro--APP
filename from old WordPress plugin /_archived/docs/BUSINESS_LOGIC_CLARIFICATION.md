# Business Logic Clarification: Job Roles vs Promotion Criteria

## Date: November 11, 2025

## Critical Understanding

### Job Roles
- **Job roles represent CURRENT employment positions**
- When a user is assigned a job role, they have ALREADY EARNED that position
- Job role assignment means the user is actively performing the duties of that role
- Example: If John is assigned "Head Guard", he is currently working as a Head Guard

### Promotion Criteria
- **Promotion criteria are PREREQUISITES to earn a job role**
- Criteria attached to a job role define what must be completed BEFORE promotion TO that role
- Example: Promotion criteria on "Head Guard" = steps needed to BECOME a Head Guard

## The Team Progress Page Purpose

### What It Should Show
The Team Progress page is designed for **supervisors to identify promotion candidates**.

When a supervisor clicks on a job role filter (e.g., "Head Guard"):
- **SHOW**: Users who DO NOT currently have that job role
- **PURPOSE**: See who is working toward earning that job role
- **USE CASE**: Identify employees ready for promotion

### What It Should NOT Show
- ❌ Users who already hold the selected job role
- ❌ Current job holders' ongoing performance (that's a different feature)

## Example Scenario

### Setup
- Job Role: "Head Guard"
- Promotion Criteria for Head Guard:
  1. Complete 20 hours of in-service training
  2. Pass 3 scan audits
  3. Lead 5 training sessions

### Current Assignments
- John J: Currently assigned "Junior Guard"
- Sarah M: Currently assigned "Junior Guard"
- Mike T: Currently assigned "Head Guard" (already promoted)

### Team Progress Page Behavior
When supervisor clicks "Head Guard" button:

**Should Display:**
- John J (currently Junior Guard) - 90% complete (18/20 hours, 3/3 audits, 5/5 leadership)
- Sarah M (currently Junior Guard) - 45% complete (10/20 hours, 1/3 audits, 2/5 leadership)

**Should NOT Display:**
- Mike T (already a Head Guard - promotion criteria irrelevant to him)

### Supervisor Actions
Seeing John J at 90% completion, the supervisor can:
1. Help John complete the remaining 2 hours of training
2. Prepare paperwork for John's promotion to Head Guard
3. Schedule promotion date

## Data Flow

```
User Assignment: John J → [Junior Guard]
                           ↓
              (Working toward next role)
                           ↓
Progress Tracking: → Promotion Criteria for [Head Guard]
                     - In-service hours: 18/20 ✓
                     - Scan audits: 3/3 ✓
                     - Leadership: 5/5 ✓
                           ↓
              (Supervisor reviews progress)
                           ↓
Promotion Decision: John J → [Head Guard]
```

## Implementation Requirements

### Team Progress Page - Role Filter Click
1. GET all users in the system
2. FILTER OUT users who already have the selected job role
3. For each remaining user:
   - Calculate completion % of selected role's promotion criteria
   - Display user with progress summary

### Team Progress Page - User Expansion
1. Show detailed breakdown of promotion criteria for selected role
2. Display current_value / target_value for each criterion
3. Show completion status (✓ or ✗)
4. Calculate and display overall percentage

### Database Queries
When "Head Guard" is selected:
```sql
-- Get users WITHOUT Head Guard role
SELECT u.* FROM wp_users u
LEFT JOIN wp_pg_user_job_assignments uja 
  ON u.ID = uja.user_id 
  AND uja.job_role_id = [Head Guard ID]
WHERE uja.id IS NULL

-- Get promotion criteria for Head Guard
SELECT * FROM wp_pg_promotion_criteria
WHERE job_role_id = [Head Guard ID]

-- Get each user's progress toward Head Guard criteria
SELECT * FROM wp_pg_user_progress
WHERE user_id = [User ID]
AND criterion_id IN (criteria for Head Guard)
```

## Key Insight
**Promotion criteria are a "roadmap TO a role", not "requirements WHILE IN a role".**

Once a user is promoted to a role, those promotion criteria are complete and historical. The focus shifts to the NEXT role's promotion criteria.
