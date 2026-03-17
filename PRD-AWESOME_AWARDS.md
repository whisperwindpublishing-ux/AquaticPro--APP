# PRD: Awesome Awards Module

## Document Status: FINALIZED - Ready for Implementation
**Version:** 1.0  
**Date:** December 18, 2025  
**Author:** GitHub Copilot

---

## 1. Executive Summary

This module introduces **Awesome Awards** for the AquaticPro mentorship platform - a flexible recognition system supporting multiple custom award categories per period (weekly/monthly). It enables peer-to-peer nominations (with optional anonymity), democratic voting with visible counts, manager approval workflows, and public recognition through badges and announcements. The system integrates with the existing TaskDeck module for nomination reminders and leverages the established job role-based permission system.

---

## 2. Goals & Objectives

### Primary Goals
1. Foster a culture of peer recognition and appreciation
2. Provide transparent nomination and voting processes
3. Publicly celebrate winners with badges and announcements
4. Integrate seamlessly with existing platform features (TaskDeck, User Profiles, Job Roles)

### Success Metrics
- Nomination participation rate
- Voting engagement rate
- User satisfaction with recognition system
- Badge visibility and winner acknowledgment rates

---

## 3. Feature Requirements

### 3.1 Nomination System

#### 3.1.1 Nomination Creation
- **Who can nominate:** All users by default (configurable per job role)
- **Anonymous nominations:** Supported - nominator can choose to remain anonymous
- **Nomination form fields:**
  - Nominee (user selector from employee list)
  - Award Category (dropdown from categories defined for this period)
  - Recognition period (auto-selected based on current open period)
  - Nomination reason (BlockNote rich text editor - supports formatting, links, images)
  - Anonymous checkbox (hide nominator identity from public view)
  - Optional: Supporting evidence/attachments

#### 3.1.2 Nomination Constraints
- **No self-nominations** - Users cannot nominate themselves
- **One nomination per nominator per nominee per period per category** - Person A can nominate Person B once per category per period
- Nominations tied to specific time periods and categories
- Nominations can be edited after submission (with "edited" indicator and timestamp)

### 3.2 Voting System

#### 3.2.1 Voting Mechanics
- **Who can vote:** Configurable per job role
- One vote per user per nomination (can vote on multiple nominations)
- Voting period defined by administrators
- **Vote counts visible during voting** - Users can see current vote tallies

#### 3.2.2 Voting Display
- Show vote counts to all users with voting permission
- Real-time count updates as votes are cast
- Vote counts visible on nomination cards

### 3.3 Approval Workflow

#### 3.3.1 Standard Workflow (Nominations → Voting → Approval)
1. Nominations open for a period
2. Voting opens on submitted nominations
3. Top-voted nominee(s) presented to approvers
4. **Approver selects exactly ONE winner per category** (no ties allowed)
5. Winner declared and announcement triggered

#### 3.3.2 Direct Assignment Workflow (No Voting)
- Authorized users can directly assign winners
- System auto-creates a "nomination" record for consistency
- Same form fields as regular nominations
- Nomination marked as "Direct Assignment" and "Approved"

#### 3.3.3 Rejection Workflow
- Approvers can reject nominations with required reason
- **Rejected nominators receive one-time banner notification**
- Rejection reason stored (single text field)
- Rejected nominations visible in archive with status

### 3.4 Permission System

Using existing job role-based permission structure:

| Permission | Description | Default |
|------------|-------------|---------|
| `can_nominate` | Can submit nominations | All roles (ON) |
| `can_vote` | Can vote on nominations | None (OFF) |
| `can_approve` | Can approve winners from voted nominations | None (OFF) |
| `can_direct_assign` | Can assign winners without voting | None (OFF) |
| `can_manage_periods` | Can create/edit award periods | None (OFF) |
| `can_view_nominations` | Can view nominations table | All roles (ON) |
| `can_view_winners` | Can view winners table | All roles (ON) |
| `can_archive` | Can archive old nominations/winners | None (OFF) |

### 3.5 Award Period Management

#### 3.5.1 Period Types
- **Weekly awards:** Defined by week number and year
- **Monthly awards:** Defined by month and year

#### 3.5.2 Award Categories
- **Multiple categories per period** supported
- Custom category names (e.g., "Customer Service Star", "Team Player", "Innovation Award")
- Each category can have its own prize/description
- One winner selected per category per period

#### 3.5.3 Period Configuration
- Not every week/month requires an award
- Authorized users create "active" periods
- Each period includes:
  - Period type (Week/Month)
  - Date range
  - Categories with individual prize descriptions (BlockNote rich text - can include images, links)
  - Nomination deadline
  - Status: Draft, Open for Nominations, Pending Approval, Winner Declared, Archived
- **No separate voting deadline** - voting remains open until an approver selects a winner

### 3.6 Archiving System

- Archive old nominations and winners by period
- Archived items hidden from main views
- Separate "Archive" view for historical data
- Configurable auto-archive (e.g., archive periods older than 6 months)

### 3.7 TaskDeck Integration

#### 3.7.1 Task Card Generation
- When a new award period is opened, create **ONE shared task card**:
  - **Card Title:** "Submit nominations for Awesome Awards [Week/Month]"
  - **Visibility:** All users with `can_nominate` permission
  - **Due Date:** Nomination deadline
  - **Link:** Opens nomination form for that period
  - **One card per period** (not per user)

#### 3.7.2 Task Behavior
- Card remains visible until period closes
- Users can click through to nomination form at any time
- Card shown in shared/primary TaskDeck

### 3.8 User Profile Badges

#### 3.8.1 Badge Display Locations
- **User cards** in directories and lists
- **Full profile pages**
- Badge icon with win counter

#### 3.8.2 Badge Styling
- Gold star/trophy icon (🏆 or custom)
- Counter shows total Awesome Award wins: "🏆 x3"
- Tooltip on hover shows recent wins and categories
- Separate counters for different category types (optional)

### 3.9 Winner Announcement Banner

#### 3.9.1 Banner Behavior
- **Mandatory one-time modal/banner** on first login after winner declared
- No opt-out available
- Shows: Winner name, avatar, category, period, nomination reason
- "Congratulate" button (optional - could trigger reaction)
- Dismiss button (marks as seen)

#### 3.9.2 Rejection Banner
- **One-time banner to nominators when their nomination is rejected**
- Shows: Rejection reason, category, nominee name
- Dismiss button (marks as seen)

#### 3.9.3 Tracking
- Store user ID + announcement ID in database
- Check on login if user has unseen announcements
- Banner shown once per winner announcement
- Rejection banners shown once per rejection

### 3.10 Tables & Views

#### 3.10.1 Nominations Table
- Visible to users with `can_view_nominations` permission
- Columns: Nominee, Nominator, Period, Reason (truncated), Status, Vote Count, Actions
- Filters: Period, Status, Nominee
- Sortable columns

#### 3.10.2 Winners Table
- Visible to users with `can_view_winners` permission
- Columns: Winner, Period, Award Type, Prize, Nomination Reason, Nominated By
- Filters: Period type, Date range
- Links to full nomination details

---

## 4. Database Schema (Finalized)

### 4.1 Tables

```sql
-- Award periods (weeks/months that have awards)
wp_awesome_awards_periods (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    period_type ENUM('week', 'month') NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    nomination_deadline DATETIME,
    voting_deadline DATETIME,
    status ENUM('draft', 'nominations_open', 'voting', 'closed', 'winner_declared') DEFAULT 'draft',
    archived TINYINT(1) DEFAULT 0,
    created_by BIGINT UNSIGNED,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_dates (start_date, end_date)
)

-- Award categories (multiple per period)
wp_awesome_awards_categories (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    period_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    prize_description LONGTEXT, -- BlockNote JSON
    sort_order INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (period_id) REFERENCES wp_awesome_awards_periods(id) ON DELETE CASCADE,
    INDEX idx_period (period_id)
)

-- Nominations
wp_awesome_awards_nominations (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    period_id BIGINT UNSIGNED NOT NULL,
    category_id BIGINT UNSIGNED NOT NULL,
    nominee_id BIGINT UNSIGNED NOT NULL,
    nominator_id BIGINT UNSIGNED NOT NULL,
    reason_json LONGTEXT, -- BlockNote JSON for rich text
    reason_text TEXT, -- Plain text version for search
    is_anonymous TINYINT(1) DEFAULT 0, -- Hide nominator from public view
    is_direct_assignment TINYINT(1) DEFAULT 0,
    status ENUM('pending', 'approved', 'rejected', 'winner') DEFAULT 'pending',
    rejection_reason TEXT, -- Required when rejected
    vote_count INT DEFAULT 0, -- Cached count for performance
    edited_at DATETIME DEFAULT NULL, -- Null if never edited
    archived TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (period_id) REFERENCES wp_awesome_awards_periods(id),
    FOREIGN KEY (category_id) REFERENCES wp_awesome_awards_categories(id),
    UNIQUE KEY unique_nomination (period_id, category_id, nominee_id, nominator_id),
    INDEX idx_period (period_id),
    INDEX idx_category (category_id),
    INDEX idx_nominee (nominee_id),
    INDEX idx_status (status)
)

-- Votes
wp_awesome_awards_votes (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    nomination_id BIGINT UNSIGNED NOT NULL,
    voter_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_vote (nomination_id, voter_id),
    FOREIGN KEY (nomination_id) REFERENCES wp_awesome_awards_nominations(id) ON DELETE CASCADE,
    INDEX idx_nomination (nomination_id),
    INDEX idx_voter (voter_id)
)

-- Announcements tracking (winners and rejections)
wp_awesome_awards_announcements_seen (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    nomination_id BIGINT UNSIGNED NOT NULL, -- The winning/rejected nomination
    announcement_type ENUM('winner', 'rejection') NOT NULL,
    seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_seen (user_id, nomination_id, announcement_type),
    INDEX idx_user (user_id)
)

-- Permissions per job role
wp_awesome_awards_permissions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    job_role_id BIGINT UNSIGNED NOT NULL,
    can_nominate TINYINT(1) DEFAULT 1,
    can_vote TINYINT(1) DEFAULT 0,
    can_approve TINYINT(1) DEFAULT 0,
    can_direct_assign TINYINT(1) DEFAULT 0,
    can_manage_periods TINYINT(1) DEFAULT 0,
    can_view_nominations TINYINT(1) DEFAULT 1,
    can_view_winners TINYINT(1) DEFAULT 1,
    can_view_archives TINYINT(1) DEFAULT 1,
    can_archive TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_role (job_role_id)
)

-- TaskDeck integration tracking (one card per period)
wp_awesome_awards_taskdeck_cards (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    period_id BIGINT UNSIGNED NOT NULL,
    card_id BIGINT UNSIGNED NOT NULL, -- TaskDeck card ID
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_period (period_id),
    FOREIGN KEY (period_id) REFERENCES wp_awesome_awards_periods(id) ON DELETE CASCADE
)
```

---

## 5. UI Components (React/TypeScript)

### 5.1 New Components
- `AwesomeAwards.tsx` - Main container/dashboard
- `AwardNominationForm.tsx` - Create/edit nomination with BlockNote
- `NominationsTable.tsx` - View all nominations with vote counts
- `WinnersTable.tsx` - View all winners
- `NominationCard.tsx` - Individual nomination display with vote button
- `AwardPeriodManagement.tsx` - Admin: create/manage periods and categories
- `AwardCategoryForm.tsx` - Create/edit award categories
- `AwesomeAwardsPermissions.tsx` - Admin: manage job role permissions
- `WinnerAnnouncementModal.tsx` - One-time winner popup modal
- `RejectionNotificationBanner.tsx` - One-time rejection banner
- `AwesomeAwardBadge.tsx` - Profile/card badge component with counter

### 5.2 Modified Components
- `UserCard.tsx` / `MentorCard.tsx` - Add Awesome Award badges
- `MentorProfile.tsx` - Add Awesome Awards section with win history
- `TaskDeck.tsx` - Handle nomination task card clicks (link to form)
- `App.tsx` - Add new view routing for 'awesomeAwards' views
- `Sidebar.tsx` - Add "Awesome Awards" navigation item

---

## 6. API Endpoints (REST)

```
# Periods
GET    /awesome-awards/periods                 - List award periods (filter: active, archived)
POST   /awesome-awards/periods                 - Create period (requires can_manage_periods)
GET    /awesome-awards/periods/{id}            - Get single period with categories
PUT    /awesome-awards/periods/{id}            - Update period
DELETE /awesome-awards/periods/{id}            - Delete period (soft delete/archive)

# Categories
GET    /awesome-awards/periods/{id}/categories - List categories for period
POST   /awesome-awards/periods/{id}/categories - Create category
PUT    /awesome-awards/categories/{id}         - Update category
DELETE /awesome-awards/categories/{id}         - Delete category

# Nominations
GET    /awesome-awards/nominations             - List nominations (filters: period, category, status)
POST   /awesome-awards/nominations             - Create nomination
GET    /awesome-awards/nominations/{id}        - Get single nomination
PUT    /awesome-awards/nominations/{id}        - Update nomination (sets edited_at)
DELETE /awesome-awards/nominations/{id}        - Delete nomination

# Voting
POST   /awesome-awards/nominations/{id}/vote   - Cast vote
DELETE /awesome-awards/nominations/{id}/vote   - Remove vote
GET    /awesome-awards/nominations/{id}/voters - Get voter list (if not anonymous)

# Approval
POST   /awesome-awards/nominations/{id}/approve  - Approve as winner
POST   /awesome-awards/nominations/{id}/reject   - Reject with reason (required)

# Winners
GET    /awesome-awards/winners                 - List all winners (filters: period, category)
GET    /awesome-awards/winners/user/{id}       - Get user's win history and count

# Permissions
GET    /awesome-awards/permissions             - Get all role permissions
PUT    /awesome-awards/permissions             - Batch update permissions
GET    /awesome-awards/my-permissions          - Current user's permissions

# Announcements
GET    /awesome-awards/announcements/unseen    - Get unseen winner/rejection announcements
POST   /awesome-awards/announcements/{id}/seen - Mark announcement as seen

# Archives
POST   /awesome-awards/periods/{id}/archive    - Archive a period and its data
GET    /awesome-awards/archives                - List archived periods/nominations
```

---

## 7. Integration Points

### 7.1 Existing Systems
- **Job Roles:** Use existing `wp_pg_job_roles` for permission assignment
- **User Cache:** Leverage existing user cache service
- **BlockNote Editor:** Reuse `RichTextEditor.tsx` / `BlockEditor.tsx`
- **TaskDeck:** Create ONE shared task card per period via existing TaskDeck API
- **Notifications:** Use existing notification system for winner/rejection alerts

### 7.2 Admin Settings
- Add "Awesome Awards" toggle in WordPress admin settings
- Module disabled by default until enabled
- Settings page for default behaviors

---

## 8. Finalized Decisions Summary

| Item | Decision |
|------|----------|
| **Module Name** | Awesome Awards |
| **Multiple Categories** | Yes - custom categories per period |
| **Self-Nominations** | Not allowed |
| **Nomination Limit** | 1 per nominator per nominee per category per period |
| **Vote Visibility** | Visible during voting |
| **Multiple Winners** | No - approvers select exactly one per category |
| **TaskDeck Integration** | One shared card per period linking to nomination form |
| **Anonymous Nominations** | Optional - nominator chooses |
| **Prize/Award** | Display info only (BlockNote rich text) |
| **Nomination Editing** | Allowed with "edited" indicator |
| **Badge Locations** | User cards AND profile pages |
| **Data Import** | Not needed (fresh start) |
| **Banner Opt-out** | Not available (mandatory viewing) |
| **Archive Viewing** | All roles by default (can disable per role) |
| **Rejection Notification** | One-time banner with required reason |

---

## 9. Technical Considerations

### 9.1 Performance
- Cache user win counts with short TTL (displayed on every user card)
- Paginate large nomination/winner tables
- Denormalized `vote_count` on nominations for fast sorting
- Lazy load badge data only when user cards render

### 9.2 Security
- All endpoints require authentication
- Permission checks on every action
- Sanitize BlockNote JSON input
- Prevent vote manipulation (one vote per user per nomination)
- Validate nomination constraints server-side (no self-nom, one per period)
- Anonymous flag only hides nominator from non-admin views

### 9.3 Data Integrity
- Soft delete (archive) instead of hard delete for nominations
- Audit trail for approvals/rejections via updated_at and status changes
- Prevent duplicate nominations via unique constraint
- Cascade delete categories when period is deleted
- Store plain text version of nomination reason for search

---

## 10. Implementation Phases

### Phase 1: Core Infrastructure (Backend)
- [ ] Create database tables with migrations
- [ ] Implement permission system PHP classes
- [ ] Add "Awesome Awards" toggle to admin settings
- [ ] Create base API routes file

### Phase 2: Period & Category Management
- [ ] Period CRUD API endpoints
- [ ] Category CRUD API endpoints
- [ ] `AwardPeriodManagement.tsx` component
- [ ] `AwardCategoryForm.tsx` component

### Phase 3: Nomination System
- [ ] Nomination API endpoints
- [ ] `AwardNominationForm.tsx` with BlockNote
- [ ] `NominationsTable.tsx` component
- [ ] `NominationCard.tsx` component
- [ ] Nomination validation (no self-nom, one per period)

### Phase 4: Voting System
- [ ] Vote API endpoints
- [ ] Vote button on nomination cards
- [ ] Real-time vote count display
- [ ] Vote permission checks

### Phase 5: Approval & Winners
- [ ] Approve/Reject API endpoints
- [ ] Rejection notification system
- [ ] `WinnersTable.tsx` component
- [ ] Winner selection UI for approvers
- [ ] Direct assignment workflow

### Phase 6: Badges & Profile Integration
- [ ] `AwesomeAwardBadge.tsx` component
- [ ] Win count API endpoint
- [ ] Integrate badges into `UserCard.tsx`
- [ ] Integrate badges into `MentorProfile.tsx`

### Phase 7: Announcements & Banners
- [ ] `WinnerAnnouncementModal.tsx` component
- [ ] `RejectionNotificationBanner.tsx` component
- [ ] Unseen announcements API
- [ ] Mark as seen tracking

### Phase 8: TaskDeck Integration
- [ ] Create shared task card when period opens
- [ ] Link card to nomination form
- [ ] Track card per period

### Phase 9: Archiving & Polish
- [ ] Archive API endpoints
- [ ] Archive UI tab
- [ ] Permission management UI
- [ ] Final UI polish and testing

---

## 11. File Structure

```
includes/
  api-routes-awesome-awards.php      # All REST API routes
  class-awesome-awards.php           # Core PHP class with helpers

src/components/
  awesome-awards/
    AwesomeAwards.tsx                # Main dashboard
    AwardNominationForm.tsx          # Nomination form
    NominationsTable.tsx             # Nominations list
    NominationCard.tsx               # Single nomination display
    WinnersTable.tsx                 # Winners list
    AwardPeriodManagement.tsx        # Admin period management
    AwardCategoryForm.tsx            # Category editor
    AwesomeAwardsPermissions.tsx     # Permission management
    WinnerAnnouncementModal.tsx      # Winner popup
    RejectionNotificationBanner.tsx  # Rejection banner
    AwesomeAwardBadge.tsx            # Badge component

src/types/
  awesome-awards.ts                  # TypeScript interfaces
```

---

## 12. Acceptance Criteria

### Nomination Flow
- [ ] User can submit nomination for another user (not self)
- [ ] User sees error if trying to nominate same person twice in same category/period
- [ ] Nomination form includes BlockNote rich text editor
- [ ] Anonymous checkbox hides nominator identity
- [ ] Editing nomination shows "edited" indicator

### Voting Flow
- [ ] Users with vote permission see vote button
- [ ] Vote count visible and updates on vote
- [ ] User can remove their vote
- [ ] One vote per user per nomination enforced

### Approval Flow
- [ ] Approvers see nominations sorted by vote count
- [ ] Approvers can select exactly one winner per category
- [ ] Rejection requires reason text
- [ ] Rejected nominator sees one-time banner

### Winner Display
- [ ] Winners appear in winners table
- [ ] Winner badge appears on user cards and profiles
- [ ] Badge shows win count
- [ ] All users see one-time winner announcement modal

### TaskDeck
- [ ] One card created per open period
- [ ] Card links to nomination form
- [ ] Card visible to users with nominate permission

---

*PRD Finalized - Ready for Implementation*
