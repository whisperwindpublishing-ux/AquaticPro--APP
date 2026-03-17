# AquaticPro — Complete Database Schema Reference

> Auto-extracted from the WordPress plugin codebase on 2026-03-16.
> All table names shown **without** the `{$wpdb->prefix}` (typically `wp_`).

---

## Table of Contents

1. [Custom Database Tables (65 tables)](#custom-database-tables)
   - [Daily Logs Module](#1-daily-logs-module)
   - [Permission Tables](#2-permission-tables)
   - [Reactions System](#3-reactions-system)
   - [Awesome Awards Module](#4-awesome-awards-module)
   - [Seasonal Returns & Pay Management (SRM)](#5-seasonal-returns--pay-management-srm)
   - [Professional Growth Module](#6-professional-growth-module)
   - [TaskDeck Module](#7-taskdeck-module)
   - [LMS (Learning Management System)](#8-lms-learning-management-system)
   - [Whiteboard/Lesson Builder](#9-whiteboardlesson-builder)
   - [LMS Assignments](#10-lms-assignments)
   - [LMS Auto-Assign Rules](#11-lms-auto-assign-rules)
   - [Mileage Reimbursement](#12-mileage-reimbursement)
   - [Email Composer](#13-email-composer)
   - [Certificate Tracking](#14-certificate-tracking)
   - [New Hires](#15-new-hires)
   - [Security / Audit](#16-security--audit)
   - [Dashboard](#17-dashboard)
   - [Core / Notifications](#18-core--notifications)
2. [Custom Post Types (12 CPTs)](#custom-post-types)
3. [Custom Taxonomies (3)](#custom-taxonomies)
4. [wp_options Keys (App Settings)](#wp_options-keys)

---

## Custom Database Tables

### 1. Daily Logs Module

#### `mp_time_slots`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| slug | VARCHAR(100) | NOT NULL, UNIQUE |
| label | VARCHAR(255) | NOT NULL |
| description | TEXT | |
| sort_order | INT | NOT NULL, DEFAULT 0 |
| is_active | TINYINT(1) | NOT NULL, DEFAULT 1 |
| color | VARCHAR(7) | |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Indexes:** `idx_active (is_active)`, `idx_sort (sort_order)`

---

#### `mp_daily_logs` *(referenced by indexes, created via CPT — columns managed as post meta, see CPT section)*

> Daily logs are stored as the `mp_daily_log` Custom Post Type. The table `wp_posts` is used, with meta fields in `wp_postmeta`. Performance indexes are added on: `idx_author_date (author_id, log_date)`, `idx_location (location_id)`, `idx_status (status)`.

---

#### `mp_daily_log_comments` *(referenced by performance indexes)*

> Daily log comments use WordPress native comments (`wp_comments`). Performance indexes: `idx_log_id (log_id)`, `idx_user_id (user_id)`.

---

### 2. Permission Tables

All permission tables follow a standard schema pattern (job_role_id → permission flags).

#### `mp_daily_log_permissions`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| job_role_id | BIGINT UNSIGNED | NOT NULL, UNIQUE (`unique_role`) |
| can_view | TINYINT(1) | NOT NULL, DEFAULT 1 |
| can_create | TINYINT(1) | NOT NULL, DEFAULT 0 |
| can_edit | TINYINT(1) | NOT NULL, DEFAULT 0 |
| can_delete | TINYINT(1) | NOT NULL, DEFAULT 0 |
| can_moderate_all | TINYINT(1) | NOT NULL, DEFAULT 0 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Unique Key:** `unique_role (job_role_id)`

---

#### `pg_scan_audit_permissions`
Same schema as `mp_daily_log_permissions`.

#### `pg_live_drill_permissions`
Same schema as `mp_daily_log_permissions`.

#### `pg_inservice_permissions`
Same schema as `mp_daily_log_permissions`.

#### `pg_cashier_audit_permissions`
Same schema as `mp_daily_log_permissions`.

#### `pg_instructor_evaluation_permissions`
Same schema as `mp_daily_log_permissions`.

#### `pg_lesson_management_permissions`
Same schema as `mp_daily_log_permissions`.

---

#### `pg_taskdeck_permissions`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| job_role_id | BIGINT UNSIGNED | NOT NULL, UNIQUE (`unique_role`) |
| can_view | TINYINT(1) | NOT NULL, DEFAULT 1 |
| can_view_only_assigned | TINYINT(1) | NOT NULL, DEFAULT 0 |
| can_create | TINYINT(1) | NOT NULL, DEFAULT 0 |
| can_edit | TINYINT(1) | NOT NULL, DEFAULT 0 |
| can_delete | TINYINT(1) | NOT NULL, DEFAULT 0 |
| can_moderate_all | TINYINT(1) | NOT NULL, DEFAULT 0 |
| can_manage_primary_deck | TINYINT(1) | NOT NULL, DEFAULT 0 |
| can_manage_all_primary_cards | TINYINT(1) | NOT NULL, DEFAULT 0 |
| can_create_public_decks | TINYINT(1) | NOT NULL, DEFAULT 0 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Unique Key:** `unique_role (job_role_id)`

---

#### `pg_reports_permissions`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| job_role_id | BIGINT UNSIGNED | NOT NULL, UNIQUE (`unique_role`) |
| can_view_all_records | TINYINT(1) | NOT NULL, DEFAULT 0 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Unique Key:** `unique_role (job_role_id)`

---

#### `pg_lms_permissions`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| job_role_id | BIGINT UNSIGNED | NOT NULL, UNIQUE (`unique_role`) |
| can_view_courses | TINYINT(1) | DEFAULT 1 |
| can_view_lessons | TINYINT(1) | DEFAULT 1 |
| can_create_courses | TINYINT(1) | DEFAULT 0 |
| can_edit_courses | TINYINT(1) | DEFAULT 0 |
| can_delete_courses | TINYINT(1) | DEFAULT 0 |
| can_create_lessons | TINYINT(1) | DEFAULT 0 |
| can_edit_lessons | TINYINT(1) | DEFAULT 0 |
| can_delete_lessons | TINYINT(1) | DEFAULT 0 |
| can_manage_hotspots | TINYINT(1) | DEFAULT 0 |
| can_manage_excalidraw | TINYINT(1) | DEFAULT 0 |
| can_moderate_all | TINYINT(1) | DEFAULT 0 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Unique Key:** `unique_role (job_role_id)`, **Index:** `idx_job_role (job_role_id)`

---

#### `pg_email_permissions`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| job_role_id | BIGINT UNSIGNED | NOT NULL, UNIQUE (`unique_role`) |
| can_send_email | TINYINT(1) | DEFAULT 0 |
| can_manage_templates | TINYINT(1) | DEFAULT 0 |
| can_view_history | TINYINT(1) | DEFAULT 0 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Unique Key:** `unique_role (job_role_id)`, **Index:** `idx_job_role (job_role_id)`

---

#### `srm_permissions`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| job_role_id | BIGINT UNSIGNED | NOT NULL, UNIQUE (`unique_role`) |
| srm_view_own_pay | TINYINT(1) | DEFAULT 1 |
| srm_view_all_pay | TINYINT(1) | DEFAULT 0 |
| srm_manage_pay_config | TINYINT(1) | DEFAULT 0 |
| srm_send_invites | TINYINT(1) | DEFAULT 0 |
| srm_view_responses | TINYINT(1) | DEFAULT 0 |
| srm_manage_status | TINYINT(1) | DEFAULT 0 |
| srm_manage_templates | TINYINT(1) | DEFAULT 0 |
| srm_view_retention | TINYINT(1) | DEFAULT 0 |
| srm_bulk_actions | TINYINT(1) | DEFAULT 0 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Unique Key:** `unique_role (job_role_id)`

---

#### `awesome_awards_permissions`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| job_role_id | BIGINT UNSIGNED | NOT NULL, UNIQUE (`unique_role`) |
| can_nominate | TINYINT(1) | DEFAULT 1 |
| can_vote | TINYINT(1) | DEFAULT 0 |
| can_approve | TINYINT(1) | DEFAULT 0 |
| can_direct_assign | TINYINT(1) | DEFAULT 0 |
| can_manage_periods | TINYINT(1) | DEFAULT 0 |
| can_view_nominations | TINYINT(1) | DEFAULT 1 |
| can_view_winners | TINYINT(1) | DEFAULT 1 |
| can_view_archives | TINYINT(1) | DEFAULT 1 |
| can_archive | TINYINT(1) | DEFAULT 0 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Unique Key:** `unique_role (job_role_id)`

---

#### `mp_mileage_permissions`
| Column | Type | Constraints |
|---|---|---|
| id | INT UNSIGNED | PK, AUTO_INCREMENT |
| job_role_id | INT UNSIGNED | NOT NULL, UNIQUE |
| can_submit | TINYINT(1) | DEFAULT 1 |
| can_view_all | TINYINT(1) | DEFAULT 0 |
| can_manage | TINYINT(1) | DEFAULT 0 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

---

#### `aquaticpro_cert_permissions`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT(20) UNSIGNED | PK, AUTO_INCREMENT |
| job_role_id | BIGINT(20) UNSIGNED | NOT NULL, UNIQUE (`idx_role`) |
| can_view_all | TINYINT(1) | DEFAULT 0 |
| can_edit_records | TINYINT(1) | DEFAULT 0 |
| can_manage_types | TINYINT(1) | DEFAULT 0 |
| can_approve_uploads | TINYINT(1) | DEFAULT 0 |
| can_bulk_edit | TINYINT(1) | DEFAULT 0 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Unique Key:** `idx_role (job_role_id)`

---

### 3. Reactions System

#### `mp_daily_log_reactions` *(legacy — migrated to unified)*
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| log_id | BIGINT UNSIGNED | NOT NULL |
| user_id | BIGINT UNSIGNED | NOT NULL |
| reaction_type | VARCHAR(20) | NOT NULL |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

**Unique Key:** `unique_user_log (user_id, log_id)`
**Indexes:** `idx_log (log_id)`, `idx_user (user_id)`, `idx_log_user (log_id, user_id)`

---

#### `mp_comment_reactions` *(legacy — migrated to unified)*
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| comment_id | BIGINT UNSIGNED | NOT NULL |
| user_id | BIGINT UNSIGNED | NOT NULL |
| reaction_type | VARCHAR(20) | NOT NULL |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

**Unique Key:** `unique_user_comment (user_id, comment_id)`
**Indexes:** `idx_comment (comment_id)`, `idx_user (user_id)`

---

#### `aqp_unified_reactions`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| object_id | BIGINT UNSIGNED | NOT NULL |
| object_type | VARCHAR(50) | NOT NULL — e.g. 'daily_log', 'card_comment' |
| user_id | BIGINT UNSIGNED | NOT NULL |
| reaction_type | VARCHAR(20) | NOT NULL |
| item_author_id | BIGINT UNSIGNED | NOT NULL, DEFAULT 0 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Unique Key:** `unique_user_reaction (user_id, object_id, object_type)`
**Indexes:** `idx_object (object_id, object_type)`, `idx_user (user_id)`, `idx_item_author (item_author_id)`

---

#### `aqp_card_comment_reactions` *(legacy — migrated to unified)*
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT(20) UNSIGNED | PK, AUTO_INCREMENT |
| comment_id | BIGINT(20) UNSIGNED | NOT NULL |
| user_id | BIGINT(20) UNSIGNED | NOT NULL |
| reaction_type | VARCHAR(20) | NOT NULL |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

**Unique Key:** `unique_user_comment (user_id, comment_id)`
**Indexes:** `idx_comment (comment_id)`, `idx_user (user_id)`

---

### 4. Awesome Awards Module

#### `awesome_awards_periods`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| name | VARCHAR(255) | |
| period_type | ENUM('week','month') | NOT NULL |
| start_date | DATE | NOT NULL |
| end_date | DATE | NOT NULL |
| voting_start | DATE | |
| voting_end | DATE | |
| nomination_deadline | DATETIME | |
| status | VARCHAR(50) | DEFAULT 'draft' |
| archived | TINYINT(1) | DEFAULT 0 |
| max_winners | INT | DEFAULT 1 |
| allow_pre_voting | TINYINT(1) | DEFAULT 0 |
| created_by | BIGINT UNSIGNED | |
| tasklist_id | BIGINT UNSIGNED | |
| taskdeck_enabled | TINYINT(1) | DEFAULT 0 |
| nomination_reminder_roles | TEXT | |
| voting_reminder_roles | TEXT | |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Indexes:** `idx_status (status)`, `idx_dates (start_date, end_date)`, `idx_archived (archived)`

---

#### `awesome_awards_categories`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| period_id | BIGINT UNSIGNED | NOT NULL |
| name | VARCHAR(255) | NOT NULL |
| description | TEXT | |
| prize_description | LONGTEXT | |
| sort_order | INT | DEFAULT 0 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Indexes:** `idx_period (period_id)`

---

#### `awesome_awards_nominations`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| period_id | BIGINT UNSIGNED | NOT NULL |
| category_id | BIGINT UNSIGNED | DEFAULT 0 |
| category | VARCHAR(255) | DEFAULT '' |
| nominee_id | BIGINT UNSIGNED | NOT NULL |
| nominator_id | BIGINT UNSIGNED | NOT NULL |
| reason | TEXT | |
| reason_json | LONGTEXT | |
| reason_text | TEXT | |
| is_anonymous | TINYINT(1) | DEFAULT 0 |
| is_direct_assignment | TINYINT(1) | DEFAULT 0 |
| is_winner | TINYINT(1) | DEFAULT 0 |
| status | VARCHAR(50) | DEFAULT 'pending' |
| rejection_reason | TEXT | |
| vote_count | INT | DEFAULT 0 |
| edited_at | DATETIME | DEFAULT NULL |
| archived | TINYINT(1) | DEFAULT 0 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Indexes:** `idx_period`, `idx_category`, `idx_nominee`, `idx_nominator`, `idx_status`, `idx_winner`, `idx_archived`

---

#### `awesome_awards_votes`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| nomination_id | BIGINT UNSIGNED | NOT NULL |
| voter_id | BIGINT UNSIGNED | NOT NULL |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

**Unique Key:** `unique_vote (nomination_id, voter_id)`
**Indexes:** `idx_nomination`, `idx_voter`

---

#### `awesome_awards_announcements_seen`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| user_id | BIGINT UNSIGNED | NOT NULL |
| nomination_id | BIGINT UNSIGNED | NOT NULL |
| announcement_type | ENUM('winner','rejection') | NOT NULL |
| seen_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

**Unique Key:** `unique_seen (user_id, nomination_id, announcement_type)`
**Indexes:** `idx_user`, `idx_nomination`

---

#### `awesome_awards_taskdeck_cards`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| period_id | BIGINT UNSIGNED | NOT NULL |
| card_type | ENUM('nomination','voting') | NOT NULL, DEFAULT 'nomination' |
| card_id | BIGINT UNSIGNED | NOT NULL |
| assigned_roles | TEXT | |
| is_completed | TINYINT(1) | DEFAULT 0 |
| completed_at | DATETIME | |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

**Unique Key:** `unique_period_type (period_id, card_type)`
**Indexes:** `idx_card`, `idx_completed`

---

### 5. Seasonal Returns & Pay Management (SRM)

#### `srm_pay_config`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| config_type | ENUM('base_rate','role_bonus','longevity_tier','time_bonus','pay_cap') | NOT NULL |
| name | VARCHAR(255) | NOT NULL |
| amount | DECIMAL(10,2) | NOT NULL, DEFAULT 0.00 |
| job_role_id | BIGINT UNSIGNED | NULL |
| longevity_years | INT | NULL |
| start_date | DATE | NULL |
| end_date | DATE | NULL |
| expiration_date | DATE | NULL |
| is_recurring | TINYINT(1) | DEFAULT 0 |
| is_active | TINYINT(1) | DEFAULT 1 |
| effective_date | DATE | NOT NULL |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Indexes:** `idx_type`, `idx_active`, `idx_job_role`, `idx_effective`, `idx_expiration`

---

#### `srm_seasons`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| name | VARCHAR(255) | NOT NULL |
| year | INT | NOT NULL |
| season_type | VARCHAR(50) | DEFAULT 'summer' |
| start_date | DATE | NOT NULL |
| end_date | DATE | NOT NULL |
| is_active | TINYINT(1) | DEFAULT 0 |
| is_current | TINYINT(1) | DEFAULT 0 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Indexes:** `idx_active`, `idx_current`, `idx_year`, `idx_dates (start_date, end_date)`

---

#### `srm_employee_seasons`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| user_id | BIGINT UNSIGNED | NOT NULL |
| season_id | BIGINT UNSIGNED | NOT NULL |
| status | ENUM('pending','returning','not_returning','ineligible') | DEFAULT 'pending' |
| eligible_for_rehire | TINYINT(1) | DEFAULT 1 |
| is_archived | TINYINT(1) | DEFAULT 0 |
| is_new_hire | TINYINT(1) | DEFAULT 0 |
| return_token | VARCHAR(64) | NULL |
| token_expires_at | DATETIME | NULL |
| response_date | DATETIME | NULL |
| signature_text | VARCHAR(255) | NULL |
| comments | TEXT | NULL |
| longevity_years | INT | DEFAULT 0 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Unique Key:** `unique_user_season (user_id, season_id)`
**Indexes:** `idx_user`, `idx_season`, `idx_status`, `idx_token`, `idx_eligible`, `idx_archived`, `idx_updated_at`

---

#### `srm_email_templates`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| name | VARCHAR(255) | NOT NULL |
| subject | VARCHAR(255) | NOT NULL |
| body_html | LONGTEXT | NOT NULL |
| body_json | LONGTEXT | NULL |
| template_type | ENUM('initial_invite','follow_up','confirmation','custom') | DEFAULT 'custom' |
| is_default | TINYINT(1) | DEFAULT 0 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Indexes:** `idx_type`, `idx_default`

---

#### `srm_email_log`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| user_id | BIGINT UNSIGNED | NOT NULL |
| season_id | BIGINT UNSIGNED | NOT NULL |
| template_id | BIGINT UNSIGNED | NULL |
| email_type | ENUM('initial','follow_up_1','follow_up_2','follow_up_3','custom') | DEFAULT 'initial' |
| sent_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| opened_at | DATETIME | NULL |
| clicked_at | DATETIME | NULL |
| sent_by | BIGINT UNSIGNED | NOT NULL |

**Indexes:** `idx_user`, `idx_season`, `idx_sent_at`

---

#### `srm_retention_stats`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| season_id | BIGINT UNSIGNED | NOT NULL |
| total_eligible | INT | DEFAULT 0 |
| total_invited | INT | DEFAULT 0 |
| total_returning | INT | DEFAULT 0 |
| total_not_returning | INT | DEFAULT 0 |
| total_pending | INT | DEFAULT 0 |
| total_ineligible | INT | DEFAULT 0 |
| total_new_hires | INT | DEFAULT 0 |
| retention_rate | DECIMAL(5,2) | DEFAULT 0.00 |
| calculated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

**Indexes:** `idx_season`, `idx_calculated`

---

#### `srm_longevity_rates`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| work_year | INT | NOT NULL, UNIQUE (`unique_year`) |
| rate | DECIMAL(10,2) | NOT NULL |
| notes | TEXT | NULL |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Unique Key:** `unique_year (work_year)`, **Index:** `idx_year`

---

#### `srm_employee_work_years`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| user_id | BIGINT UNSIGNED | NOT NULL |
| work_year | INT | NOT NULL |
| verified | TINYINT(1) | DEFAULT 0 |
| verified_by | BIGINT UNSIGNED | NULL |
| verified_at | DATETIME | NULL |
| notes | TEXT | NULL |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Unique Key:** `unique_user_year (user_id, work_year)`
**Indexes:** `idx_user`, `idx_year`, `idx_verified`

---

#### `srm_pay_cache`
| Column | Type | Constraints |
|---|---|---|
| user_id | BIGINT UNSIGNED | **PK** |
| pay_data | LONGTEXT | NOT NULL — JSON-encoded current pay breakdown |
| projected_data | LONGTEXT | NULL — JSON-encoded projected pay for next season |
| calculated_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

**Index:** `idx_calculated (calculated_at)`

---

### 6. Professional Growth Module

#### `pg_job_roles`
| Column | Type | Constraints |
|---|---|---|
| id | mediumint(9) | PK, AUTO_INCREMENT |
| title | varchar(100) | NOT NULL |
| tier | tinyint(2) | NOT NULL |
| description | text | |
| inservice_hours | decimal(4,2) | NOT NULL, DEFAULT 4.00 |
| created_at | datetime | DEFAULT CURRENT_TIMESTAMP |
| updated_at | datetime | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Index:** `tier (tier)`

---

#### `pg_locations`
| Column | Type | Constraints |
|---|---|---|
| id | mediumint(9) | PK, AUTO_INCREMENT |
| name | varchar(100) | NOT NULL, UNIQUE |
| description | text | |
| sort_order | int(11) | NOT NULL, DEFAULT 0 |
| is_active | tinyint(1) | NOT NULL, DEFAULT 1 |
| created_at | datetime | DEFAULT CURRENT_TIMESTAMP |
| updated_at | datetime | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Unique Key:** `name (name)`
**Indexes:** `is_active`, `sort_order`

---

#### `pg_user_job_assignments`
| Column | Type | Constraints |
|---|---|---|
| id | mediumint(9) | PK, AUTO_INCREMENT |
| user_id | bigint(20) | NOT NULL |
| job_role_id | mediumint(9) | NOT NULL |
| assigned_by | bigint(20) | |
| assigned_date | datetime | DEFAULT CURRENT_TIMESTAMP |
| sync_wp_role | tinyint(1) | DEFAULT 1 |
| notes | text | |
| created_at | datetime | DEFAULT CURRENT_TIMESTAMP |
| updated_at | datetime | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Unique Key:** `user_job (user_id, job_role_id)`
**Indexes:** `user_id`, `job_role_id`, `assigned_by`, `idx_user_primary (user_id, is_primary)`, `idx_role_primary (job_role_id, is_primary)`

---

#### `pg_user_metadata`
| Column | Type | Constraints |
|---|---|---|
| user_id | bigint(20) | **PK** |
| phone_number | varchar(20) | |
| employee_id | varchar(50) | |
| hire_date | date | |
| notes | longtext | |
| eligible_for_rehire | tinyint(1) | DEFAULT 1 |
| is_member | tinyint(1) | DEFAULT NULL |
| archived | tinyint(1) | NOT NULL, DEFAULT 0 |
| archived_date | datetime | |
| archived_by | bigint(20) | |
| created_at | datetime | DEFAULT CURRENT_TIMESTAMP |
| updated_at | datetime | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Indexes:** `archived`, `is_member`, `hire_date`, `employee_id`

---

#### `pg_promotion_criteria`
| Column | Type | Constraints |
|---|---|---|
| id | mediumint(9) | PK, AUTO_INCREMENT |
| job_role_id | mediumint(9) | NOT NULL |
| title | varchar(255) | NOT NULL |
| description | text | |
| criterion_type | varchar(50) | NOT NULL |
| target_value | int(11) | DEFAULT 1 |
| linked_module | varchar(50) | |
| sort_order | int(11) | DEFAULT 0 |
| is_required | tinyint(1) | DEFAULT 1 |
| created_at | datetime | DEFAULT CURRENT_TIMESTAMP |
| updated_at | datetime | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Index:** `job_role_id`

---

#### `pg_user_progress`
| Column | Type | Constraints |
|---|---|---|
| id | mediumint(9) | PK, AUTO_INCREMENT |
| user_id | bigint(20) | NOT NULL |
| criterion_id | mediumint(9) | NOT NULL |
| current_value | int(11) | DEFAULT 0 |
| is_completed | tinyint(1) | DEFAULT 0 |
| completion_date | datetime | |
| approved_by | bigint(20) | |
| notes | text | |
| file_url | varchar(255) | |
| created_at | datetime | DEFAULT CURRENT_TIMESTAMP |
| updated_at | datetime | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Unique Key:** `user_criterion (user_id, criterion_id)`
**Indexes:** `user_id`, `criterion_id`

---

#### `pg_criterion_activities`
| Column | Type | Constraints |
|---|---|---|
| id | bigint(20) | PK, AUTO_INCREMENT |
| criterion_id | mediumint(9) | NOT NULL |
| user_id | bigint(20) | NOT NULL |
| affected_user_id | bigint(20) | NOT NULL |
| user_job_role_id | mediumint(9) | |
| activity_type | varchar(50) | NOT NULL |
| content | text | |
| old_value | varchar(255) | |
| new_value | varchar(255) | |
| created_at | datetime | DEFAULT CURRENT_TIMESTAMP |
| edited_at | datetime | |
| edited_by | bigint(20) | |

**Indexes:** `criterion_id`, `user_id`, `affected_user_id`, `created_at`

---

#### `pg_inservice_logs`
| Column | Type | Constraints |
|---|---|---|
| id | mediumint(9) | PK, AUTO_INCREMENT |
| training_date | date | NOT NULL |
| training_time | time | |
| location | varchar(255) | |
| duration_hours | decimal(4,2) | NOT NULL |
| topic | varchar(255) | NOT NULL |
| details | longtext | |
| archived | tinyint(1) | NOT NULL, DEFAULT 0 |
| created_by | bigint(20) | NOT NULL |
| created_at | datetime | DEFAULT CURRENT_TIMESTAMP |
| updated_at | datetime | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Indexes:** `training_date`, `created_by`, `archived`, `idx_user_date (created_by, training_date)`, `idx_archived_date (archived, training_date)`

---

#### `pg_inservice_attendees`
| Column | Type | Constraints |
|---|---|---|
| id | mediumint(9) | PK, AUTO_INCREMENT |
| inservice_id | mediumint(9) | NOT NULL |
| user_id | bigint(20) | NOT NULL |
| attendance_status | varchar(20) | NOT NULL |
| created_at | datetime | DEFAULT CURRENT_TIMESTAMP |

**Unique Key:** `inservice_user (inservice_id, user_id)`
**Indexes:** `inservice_id`, `user_id`, `idx_attendance_status (attendance_status)`

---

#### `pg_inservice_job_roles`
| Column | Type | Constraints |
|---|---|---|
| id | mediumint(9) | PK, AUTO_INCREMENT |
| inservice_id | mediumint(9) | NOT NULL |
| job_role_id | mediumint(9) | NOT NULL |
| created_at | datetime | DEFAULT CURRENT_TIMESTAMP |

**Unique Key:** `inservice_job (inservice_id, job_role_id)`
**Indexes:** `inservice_id`, `job_role_id`

---

#### `pg_inservice_cache`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| user_id | BIGINT UNSIGNED | NOT NULL |
| month | VARCHAR(7) | NOT NULL — Format: YYYY-MM |
| total_hours | DECIMAL(5,2) | NOT NULL, DEFAULT 0 |
| required_hours | DECIMAL(5,2) | NOT NULL, DEFAULT 4 |
| meets_requirement | TINYINT(1) | NOT NULL, DEFAULT 0 |
| training_count | INT | NOT NULL, DEFAULT 0 |
| calculated_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

**Unique Key:** `uk_user_month (user_id, month)`
**Indexes:** `idx_month`, `idx_calculated`

---

#### `pg_scan_audit_logs`
| Column | Type | Constraints |
|---|---|---|
| id | mediumint(9) | PK, AUTO_INCREMENT |
| audited_user_id | bigint(20) | NOT NULL |
| auditor_id | bigint(20) | NOT NULL |
| audit_date | datetime | NOT NULL |
| location | varchar(255) | |
| result | varchar(20) | NOT NULL |
| notes | text | |
| wearing_correct_uniform | tinyint(1) | DEFAULT NULL |
| attentive_to_zone | tinyint(1) | DEFAULT NULL |
| posture_adjustment_5min | tinyint(1) | DEFAULT NULL |
| attachments | longtext | |
| archived | tinyint(1) | NOT NULL, DEFAULT 0 |
| created_at | datetime | DEFAULT CURRENT_TIMESTAMP |
| updated_at | datetime | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Indexes:** `audited_user_id`, `auditor_id`, `audit_date`, `archived`

---

#### `pg_cashier_audit_logs`
| Column | Type | Constraints |
|---|---|---|
| id | mediumint(9) | PK, AUTO_INCREMENT |
| audited_user_id | bigint(20) | NOT NULL |
| auditor_id | bigint(20) | NOT NULL |
| audit_date | datetime | NOT NULL |
| checked_cash_drawer | varchar(20) | DEFAULT NULL |
| attentive_patrons_entered | varchar(20) | DEFAULT NULL |
| greeted_with_demeanor | varchar(20) | DEFAULT NULL |
| one_click_per_person | varchar(20) | DEFAULT NULL |
| pool_pass_process | varchar(20) | DEFAULT NULL |
| resolved_patron_concerns | text | |
| notes | text | |
| archived | tinyint(1) | NOT NULL, DEFAULT 0 |
| created_at | datetime | DEFAULT CURRENT_TIMESTAMP |
| updated_at | datetime | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Indexes:** `audited_user_id`, `auditor_id`, `audit_date`, `archived`

---

#### `pg_live_recognition_drill_logs`
| Column | Type | Constraints |
|---|---|---|
| id | mediumint(9) | PK, AUTO_INCREMENT |
| drilled_user_id | bigint(20) | NOT NULL |
| drill_conductor_id | bigint(20) | NOT NULL |
| drill_date | datetime | NOT NULL |
| location | varchar(255) | |
| result | varchar(50) | NOT NULL |
| notes | text | |
| archived | tinyint(1) | NOT NULL, DEFAULT 0 |
| created_at | datetime | DEFAULT CURRENT_TIMESTAMP |
| updated_at | datetime | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Indexes:** `drilled_user_id`, `drill_conductor_id`, `drill_date`, `archived`

---

#### `pg_instructor_evaluation_logs`
| Column | Type | Constraints |
|---|---|---|
| id | mediumint(9) | PK, AUTO_INCREMENT |
| evaluated_user_id | bigint(20) | NOT NULL |
| evaluator_id | bigint(20) | NOT NULL |
| evaluation_date | datetime | NOT NULL |
| command_language | tinyint(1) | DEFAULT NULL |
| minimizing_downtime | tinyint(1) | DEFAULT NULL |
| periodic_challenges | tinyint(1) | DEFAULT NULL |
| provides_feedback | tinyint(1) | DEFAULT NULL |
| rules_expectations | tinyint(1) | DEFAULT NULL |
| learning_environment | tinyint(1) | DEFAULT NULL |
| comments | text | NOT NULL |
| archived | tinyint(1) | NOT NULL, DEFAULT 0 |
| created_at | datetime | DEFAULT CURRENT_TIMESTAMP |
| updated_at | datetime | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Indexes:** `evaluated_user_id`, `evaluator_id`, `evaluation_date`, `archived`

---

### 7. TaskDeck Module

#### `aqp_taskdecks`
| Column | Type | Constraints |
|---|---|---|
| deck_id | bigint(20) UNSIGNED | PK, AUTO_INCREMENT |
| deck_name | varchar(255) | NOT NULL |
| deck_description | text | |
| created_by | bigint(20) UNSIGNED | NOT NULL |
| is_public | tinyint(1) | NOT NULL, DEFAULT 0 |
| is_primary | tinyint(1) | NOT NULL, DEFAULT 0 |
| created_at | datetime | DEFAULT CURRENT_TIMESTAMP |
| updated_at | datetime | DEFAULT CURRENT_TIMESTAMP ON UPDATE |
| is_archived | tinyint(1) | NOT NULL, DEFAULT 0 |

**Indexes:** `created_by`, `is_archived`, `is_public`, `is_primary`

---

#### `aqp_tasklists`
| Column | Type | Constraints |
|---|---|---|
| list_id | bigint(20) UNSIGNED | PK, AUTO_INCREMENT |
| deck_id | bigint(20) UNSIGNED | NOT NULL |
| list_name | varchar(255) | NOT NULL |
| sort_order | int(11) | NOT NULL, DEFAULT 0 |
| created_at | datetime | DEFAULT CURRENT_TIMESTAMP |

**Indexes:** `deck_id`, `sort_order`, `idx_deck_sort (deck_id, sort_order)`

---

#### `aqp_taskcards`
| Column | Type | Constraints |
|---|---|---|
| card_id | bigint(20) UNSIGNED | PK, AUTO_INCREMENT |
| list_id | bigint(20) UNSIGNED | NOT NULL |
| title | varchar(500) | NOT NULL |
| description | text | |
| action_url | VARCHAR(500) | DEFAULT NULL |
| created_by | bigint(20) UNSIGNED | NOT NULL |
| assigned_to | bigint(20) UNSIGNED | DEFAULT NULL |
| assigned_to_role_id | bigint(20) UNSIGNED | DEFAULT NULL |
| location_id | bigint(20) UNSIGNED | DEFAULT NULL |
| due_date | datetime | DEFAULT NULL |
| category_tag | varchar(100) | DEFAULT NULL |
| accent_color | varchar(7) | DEFAULT NULL |
| is_complete | tinyint(1) | NOT NULL, DEFAULT 0 |
| sort_order | int(11) | NOT NULL, DEFAULT 0 |
| created_at | datetime | DEFAULT CURRENT_TIMESTAMP |
| updated_at | datetime | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Indexes:** `list_id`, `created_by`, `assigned_to`, `assigned_to_role_id`, `location_id`, `sort_order`, `is_complete`, `idx_list_complete (list_id, is_complete)`, `idx_list_sort (list_id, sort_order)`, `idx_complete_updated (is_complete, updated_at)`

---

#### `aqp_card_assignees`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| card_id | BIGINT UNSIGNED | NOT NULL |
| user_id | BIGINT UNSIGNED | NOT NULL |
| assigned_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| assigned_by | BIGINT UNSIGNED | |

**Unique Key:** `unique_card_user (card_id, user_id)`
**Indexes:** `idx_card`, `idx_user`, `idx_user_card (user_id, card_id)`

---

#### `aqp_card_assigned_roles`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| card_id | BIGINT UNSIGNED | NOT NULL |
| role_id | BIGINT UNSIGNED | NOT NULL |
| assigned_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| assigned_by | BIGINT UNSIGNED | |

**Unique Key:** `unique_card_role (card_id, role_id)`
**Indexes:** `idx_card`, `idx_role`, `idx_role_card (role_id, card_id)`

---

#### `aqp_card_comments`
| Column | Type | Constraints |
|---|---|---|
| comment_id | bigint(20) UNSIGNED | PK, AUTO_INCREMENT |
| card_id | bigint(20) UNSIGNED | NOT NULL |
| user_id | bigint(20) UNSIGNED | NOT NULL |
| comment_text | text | NOT NULL |
| created_at | datetime | DEFAULT CURRENT_TIMESTAMP |

**Indexes:** `card_id`, `user_id`

---

#### `aqp_card_attachments`
| Column | Type | Constraints |
|---|---|---|
| attachment_id | bigint(20) UNSIGNED | PK, AUTO_INCREMENT |
| card_id | bigint(20) UNSIGNED | NOT NULL |
| user_id | bigint(20) UNSIGNED | NOT NULL |
| file_name | varchar(255) | NOT NULL |
| wp_attachment_id | bigint(20) UNSIGNED | NOT NULL |
| uploaded_at | datetime | DEFAULT CURRENT_TIMESTAMP |

**Indexes:** `card_id`, `user_id`, `wp_attachment_id`

---

#### `aqp_card_checklists`
| Column | Type | Constraints |
|---|---|---|
| checklist_id | bigint(20) UNSIGNED | PK, AUTO_INCREMENT |
| card_id | bigint(20) UNSIGNED | NOT NULL |
| item_text | varchar(500) | NOT NULL |
| is_complete | tinyint(1) | NOT NULL, DEFAULT 0 |
| sort_order | int(11) | NOT NULL, DEFAULT 0 |
| created_at | datetime | DEFAULT CURRENT_TIMESTAMP |

**Indexes:** `card_id`, `sort_order`

---

#### `aqp_activity_log`
| Column | Type | Constraints |
|---|---|---|
| log_id | bigint(20) UNSIGNED | PK, AUTO_INCREMENT |
| card_id | bigint(20) UNSIGNED | NOT NULL |
| user_id | bigint(20) UNSIGNED | NOT NULL |
| action | varchar(500) | NOT NULL |
| created_at | datetime | DEFAULT CURRENT_TIMESTAMP |

**Indexes:** `card_id`, `user_id`, `created_at`

---

### 8. LMS (Learning Management System)

#### `aquaticpro_courses`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT(20) UNSIGNED | PK, AUTO_INCREMENT |
| title | VARCHAR(255) | NOT NULL |
| description | TEXT | |
| featured_image | TEXT | |
| category | VARCHAR(100) | DEFAULT NULL |
| is_sequential | TINYINT(1) | DEFAULT 0 |
| status | ENUM('draft','published','archived') | DEFAULT 'draft' |
| display_order | INT | DEFAULT 0 |
| created_by | BIGINT(20) UNSIGNED | NOT NULL |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Indexes:** `idx_status`, `idx_display_order`, `idx_category`

---

#### `aquaticpro_lessons`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT(20) UNSIGNED | PK, AUTO_INCREMENT |
| course_id | BIGINT(20) UNSIGNED | NOT NULL |
| section_id | BIGINT(20) UNSIGNED | DEFAULT NULL |
| title | VARCHAR(255) | NOT NULL |
| description | TEXT | |
| content | LONGTEXT | |
| lesson_type | ENUM('content','excalidraw','hybrid','quiz') | DEFAULT 'content' |
| featured_image | TEXT | |
| excalidraw_json | LONGTEXT | |
| scroll_cues | LONGTEXT | |
| slide_order | LONGTEXT | |
| hybrid_layout | VARCHAR(20) | DEFAULT 'text-left' |
| split_ratio | FLOAT | DEFAULT 0.4 |
| estimated_time | VARCHAR(50) | |
| display_order | INT | DEFAULT 0 |
| created_by | BIGINT(20) UNSIGNED | NOT NULL |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Indexes:** `idx_course_id`, `idx_section_id`, `idx_display_order`

---

#### `aquaticpro_lesson_sections`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT(20) UNSIGNED | PK, AUTO_INCREMENT |
| course_id | BIGINT(20) UNSIGNED | NOT NULL |
| title | VARCHAR(255) | NOT NULL |
| description | TEXT | |
| display_order | INT | DEFAULT 0 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Indexes:** `idx_course_id`, `idx_display_order`

---

#### `aquaticpro_progress`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT(20) UNSIGNED | PK, AUTO_INCREMENT |
| user_id | BIGINT(20) UNSIGNED | NOT NULL |
| lesson_id | BIGINT(20) UNSIGNED | NOT NULL |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'not-started' |
| score | FLOAT | DEFAULT 0 |
| last_viewed | DATETIME | DEFAULT NULL |
| completed_at | DATETIME | DEFAULT NULL |
| time_spent_seconds | INT UNSIGNED | DEFAULT 0 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Unique Key:** `unique_user_lesson (user_id, lesson_id)`
**Indexes:** `idx_user_id`, `idx_lesson_id`, `idx_status`

---

#### `aquaticpro_course_categories`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT(20) UNSIGNED | PK, AUTO_INCREMENT |
| name | VARCHAR(100) | NOT NULL, UNIQUE (`unique_name`) |
| display_order | INT | DEFAULT 0 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Unique Key:** `unique_name (name)`, **Index:** `idx_display_order`

---

### 9. Whiteboard/Lesson Builder

#### `mp_wb_lesson_sections`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| lesson_id | BIGINT UNSIGNED | NOT NULL |
| section_type | ENUM('whiteboard','quiz','video','text') | NOT NULL, DEFAULT 'whiteboard' |
| title | VARCHAR(255) | NOT NULL |
| description | TEXT | |
| display_order | INT | DEFAULT 0 |
| is_required | TINYINT(1) | DEFAULT 1 |
| requires_section_id | BIGINT UNSIGNED | DEFAULT NULL |
| unlock_after_minutes | INT | DEFAULT NULL |
| video_url | TEXT | DEFAULT NULL |
| text_content | LONGTEXT | DEFAULT NULL |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Indexes:** `idx_lesson_id`, `idx_display_order`, `idx_section_type`

---

#### `mp_wb_whiteboards`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| lesson_section_id | BIGINT UNSIGNED | NOT NULL |
| title | VARCHAR(255) | DEFAULT 'Untitled' |
| data | LONGTEXT | NOT NULL |
| thumbnail_url | TEXT | DEFAULT NULL |
| display_order | INT | DEFAULT 0 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Indexes:** `idx_lesson_section_id`, `idx_display_order`

---

#### `mp_wb_quizzes`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| lesson_section_id | BIGINT UNSIGNED | NOT NULL |
| title | VARCHAR(255) | NOT NULL |
| description | TEXT | |
| time_limit_minutes | INT | DEFAULT NULL |
| passing_score | INT | DEFAULT 70 |
| max_attempts | INT | DEFAULT NULL |
| shuffle_questions | TINYINT(1) | DEFAULT 0 |
| shuffle_options | TINYINT(1) | DEFAULT 0 |
| show_correct_answers | ENUM('never','after_attempt','after_pass') | DEFAULT 'after_attempt' |
| allow_review | TINYINT(1) | DEFAULT 1 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Unique Key:** `idx_lesson_section_id (lesson_section_id)`

---

#### `mp_wb_quiz_questions`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| quiz_id | BIGINT UNSIGNED | NOT NULL |
| question_type | ENUM('multiple-choice','multiple-select','true-false','short-answer','hotspot','ordering','matching') | NOT NULL, DEFAULT 'multiple-choice' |
| question_text | TEXT | NOT NULL |
| question_image_url | TEXT | DEFAULT NULL |
| question_data | LONGTEXT | NOT NULL |
| explanation | TEXT | DEFAULT NULL |
| points | INT | DEFAULT 1 |
| display_order | INT | DEFAULT 0 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Indexes:** `idx_quiz_id`, `idx_display_order`

---

#### `mp_wb_lesson_progress`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| user_id | BIGINT UNSIGNED | NOT NULL |
| lesson_id | BIGINT UNSIGNED | NOT NULL |
| status | ENUM('not_started','in_progress','completed') | DEFAULT 'not_started' |
| current_section_id | BIGINT UNSIGNED | DEFAULT NULL |
| time_spent_seconds | INT | DEFAULT 0 |
| started_at | DATETIME | DEFAULT NULL |
| completed_at | DATETIME | DEFAULT NULL |
| last_accessed_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

**Unique Key:** `idx_user_lesson (user_id, lesson_id)`
**Indexes:** `idx_user_id`, `idx_lesson_id`, `idx_status`

---

#### `mp_wb_section_progress`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| user_id | BIGINT UNSIGNED | NOT NULL |
| lesson_section_id | BIGINT UNSIGNED | NOT NULL |
| status | ENUM('not_started','in_progress','completed','locked') | DEFAULT 'not_started' |
| time_spent_seconds | INT | DEFAULT 0 |
| completed_at | DATETIME | DEFAULT NULL |
| quiz_score | DECIMAL(5,2) | DEFAULT NULL |
| quiz_passed | TINYINT(1) | DEFAULT NULL |
| quiz_attempts | INT | DEFAULT 0 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Unique Key:** `idx_user_section (user_id, lesson_section_id)`
**Indexes:** `idx_user_id`, `idx_lesson_section_id`

---

#### `mp_wb_quiz_attempts`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| user_id | BIGINT UNSIGNED | NOT NULL |
| quiz_id | BIGINT UNSIGNED | NOT NULL |
| lesson_section_id | BIGINT UNSIGNED | NOT NULL |
| score | DECIMAL(5,2) | NOT NULL |
| total_points | INT | NOT NULL |
| percentage | DECIMAL(5,2) | NOT NULL |
| passed | TINYINT(1) | NOT NULL |
| answers | LONGTEXT | NOT NULL |
| time_taken_seconds | INT | DEFAULT 0 |
| started_at | DATETIME | NOT NULL |
| submitted_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

**Indexes:** `idx_user_id`, `idx_quiz_id`, `idx_lesson_section_id`, `idx_submitted_at`

---

### 10. LMS Assignments

#### `aquaticpro_learning_assignments`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT(20) UNSIGNED | PK, AUTO_INCREMENT |
| lesson_id | BIGINT(20) UNSIGNED | NOT NULL |
| assigned_by | BIGINT(20) UNSIGNED | NOT NULL |
| title | VARCHAR(255) | NOT NULL |
| description | TEXT | |
| due_date | DATETIME | DEFAULT NULL |
| status | VARCHAR(20) | DEFAULT 'draft' |
| taskdeck_card_id | BIGINT(20) UNSIGNED | DEFAULT NULL |
| reminder_sent_at | DATETIME | DEFAULT NULL |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Indexes:** `idx_lesson_id`, `idx_assigned_by`, `idx_status`, `idx_due_date`

---

#### `aquaticpro_learning_assignment_users`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT(20) UNSIGNED | PK, AUTO_INCREMENT |
| assignment_id | BIGINT(20) UNSIGNED | NOT NULL |
| user_id | BIGINT(20) UNSIGNED | NOT NULL |
| source | VARCHAR(20) | DEFAULT 'direct' |
| source_role_id | BIGINT(20) UNSIGNED | DEFAULT NULL |
| email_sent_at | DATETIME | DEFAULT NULL |
| email_status | VARCHAR(20) | DEFAULT 'pending' |
| reminder_sent_at | DATETIME | DEFAULT NULL |
| progress_status | VARCHAR(20) | DEFAULT 'not-started' |
| quiz_score | FLOAT | DEFAULT NULL |
| started_at | DATETIME | DEFAULT NULL |
| completed_at | DATETIME | DEFAULT NULL |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Unique Key:** `unique_assignment_user (assignment_id, user_id)`
**Indexes:** `idx_assignment_id`, `idx_user_id`, `idx_progress_status`, `idx_email_status`

---

#### `aquaticpro_email_queue`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT(20) UNSIGNED | PK, AUTO_INCREMENT |
| user_id | BIGINT(20) UNSIGNED | NOT NULL |
| email_type | VARCHAR(50) | NOT NULL |
| subject | VARCHAR(255) | NOT NULL |
| body | LONGTEXT | NOT NULL |
| context_id | BIGINT(20) UNSIGNED | DEFAULT NULL |
| status | VARCHAR(20) | DEFAULT 'pending' |
| attempts | TINYINT | DEFAULT 0 |
| sent_at | DATETIME | DEFAULT NULL |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

**Indexes:** `idx_status`, `idx_email_type`

---

### 11. LMS Auto-Assign Rules

#### `aquaticpro_course_auto_assign_rules`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT(20) UNSIGNED | PK, AUTO_INCREMENT |
| course_id | BIGINT(20) UNSIGNED | NOT NULL |
| job_role_id | BIGINT(20) UNSIGNED | NOT NULL |
| send_notification | TINYINT(1) | DEFAULT 1 |
| created_by | BIGINT(20) UNSIGNED | NOT NULL |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

**Unique Key:** `unique_course_role (course_id, job_role_id)`
**Indexes:** `idx_course_id`, `idx_job_role_id`

---

#### `aquaticpro_course_assignments`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT(20) UNSIGNED | PK, AUTO_INCREMENT |
| course_id | BIGINT(20) UNSIGNED | NOT NULL |
| user_id | BIGINT(20) UNSIGNED | NOT NULL |
| rule_id | BIGINT(20) UNSIGNED | DEFAULT NULL |
| source | VARCHAR(20) | DEFAULT 'auto' |
| source_role_id | BIGINT(20) UNSIGNED | DEFAULT NULL |
| assigned_by | BIGINT(20) UNSIGNED | DEFAULT NULL |
| status | VARCHAR(20) | DEFAULT 'assigned' |
| due_date | DATETIME | DEFAULT NULL |
| assigned_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| completed_at | DATETIME | DEFAULT NULL |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Unique Key:** `unique_course_user (course_id, user_id)`
**Indexes:** `idx_course_id`, `idx_user_id`, `idx_rule_id`, `idx_status`

---

### 12. Mileage Reimbursement

#### `mp_mileage_settings`
| Column | Type | Constraints |
|---|---|---|
| id | INT UNSIGNED | PK, AUTO_INCREMENT |
| setting_key | VARCHAR(100) | NOT NULL, UNIQUE |
| setting_value | TEXT | |
| updated_by | BIGINT UNSIGNED | |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

---

#### `mp_mileage_locations`
| Column | Type | Constraints |
|---|---|---|
| id | INT UNSIGNED | PK, AUTO_INCREMENT |
| name | VARCHAR(255) | NOT NULL |
| address | VARCHAR(500) | NOT NULL |
| latitude | DECIMAL(10,8) | |
| longitude | DECIMAL(11,8) | |
| is_active | TINYINT(1) | DEFAULT 1 |
| sort_order | INT | DEFAULT 0 |
| created_by | BIGINT UNSIGNED | |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

---

#### `mp_mileage_budget_accounts`
| Column | Type | Constraints |
|---|---|---|
| id | INT UNSIGNED | PK, AUTO_INCREMENT |
| account_code | VARCHAR(50) | NOT NULL |
| account_name | VARCHAR(255) | NOT NULL |
| is_active | TINYINT(1) | DEFAULT 1 |
| sort_order | INT | DEFAULT 0 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

---

#### `mp_mileage_entries`
| Column | Type | Constraints |
|---|---|---|
| id | INT UNSIGNED | PK, AUTO_INCREMENT |
| user_id | BIGINT UNSIGNED | NOT NULL |
| trip_date | DATE | NOT NULL |
| business_purpose | VARCHAR(500) | |
| odometer_start | INT UNSIGNED | |
| odometer_end | INT UNSIGNED | |
| calculated_miles | INT UNSIGNED | NOT NULL, DEFAULT 0 |
| route_json | TEXT | |
| tolls | DECIMAL(10,2) | DEFAULT 0.00 |
| parking | DECIMAL(10,2) | DEFAULT 0.00 |
| budget_account_id | INT UNSIGNED | |
| notes | TEXT | |
| submitted_for_payment | TINYINT(1) | DEFAULT 0 |
| submitted_at | DATETIME | DEFAULT NULL |
| submitted_by | BIGINT UNSIGNED | DEFAULT NULL |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Indexes:** `idx_user_date (user_id, trip_date)`, `idx_trip_date`, `idx_submitted`

---

#### `mp_mileage_entry_stops`
| Column | Type | Constraints |
|---|---|---|
| id | INT UNSIGNED | PK, AUTO_INCREMENT |
| entry_id | INT UNSIGNED | NOT NULL |
| stop_order | INT UNSIGNED | NOT NULL |
| location_id | INT UNSIGNED | |
| custom_address | VARCHAR(500) | |
| distance_to_next | INT UNSIGNED | DEFAULT 0 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

**Index:** `idx_entry_id (entry_id)`

---

### 13. Email Composer

#### `aquaticpro_email_composer_templates`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT(20) UNSIGNED | PK, AUTO_INCREMENT |
| name | VARCHAR(255) | NOT NULL |
| subject | VARCHAR(255) | NOT NULL, DEFAULT '' |
| body_json | LONGTEXT | |
| body_html | LONGTEXT | |
| created_by | BIGINT(20) UNSIGNED | NOT NULL |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Index:** `idx_created_by`

---

#### `aquaticpro_email_composer_log`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT(20) UNSIGNED | PK, AUTO_INCREMENT |
| subject | VARCHAR(255) | NOT NULL |
| body_html | LONGTEXT | |
| recipient_count | INT UNSIGNED | DEFAULT 0 |
| sent_by | BIGINT(20) UNSIGNED | NOT NULL |
| sent_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| recipient_summary | TEXT | |

**Indexes:** `idx_sent_by`, `idx_sent_at`

---

### 14. Certificate Tracking

#### `aquaticpro_certificate_types`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT(20) UNSIGNED | PK, AUTO_INCREMENT |
| name | VARCHAR(255) | NOT NULL |
| description | TEXT | |
| default_expiry_months | INT UNSIGNED | DEFAULT NULL (NULL = never expires) |
| training_link | VARCHAR(2083) | DEFAULT '' |
| email_alerts_enabled | TINYINT(1) | DEFAULT 0 |
| is_active | TINYINT(1) | DEFAULT 1 |
| sort_order | INT | DEFAULT 0 |
| created_by | BIGINT(20) UNSIGNED | NOT NULL |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Indexes:** `idx_active`, `idx_sort`

---

#### `aquaticpro_user_certificates`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT(20) UNSIGNED | PK, AUTO_INCREMENT |
| user_id | BIGINT(20) UNSIGNED | NOT NULL |
| certificate_type_id | BIGINT(20) UNSIGNED | NOT NULL |
| training_date | DATE | DEFAULT NULL |
| expiration_date | DATE | DEFAULT NULL (NULL = never expires) |
| file_attachment_id | BIGINT(20) UNSIGNED | DEFAULT NULL |
| file_url | VARCHAR(2083) | DEFAULT '' |
| status | VARCHAR(30) | DEFAULT 'missing' — (valid, expired, pending_review, missing) |
| notes | TEXT | |
| uploaded_by | BIGINT(20) UNSIGNED | DEFAULT NULL |
| approved_by | BIGINT(20) UNSIGNED | DEFAULT NULL |
| approved_at | DATETIME | DEFAULT NULL |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Unique Key:** `idx_user_cert (user_id, certificate_type_id)`
**Indexes:** `idx_user`, `idx_cert_type`, `idx_status`, `idx_expiry`

---

#### `aquaticpro_cert_role_requirements`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT(20) UNSIGNED | PK, AUTO_INCREMENT |
| certificate_type_id | BIGINT(20) UNSIGNED | NOT NULL |
| job_role_id | BIGINT(20) UNSIGNED | NOT NULL |
| created_by | BIGINT(20) UNSIGNED | NOT NULL |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

**Unique Key:** `idx_cert_role (certificate_type_id, job_role_id)`

---

### 15. New Hires

#### `aquaticpro_new_hires`
| Column | Type | Constraints |
|---|---|---|
| id | bigint(20) unsigned | PK, AUTO_INCREMENT |
| first_name | varchar(100) | NOT NULL |
| last_name | varchar(100) | NOT NULL |
| email | varchar(255) | NOT NULL |
| phone | varchar(50) | DEFAULT '' |
| date_of_birth | date | DEFAULT NULL |
| address | text | DEFAULT '' |
| position | varchar(100) | NOT NULL |
| is_accepting | tinyint(1) | NOT NULL, DEFAULT 1 |
| needs_work_permit | tinyint(1) | NOT NULL, DEFAULT 0 |
| status | varchar(20) | NOT NULL, DEFAULT 'pending' |
| wp_user_id | bigint(20) unsigned | DEFAULT NULL |
| loi_sent | tinyint(1) | NOT NULL, DEFAULT 0 |
| loi_sent_date | datetime | DEFAULT NULL |
| loi_download_token | varchar(64) | DEFAULT NULL |
| notes | text | DEFAULT '' |
| is_archived | tinyint(1) | NOT NULL, DEFAULT 0 |
| created_at | datetime | DEFAULT CURRENT_TIMESTAMP |
| updated_at | datetime | DEFAULT CURRENT_TIMESTAMP ON UPDATE |

**Indexes:** `email`, `status`, `needs_work_permit`, `position`, `is_archived`

---

### 16. Security / Audit

#### `mp_audit_log`
| Column | Type | Constraints |
|---|---|---|
| id | bigint(20) unsigned | PK, AUTO_INCREMENT |
| user_id | bigint(20) unsigned | DEFAULT NULL |
| action | varchar(100) | NOT NULL |
| resource_type | varchar(50) | DEFAULT NULL |
| resource_id | bigint(20) unsigned | DEFAULT NULL |
| details | longtext | DEFAULT NULL |
| ip_address | varchar(45) | DEFAULT NULL |
| user_agent | text | DEFAULT NULL |
| created_at | datetime | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

**Indexes:** `idx_user_id`, `idx_action`, `idx_resource (resource_type, resource_id)`, `idx_created_at`, `idx_ip_address`

---

### 17. Dashboard

#### `aqp_dashboard_action_buttons`
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT |
| title | VARCHAR(255) | NOT NULL |
| url | VARCHAR(500) | NOT NULL |
| color | VARCHAR(50) | DEFAULT 'blue' |
| thumbnail_url | VARCHAR(500) | |
| visible_to_roles | TEXT | |
| sort_order | INT | NOT NULL, DEFAULT 0 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

**Index:** `idx_sort (sort_order)`

---

### 18. Core / Notifications

#### `mentorship_notifications`
| Column | Type | Constraints |
|---|---|---|
| id | mediumint(9) | PK, AUTO_INCREMENT |
| user_id | bigint(20) | NOT NULL |
| message | text | NOT NULL |
| context_url | varchar(255) | DEFAULT '' |
| time | datetime | DEFAULT '0000-00-00 00:00:00' |

**Index:** `user_id`

---

## Custom Post Types

### 12 CPTs Total

| # | Slug | Label | Description | Source |
|---|---|---|---|---|
| 1 | `mp_request` | Mentorship Request | A mentor–mentee relationship record | mentorship-platform.php |
| 2 | `mp_goal` | Goal | A mentorship goal within a request | mentorship-platform.php |
| 3 | `mp_initiative` | Initiative | An initiative within a goal | mentorship-platform.php |
| 4 | `mp_task` | Task | A task for a goal or initiative | mentorship-platform.php |
| 5 | `mp_meeting` | Meeting | A meeting for a goal or initiative | mentorship-platform.php |
| 6 | `mp_update` | Update | An update post for a goal/initiative | mentorship-platform.php |
| 7 | `mp_daily_log` | Daily Log | Daily shift/activity logs | mentorship-platform.php |
| 8 | `lm-swimmer` | Swimmer | Lesson Mgmt: A swimmer student record | lesson-management/cpt-registration.php |
| 9 | `lm-level` | Level | Lesson Mgmt: Swim level definition | lesson-management/cpt-registration.php |
| 10 | `lm-skill` | Skill | Lesson Mgmt: Skill definition | lesson-management/cpt-registration.php |
| 11 | `lm-group` | Group | Lesson Mgmt: Swim group/class | lesson-management/cpt-registration.php |
| 12 | `lm-evaluation` | Evaluation | Lesson Mgmt: Swimmer evaluation | lesson-management/cpt-registration.php |

### CPT Meta Fields

#### `mp_request`
| Meta Key | Type |
|---|---|
| `_receiver_id` | number |
| `_status` | string — 'Pending', 'Accepted', 'Rejected' |

#### `mp_goal`
| Meta Key | Type |
|---|---|
| `_mentorship_id` | number — FK → mp_request post ID |
| `_status` | string — 'In Progress', 'Completed', 'Not Started' |
| `_is_portfolio` | boolean |

#### `mp_initiative`
| Meta Key | Type |
|---|---|
| `_goal_id` | number — FK → mp_goal post ID |
| `_status` | string |

#### `mp_task`
| Meta Key | Type |
|---|---|
| `_goal_id` | number — FK → mp_goal post ID |
| `_initiative_id` | number — FK → mp_initiative post ID (optional) |
| `_is_completed` | boolean |

#### `mp_meeting`
| Meta Key | Type |
|---|---|
| `_goal_id` | number — FK → mp_goal post ID |
| `_initiative_id` | number — FK → mp_initiative post ID (optional) |
| `_meeting_date` | string — ISO 8601 datetime |
| `_meeting_link` | string — URL |

#### `mp_update`
| Meta Key | Type |
|---|---|
| `_goal_id` | number — FK → mp_goal post ID |
| `_initiative_id` | number — FK → mp_initiative post ID (optional) |

#### `mp_daily_log`
| Meta Key | Type |
|---|---|
| `_location_id` | number — FK → pg_locations.id |
| `_log_date` | string — YYYY-MM-DD |
| `_time_slot_ids` | string — comma-separated IDs |
| `_job_role_id` | number — FK → pg_job_roles.id |
| `_tags` | string — comma-separated |
| `_blocks_json` | string — BlockNote JSON content |

#### `lm-swimmer`
| Meta Key | Type |
|---|---|
| `parent_name` | string |
| `parent_email` | string (email) |
| `date_of_birth` | string |
| `notes` | string |
| `current_level` | integer — FK → lm-level post ID |
| `levels_mastered` | array of integers |
| `skills_mastered` | array of {skill_id, date} |
| `evaluations` | array of integers — FK → lm-evaluation post IDs |
| `lm_evaluation_token` | string (private, no REST) |
| `lm_evaluation_token_expires` | string (private, no REST) |
| `archived` | boolean |

#### `lm-level`
| Meta Key | Type |
|---|---|
| `sort_order` | integer |
| `related_skills` | array of integers — FK → lm-skill post IDs |
| `group_class` | array of integers |
| `swimmers_mastered` | array of integers |
| `evaluated` | array of integers |

#### `lm-skill`
| Meta Key | Type |
|---|---|
| `sort_order` | integer |
| `level_associated` | integer — FK → lm-level post ID |
| `swimmer_skilled` | array of integers |

#### `lm-group`
| Meta Key | Type |
|---|---|
| `level` | integer — FK → lm-level post ID |
| `instructor` | array of integers — user IDs |
| `swimmers` | array of integers — FK → lm-swimmer post IDs |
| `swimmer_grouping` | object — {key: [swimmer IDs]} |
| `days` | array of strings |
| `group_time` | string |
| `dates_offered` | array of strings |
| `notes` | string |
| `media` | integer — WP attachment ID |
| `archived` | boolean |
| `year` | integer |

#### `lm-evaluation`
| Meta Key | Type |
|---|---|
| `swimmer` | integer — FK → lm-swimmer post ID |
| `level_evaluated` | integer — FK → lm-level post ID |
| `emailed` | boolean |

#### User Meta (registered via `register_meta('user', ...)`)
| Meta Key | Type |
|---|---|
| `_tagline` | string |
| `_mentor_opt_in` | boolean |
| `_skills` | JSON array of strings |
| `_bio_details` | string |
| `_experience` | string |
| `_linkedin_url` | string |
| `_custom_links` | JSON array of {label, url} |

---

## Custom Taxonomies

| # | Taxonomy Slug | Object Type | Labels |
|---|---|---|---|
| 1 | `lm_camp` | `lm-group` | Camps |
| 2 | `lm_animal` | `lm-group` | Animals |
| 3 | `lm_lesson_type` | `lm-group` | Lesson Types |

All three are hierarchical and shown in REST.

---

## wp_options Keys

### Module Enable/Disable Flags (boolean)
| Option Key | Default |
|---|---|
| `aquaticpro_enable_mentorship` | `true` |
| `aquaticpro_enable_daily_logs` | `true` |
| `aquaticpro_enable_professional_growth` | `false` |
| `aquaticpro_enable_taskdeck` | `false` |
| `aquaticpro_enable_awesome_awards` | `false` |
| `aquaticpro_enable_seasonal_returns` | `true` |
| `aquaticpro_enable_lesson_management` | `false` |
| `aquaticpro_enable_lms` | `false` |
| `aquaticpro_enable_mileage` | `false` |
| `aquaticpro_enable_new_hires` | `false` |
| `aquaticpro_enable_reports` | `true` |
| `aquaticpro_enable_foia_export` | `false` |
| `aquaticpro_enable_certificates` | `true` |
| `aquaticpro_enable_pwa` | `false` |
| `aquaticpro_enable_bento_grid` | `false` |

### App Settings
| Option Key | Default | Description |
|---|---|---|
| `aquaticpro_default_home_view` | `'myMentees'` | Default landing view for the SPA |
| `aquaticpro_camp_roster_password` | `''` | Password for public camp roster page |
| `aquaticpro_dashboard_goal` | `''` | Dashboard goal statement text |
| `aquaticpro_dashboard_mission` | `''` | Dashboard mission statement text |
| `aquaticpro_dashboard_zipcode` | `''` | Zipcode for weather widget |
| `aquaticpro_app_admin_tier` | `0` | Min tier level to be treated as App Admin |
| `aquaticpro_version` | `'0'` | Current plugin version (cache buster) |
| `aquaticpro_learndash_groups` | `[]` | Selected LearnDash group IDs |

### Bento Media Grid Settings
| Option Key | Default |
|---|---|
| `aquaticpro_bento_categories` | `[]` |
| `aquaticpro_bento_accent_color` | `'#0ea5e9'` |
| `aquaticpro_bento_show_author` | `true` |
| `aquaticpro_bento_show_date` | `true` |
| `aquaticpro_bento_show_tags` | `true` |
| `aquaticpro_bento_layout_type` | `'bento'` |
| `aquaticpro_bento_grid_title` | `'Media Gallery'` |

### Lesson Management Email Settings
| Option Key | Default |
|---|---|
| `lm_evaluation_page_url` | `''` |
| `lm_evaluation_email_subject` | `'Evaluation Results for [swimmer_name]'` |
| `lm_evaluation_email_body` | (template with placeholders) |
| `lm_evaluation_reply_to_email` | `''` |
| `lm_bulk_email_allowed_roles` | `['administrator']` |

### SRM Settings
| Option Key | Default | Description |
|---|---|---|
| `srm_anniversary_year_mode` | `'season'` | 'season' or 'anniversary' — how longevity years are counted |

### Internal Schema Version Keys (used for migration gating)
| Option Key | Purpose |
|---|---|
| `mp_db_version` | Main migration version |
| `mp_schema_version` | Schema fix version |
| `mp_srm_schema_version` | SRM ENUM fix version |
| `mp_longevity_version` | Longevity tables version |
| `mp_index_version` | Performance indexes version |
| `mp_instructor_eval_version` | Instructor eval table version |
| `mp_pg_tables_version` | Professional Growth permissions tables |
| `mp_rewrite_rules_version` | Rewrite rules version |
| `mp_whiteboard_tables_version` | Whiteboard tables version |
| `aquaticpro_lms_tables_version` | LMS tables version |
| `aquaticpro_lms_assignments_tables_version` | LMS assignments tables |
| `aquaticpro_lms_auto_assign_tables_version` | LMS auto-assign tables |
| `aquaticpro_email_composer_tables_version` | Email composer tables |
| `aquaticpro_cert_tables_version` | Certificate tables |
| `aquaticpro_cert_defaults_seeded` | Certificate defaults seeded flag |
| `mp_course_builder_tables_dropped` | Course Builder migration complete |
| `mentorship_platform_archived_fix_version` | Archived fix migration |
| `mentorship_platform_scan_audit_fields_version` | Scan audit fields migration |
| `mentorship_platform_drill_result_fix_version` | Drill result column migration |

---

## Summary

| Category | Count |
|---|---|
| **Custom Tables** | **65** |
| — Permission tables | 16 |
| — Data/content tables | 49 |
| **Custom Post Types** | **12** |
| **Custom Taxonomies** | **3** |
| **wp_options Keys** | **~45** (15 module flags + 8 app settings + 7 bento + 4 LM email + 1 SRM + ~10 internal versions) |
