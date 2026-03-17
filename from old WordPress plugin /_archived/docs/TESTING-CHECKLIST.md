# Professional Growth Module - Testing Checklist

## Build Status
✅ **React Build:** Successfully compiled with no errors
✅ **TypeScript:** All type checking passed
✅ **Code Quality:** No linting errors

---

## Pre-Deployment Checklist

### 1. WordPress Environment
- [ ] WordPress 5.8+ installed
- [ ] User roles configured (Lifeguard, Manager, Aquatic Professional, etc.)
- [ ] Plugin folder uploaded to `/wp-content/plugins/`

### 2. Plugin Activation
- [ ] Navigate to WordPress Admin → Plugins
- [ ] Activate "Mentorship Platform" plugin
- [ ] Check for any PHP errors in debug log
- [ ] Verify database tables were created:
  - `wp_pg_job_roles`
  - `wp_pg_promotion_criteria`
  - `wp_pg_user_progress`
  - `wp_pg_inservice_logs`
  - `wp_pg_inservice_attendees`
  - `wp_pg_scan_audit_logs`
  - `wp_pg_live_recognition_drill_logs`

### 3. Admin Settings Configuration
- [ ] Go to: Mentorships → Settings
- [ ] Enable "Professional Growth Module" checkbox
- [ ] Set "Required Monthly In-Service Hours" (default: 10)
- [ ] Save settings

---

## Feature Testing Guide

### Phase 1: Administrator Setup

#### Test 1: Job Roles Management
**User Role Required:** Administrator or Aquatic Professional

1. [ ] Log in as admin
2. [ ] Navigate to: Career Development (top menu)
3. [ ] Click "Role Management" in sidebar
4. [ ] Click "Add Job Role"
5. [ ] Create test roles:
   - **Lifeguard**: Tier 1, wp_role_slug: `lifeguard`
   - **Manager**: Tier 3, wp_role_slug: `manager`
   - **Administrator**: Tier 6, wp_role_slug: `administrator`
6. [ ] Verify roles appear in table
7. [ ] Test edit functionality
8. [ ] Test delete functionality (use test role only)

**Expected Result:** Roles saved successfully, table updates in real-time

#### Test 2: Promotion Criteria Setup
**Status:** Not yet implemented (coming in next phase)

---

### Phase 2: Employee Features

#### Test 3: View Promotion Progress
**User Role Required:** Any logged-in user

1. [ ] Log in as a regular employee
2. [ ] Navigate to: Career Development
3. [ ] Verify "My Promotion Progress" is the default view
4. [ ] Check role selector dropdown shows available roles
5. [ ] Select a job role to track
6. [ ] Verify dashboard shows:
   - [ ] Overall completion percentage
   - [ ] Color-coded progress indicator (Red <30%, Yellow 30-80%, Orange 81-99%, Green 100%)
   - [ ] In-service training summary (current + previous month)
   - [ ] Recent audit notifications (if any exist)
   - [ ] Promotion criteria checklist

**Expected Result:** Clean, responsive dashboard showing progress

#### Test 4: In-Service Training Summary
**Prerequisites:** Need to manually insert test data into database OR wait for training log feature

1. [ ] Verify previous month hours display correctly
2. [ ] Check if status shows "Eligible to work" (green) or "Did not meet requirement" (red)
3. [ ] Verify current month progress updates

---

### Phase 3: API Testing

#### Test 5: REST API Endpoints
**Tool:** Use browser console or Postman

Test these endpoints (replace `{site-url}` with your WordPress URL):

1. **Get Job Roles:**
   ```
   GET {site-url}/wp-json/mentorship-platform/v1/pg/job-roles
   ```
   Expected: 200 OK, JSON array of roles

2. **Get User Progress:**
   ```
   GET {site-url}/wp-json/mentorship-platform/v1/pg/progress/{user_id}
   ```
   Expected: 200 OK, JSON array of progress items

3. **Get In-Service Summary:**
   ```
   GET {site-url}/wp-json/mentorship-platform/v1/pg/inservice/summary/{user_id}
   ```
   Expected: 200 OK, JSON object with hours summary

---

## Known Limitations (Current Build)

### Not Yet Implemented:
- [ ] Promotion Criteria management UI (admins can't define requirements yet)
- [ ] Manager Team View (can't see direct reports)
- [ ] In-Service Training Log form (can't log training sessions)
- [ ] Scan Audit form (can't conduct audits)
- [ ] Live Recognition Drill form (can't log drills)
- [ ] File upload for criterion evidence
- [ ] Automatic updates from mentorship goal completion

### Workarounds for Testing:
To test the full employee dashboard, you'll need to manually insert data into the database:

```sql
-- Example: Insert a test criterion
INSERT INTO wp_pg_promotion_criteria (job_role_id, title, description, criterion_type, target_value, sort_order)
VALUES (1, 'Complete Safety Training', 'Pass all safety modules', 'checkbox', 1, 1);

-- Example: Insert progress for a user
INSERT INTO wp_pg_user_progress (user_id, criterion_id, current_value, is_completed)
VALUES (1, 1, 1, 1);
```

---

## Troubleshooting

### Build Issues
```bash
# If React build fails:
cd /home/deck/Documents/Apps/mentorship-platform
npm install
npm run build
```

### Database Issues
- Check WordPress debug log: `wp-content/debug.log`
- Verify table prefix matches your WordPress installation
- Deactivate and reactivate plugin to trigger table creation

### API Errors
- Ensure WordPress REST API is enabled
- Check for conflicts with security plugins
- Verify nonce is being passed correctly
- Check browser console for CORS errors

### UI Not Showing
- Clear browser cache
- Check if Career Development menu appears in header
- Verify module is enabled in plugin settings
- Check browser console for JavaScript errors

---

## Success Criteria

### Minimum Viable Product:
- ✅ Plugin activates without errors
- ✅ Database tables created successfully
- ✅ Career Development menu visible to logged-in users
- ✅ Job Roles can be created/edited by admins
- ✅ Employee dashboard displays correctly
- ✅ API endpoints respond with valid data

### Next Phase Requirements:
- [ ] Criteria management fully functional
- [ ] Managers can view team progress
- [ ] Training logs can be created
- [ ] Audits can be conducted and logged
- [ ] Progress updates automatically from system events

---

## Deployment Notes

1. **Backup First:** Always backup database before activating new plugins
2. **Test Environment:** Deploy to staging site first
3. **User Permissions:** Verify WordPress roles match your tier structure
4. **Module Toggle:** Module can be disabled without losing data
5. **Data Persistence:** All data stored in custom tables, survives plugin deactivation

---

## Next Development Session

Priority tasks for next session:
1. Build Promotion Criteria management UI
2. Implement Manager Team View dashboard
3. Create In-Service Training log form
4. Add Scan Audit and Live Drill forms
5. Connect automatic updates from mentorship goals

---

**Build Date:** November 5, 2025
**Version:** Professional Growth Module v1.0 (Beta)
**Status:** 50% Complete - Core infrastructure ready, forms pending
