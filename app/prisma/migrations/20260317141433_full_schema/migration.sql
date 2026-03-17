/*
  Warnings:

  - You are about to drop the column `is_wp_admin` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "is_wp_admin",
ADD COLUMN     "bio_details" TEXT,
ADD COLUMN     "custom_links" TEXT,
ADD COLUMN     "experience" TEXT,
ADD COLUMN     "linkedin_url" TEXT,
ADD COLUMN     "mentor_opt_in" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "skills" TEXT,
ADD COLUMN     "tagline" TEXT;

-- CreateTable
CREATE TABLE "mp_time_slots" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "color" VARCHAR(7),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mp_time_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mp_daily_logs" (
    "id" SERIAL NOT NULL,
    "author_id" INTEGER NOT NULL,
    "location_id" INTEGER,
    "log_date" DATE NOT NULL,
    "time_slot_ids" TEXT,
    "job_role_id" INTEGER,
    "tags" TEXT,
    "blocks_json" TEXT,
    "status" VARCHAR(50) NOT NULL DEFAULT 'publish',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mp_daily_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mp_daily_log_comments" (
    "id" SERIAL NOT NULL,
    "log_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mp_daily_log_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mp_daily_log_permissions" (
    "id" SERIAL NOT NULL,
    "job_role_id" INTEGER NOT NULL,
    "can_view" BOOLEAN NOT NULL DEFAULT true,
    "can_create" BOOLEAN NOT NULL DEFAULT false,
    "can_edit" BOOLEAN NOT NULL DEFAULT false,
    "can_delete" BOOLEAN NOT NULL DEFAULT false,
    "can_moderate_all" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mp_daily_log_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pg_scan_audit_permissions" (
    "id" SERIAL NOT NULL,
    "job_role_id" INTEGER NOT NULL,
    "can_view" BOOLEAN NOT NULL DEFAULT true,
    "can_create" BOOLEAN NOT NULL DEFAULT false,
    "can_edit" BOOLEAN NOT NULL DEFAULT false,
    "can_delete" BOOLEAN NOT NULL DEFAULT false,
    "can_moderate_all" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pg_scan_audit_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pg_live_drill_permissions" (
    "id" SERIAL NOT NULL,
    "job_role_id" INTEGER NOT NULL,
    "can_view" BOOLEAN NOT NULL DEFAULT true,
    "can_create" BOOLEAN NOT NULL DEFAULT false,
    "can_edit" BOOLEAN NOT NULL DEFAULT false,
    "can_delete" BOOLEAN NOT NULL DEFAULT false,
    "can_moderate_all" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pg_live_drill_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pg_inservice_permissions" (
    "id" SERIAL NOT NULL,
    "job_role_id" INTEGER NOT NULL,
    "can_view" BOOLEAN NOT NULL DEFAULT true,
    "can_create" BOOLEAN NOT NULL DEFAULT false,
    "can_edit" BOOLEAN NOT NULL DEFAULT false,
    "can_delete" BOOLEAN NOT NULL DEFAULT false,
    "can_moderate_all" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pg_inservice_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pg_cashier_audit_permissions" (
    "id" SERIAL NOT NULL,
    "job_role_id" INTEGER NOT NULL,
    "can_view" BOOLEAN NOT NULL DEFAULT true,
    "can_create" BOOLEAN NOT NULL DEFAULT false,
    "can_edit" BOOLEAN NOT NULL DEFAULT false,
    "can_delete" BOOLEAN NOT NULL DEFAULT false,
    "can_moderate_all" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pg_cashier_audit_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pg_instructor_evaluation_permissions" (
    "id" SERIAL NOT NULL,
    "job_role_id" INTEGER NOT NULL,
    "can_view" BOOLEAN NOT NULL DEFAULT true,
    "can_create" BOOLEAN NOT NULL DEFAULT false,
    "can_edit" BOOLEAN NOT NULL DEFAULT false,
    "can_delete" BOOLEAN NOT NULL DEFAULT false,
    "can_moderate_all" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pg_instructor_evaluation_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pg_lesson_management_permissions" (
    "id" SERIAL NOT NULL,
    "job_role_id" INTEGER NOT NULL,
    "can_view" BOOLEAN NOT NULL DEFAULT true,
    "can_create" BOOLEAN NOT NULL DEFAULT false,
    "can_edit" BOOLEAN NOT NULL DEFAULT false,
    "can_delete" BOOLEAN NOT NULL DEFAULT false,
    "can_moderate_all" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pg_lesson_management_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pg_taskdeck_permissions" (
    "id" SERIAL NOT NULL,
    "job_role_id" INTEGER NOT NULL,
    "can_view" BOOLEAN NOT NULL DEFAULT true,
    "can_view_only_assigned" BOOLEAN NOT NULL DEFAULT false,
    "can_create" BOOLEAN NOT NULL DEFAULT false,
    "can_edit" BOOLEAN NOT NULL DEFAULT false,
    "can_delete" BOOLEAN NOT NULL DEFAULT false,
    "can_moderate_all" BOOLEAN NOT NULL DEFAULT false,
    "can_manage_primary_deck" BOOLEAN NOT NULL DEFAULT false,
    "can_manage_all_primary_cards" BOOLEAN NOT NULL DEFAULT false,
    "can_create_public_decks" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pg_taskdeck_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pg_reports_permissions" (
    "id" SERIAL NOT NULL,
    "job_role_id" INTEGER NOT NULL,
    "can_view_all_records" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pg_reports_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pg_lms_permissions" (
    "id" SERIAL NOT NULL,
    "job_role_id" INTEGER NOT NULL,
    "can_view_courses" BOOLEAN NOT NULL DEFAULT true,
    "can_view_lessons" BOOLEAN NOT NULL DEFAULT true,
    "can_create_courses" BOOLEAN NOT NULL DEFAULT false,
    "can_edit_courses" BOOLEAN NOT NULL DEFAULT false,
    "can_delete_courses" BOOLEAN NOT NULL DEFAULT false,
    "can_create_lessons" BOOLEAN NOT NULL DEFAULT false,
    "can_edit_lessons" BOOLEAN NOT NULL DEFAULT false,
    "can_delete_lessons" BOOLEAN NOT NULL DEFAULT false,
    "can_manage_hotspots" BOOLEAN NOT NULL DEFAULT false,
    "can_manage_excalidraw" BOOLEAN NOT NULL DEFAULT false,
    "can_moderate_all" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pg_lms_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pg_email_permissions" (
    "id" SERIAL NOT NULL,
    "job_role_id" INTEGER NOT NULL,
    "can_send_email" BOOLEAN NOT NULL DEFAULT false,
    "can_manage_templates" BOOLEAN NOT NULL DEFAULT false,
    "can_view_history" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pg_email_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "srm_permissions" (
    "id" SERIAL NOT NULL,
    "job_role_id" INTEGER NOT NULL,
    "srm_view_own_pay" BOOLEAN NOT NULL DEFAULT true,
    "srm_view_all_pay" BOOLEAN NOT NULL DEFAULT false,
    "srm_manage_pay_config" BOOLEAN NOT NULL DEFAULT false,
    "srm_send_invites" BOOLEAN NOT NULL DEFAULT false,
    "srm_view_responses" BOOLEAN NOT NULL DEFAULT false,
    "srm_manage_status" BOOLEAN NOT NULL DEFAULT false,
    "srm_manage_templates" BOOLEAN NOT NULL DEFAULT false,
    "srm_view_retention" BOOLEAN NOT NULL DEFAULT false,
    "srm_bulk_actions" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "srm_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "awesome_awards_permissions" (
    "id" SERIAL NOT NULL,
    "job_role_id" INTEGER NOT NULL,
    "can_nominate" BOOLEAN NOT NULL DEFAULT true,
    "can_vote" BOOLEAN NOT NULL DEFAULT false,
    "can_approve" BOOLEAN NOT NULL DEFAULT false,
    "can_direct_assign" BOOLEAN NOT NULL DEFAULT false,
    "can_manage_periods" BOOLEAN NOT NULL DEFAULT false,
    "can_view_nominations" BOOLEAN NOT NULL DEFAULT true,
    "can_view_winners" BOOLEAN NOT NULL DEFAULT true,
    "can_view_archives" BOOLEAN NOT NULL DEFAULT true,
    "can_archive" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "awesome_awards_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mp_mileage_permissions" (
    "id" SERIAL NOT NULL,
    "job_role_id" INTEGER NOT NULL,
    "can_submit" BOOLEAN NOT NULL DEFAULT true,
    "can_view_all" BOOLEAN NOT NULL DEFAULT false,
    "can_manage" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mp_mileage_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aquaticpro_cert_permissions" (
    "id" SERIAL NOT NULL,
    "job_role_id" INTEGER NOT NULL,
    "can_view_all" BOOLEAN NOT NULL DEFAULT false,
    "can_edit_records" BOOLEAN NOT NULL DEFAULT false,
    "can_manage_types" BOOLEAN NOT NULL DEFAULT false,
    "can_approve_uploads" BOOLEAN NOT NULL DEFAULT false,
    "can_bulk_edit" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aquaticpro_cert_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mp_daily_log_reactions" (
    "id" SERIAL NOT NULL,
    "log_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "reaction_type" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mp_daily_log_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mp_comment_reactions" (
    "id" SERIAL NOT NULL,
    "comment_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "reaction_type" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mp_comment_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aqp_unified_reactions" (
    "id" SERIAL NOT NULL,
    "object_id" INTEGER NOT NULL,
    "object_type" VARCHAR(50) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "reaction_type" VARCHAR(20) NOT NULL,
    "item_author_id" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aqp_unified_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aqp_card_comment_reactions" (
    "id" SERIAL NOT NULL,
    "comment_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "reaction_type" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aqp_card_comment_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "awesome_awards_periods" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255),
    "period_type" VARCHAR(10) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "voting_start" DATE,
    "voting_end" DATE,
    "nomination_deadline" TIMESTAMP(3),
    "status" VARCHAR(50) NOT NULL DEFAULT 'draft',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "max_winners" INTEGER NOT NULL DEFAULT 1,
    "allow_pre_voting" BOOLEAN NOT NULL DEFAULT false,
    "created_by" INTEGER,
    "tasklist_id" INTEGER,
    "taskdeck_enabled" BOOLEAN NOT NULL DEFAULT false,
    "nomination_reminder_roles" TEXT,
    "voting_reminder_roles" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "awesome_awards_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "awesome_awards_categories" (
    "id" SERIAL NOT NULL,
    "period_id" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "prizeDescription" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "awesome_awards_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "awesome_awards_nominations" (
    "id" SERIAL NOT NULL,
    "period_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL DEFAULT 0,
    "category" VARCHAR(255) NOT NULL DEFAULT '',
    "nominee_id" INTEGER NOT NULL,
    "nominator_id" INTEGER NOT NULL,
    "reason" TEXT,
    "reason_json" TEXT,
    "reason_text" TEXT,
    "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "is_direct_assignment" BOOLEAN NOT NULL DEFAULT false,
    "is_winner" BOOLEAN NOT NULL DEFAULT false,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "rejection_reason" TEXT,
    "vote_count" INTEGER NOT NULL DEFAULT 0,
    "edited_at" TIMESTAMP(3),
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "awesome_awards_nominations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "awesome_awards_votes" (
    "id" SERIAL NOT NULL,
    "nomination_id" INTEGER NOT NULL,
    "voter_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "awesome_awards_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "awesome_awards_announcements_seen" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "nomination_id" INTEGER NOT NULL,
    "announcement_type" VARCHAR(20) NOT NULL,
    "seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "awesome_awards_announcements_seen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "awesome_awards_taskdeck_cards" (
    "id" SERIAL NOT NULL,
    "period_id" INTEGER NOT NULL,
    "card_type" VARCHAR(20) NOT NULL DEFAULT 'nomination',
    "card_id" INTEGER NOT NULL,
    "assigned_roles" TEXT,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "awesome_awards_taskdeck_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "srm_pay_config" (
    "id" SERIAL NOT NULL,
    "config_type" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "job_role_id" INTEGER,
    "longevity_years" INTEGER,
    "start_date" DATE,
    "end_date" DATE,
    "expiration_date" DATE,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "effective_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "srm_pay_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "srm_seasons" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "year" INTEGER NOT NULL,
    "season_type" VARCHAR(50) NOT NULL DEFAULT 'summer',
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "srm_seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "srm_employee_seasons" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "season_id" INTEGER NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'pending',
    "eligible_for_rehire" BOOLEAN NOT NULL DEFAULT true,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "is_new_hire" BOOLEAN NOT NULL DEFAULT false,
    "return_token" VARCHAR(64),
    "token_expires_at" TIMESTAMP(3),
    "response_date" TIMESTAMP(3),
    "signature_text" VARCHAR(255),
    "comments" TEXT,
    "longevity_years" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "srm_employee_seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "srm_email_templates" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "body_html" TEXT NOT NULL,
    "body_json" TEXT,
    "template_type" VARCHAR(30) NOT NULL DEFAULT 'custom',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "srm_email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "srm_email_log" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "season_id" INTEGER NOT NULL,
    "template_id" INTEGER,
    "email_type" VARCHAR(30) NOT NULL DEFAULT 'initial',
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "opened_at" TIMESTAMP(3),
    "clicked_at" TIMESTAMP(3),
    "sent_by" INTEGER NOT NULL,

    CONSTRAINT "srm_email_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "srm_retention_stats" (
    "id" SERIAL NOT NULL,
    "season_id" INTEGER NOT NULL,
    "total_eligible" INTEGER NOT NULL DEFAULT 0,
    "total_invited" INTEGER NOT NULL DEFAULT 0,
    "total_returning" INTEGER NOT NULL DEFAULT 0,
    "total_not_returning" INTEGER NOT NULL DEFAULT 0,
    "total_pending" INTEGER NOT NULL DEFAULT 0,
    "total_ineligible" INTEGER NOT NULL DEFAULT 0,
    "total_new_hires" INTEGER NOT NULL DEFAULT 0,
    "retention_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "srm_retention_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "srm_longevity_rates" (
    "id" SERIAL NOT NULL,
    "work_year" INTEGER NOT NULL,
    "rate" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "srm_longevity_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "srm_employee_work_years" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "work_year" INTEGER NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_by" INTEGER,
    "verified_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "srm_employee_work_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "srm_pay_cache" (
    "user_id" INTEGER NOT NULL,
    "pay_data" TEXT NOT NULL,
    "projected_data" TEXT,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "srm_pay_cache_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "pg_job_roles" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "tier" INTEGER NOT NULL,
    "description" TEXT,
    "inservice_hours" DECIMAL(4,2) NOT NULL DEFAULT 4.00,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pg_job_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pg_locations" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pg_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pg_user_job_assignments" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "job_role_id" INTEGER NOT NULL,
    "assigned_by" INTEGER,
    "assigned_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sync_wp_role" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pg_user_job_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pg_user_metadata" (
    "user_id" INTEGER NOT NULL,
    "phone_number" VARCHAR(20),
    "employee_id" VARCHAR(50),
    "hire_date" DATE,
    "notes" TEXT,
    "eligible_for_rehire" BOOLEAN NOT NULL DEFAULT true,
    "is_member" BOOLEAN,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "archived_date" TIMESTAMP(3),
    "archived_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pg_user_metadata_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "pg_promotion_criteria" (
    "id" SERIAL NOT NULL,
    "job_role_id" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "criterion_type" VARCHAR(50) NOT NULL,
    "target_value" INTEGER NOT NULL DEFAULT 1,
    "linked_module" VARCHAR(50),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pg_promotion_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pg_user_progress" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "criterion_id" INTEGER NOT NULL,
    "current_value" INTEGER NOT NULL DEFAULT 0,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "completion_date" TIMESTAMP(3),
    "approved_by" INTEGER,
    "notes" TEXT,
    "file_url" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pg_user_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pg_criterion_activities" (
    "id" SERIAL NOT NULL,
    "criterion_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "affected_user_id" INTEGER NOT NULL,
    "user_job_role_id" INTEGER,
    "activity_type" VARCHAR(50) NOT NULL,
    "content" TEXT,
    "old_value" VARCHAR(255),
    "new_value" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_at" TIMESTAMP(3),
    "edited_by" INTEGER,

    CONSTRAINT "pg_criterion_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pg_inservice_logs" (
    "id" SERIAL NOT NULL,
    "training_date" DATE NOT NULL,
    "training_time" VARCHAR(8),
    "location" VARCHAR(255),
    "duration_hours" DECIMAL(4,2) NOT NULL,
    "topic" VARCHAR(255) NOT NULL,
    "details" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pg_inservice_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pg_inservice_attendees" (
    "id" SERIAL NOT NULL,
    "inservice_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "attendance_status" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pg_inservice_attendees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pg_inservice_job_roles" (
    "id" SERIAL NOT NULL,
    "inservice_id" INTEGER NOT NULL,
    "job_role_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pg_inservice_job_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pg_inservice_cache" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "total_hours" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "required_hours" DECIMAL(5,2) NOT NULL DEFAULT 4,
    "meets_requirement" BOOLEAN NOT NULL DEFAULT false,
    "training_count" INTEGER NOT NULL DEFAULT 0,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pg_inservice_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pg_scan_audit_logs" (
    "id" SERIAL NOT NULL,
    "audited_user_id" INTEGER NOT NULL,
    "auditor_id" INTEGER NOT NULL,
    "audit_date" TIMESTAMP(3) NOT NULL,
    "location" VARCHAR(255),
    "result" VARCHAR(20) NOT NULL,
    "notes" TEXT,
    "wearing_correct_uniform" BOOLEAN,
    "attentive_to_zone" BOOLEAN,
    "posture_adjustment_5min" BOOLEAN,
    "attachments" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pg_scan_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pg_cashier_audit_logs" (
    "id" SERIAL NOT NULL,
    "audited_user_id" INTEGER NOT NULL,
    "auditor_id" INTEGER NOT NULL,
    "audit_date" TIMESTAMP(3) NOT NULL,
    "checked_cash_drawer" VARCHAR(20),
    "attentive_patrons_entered" VARCHAR(20),
    "greeted_with_demeanor" VARCHAR(20),
    "one_click_per_person" VARCHAR(20),
    "pool_pass_process" VARCHAR(20),
    "resolved_patron_concerns" TEXT,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pg_cashier_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pg_live_recognition_drill_logs" (
    "id" SERIAL NOT NULL,
    "drilled_user_id" INTEGER NOT NULL,
    "drill_conductor_id" INTEGER NOT NULL,
    "drill_date" TIMESTAMP(3) NOT NULL,
    "location" VARCHAR(255),
    "result" VARCHAR(50) NOT NULL,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pg_live_recognition_drill_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pg_instructor_evaluation_logs" (
    "id" SERIAL NOT NULL,
    "evaluated_user_id" INTEGER NOT NULL,
    "evaluator_id" INTEGER NOT NULL,
    "evaluation_date" TIMESTAMP(3) NOT NULL,
    "command_language" BOOLEAN,
    "minimizing_downtime" BOOLEAN,
    "periodic_challenges" BOOLEAN,
    "provides_feedback" BOOLEAN,
    "rules_expectations" BOOLEAN,
    "learning_environment" BOOLEAN,
    "comments" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pg_instructor_evaluation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aqp_taskdecks" (
    "deck_id" SERIAL NOT NULL,
    "deck_name" VARCHAR(255) NOT NULL,
    "deck_description" TEXT,
    "created_by" INTEGER NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "aqp_taskdecks_pkey" PRIMARY KEY ("deck_id")
);

-- CreateTable
CREATE TABLE "aqp_tasklists" (
    "list_id" SERIAL NOT NULL,
    "deck_id" INTEGER NOT NULL,
    "list_name" VARCHAR(255) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aqp_tasklists_pkey" PRIMARY KEY ("list_id")
);

-- CreateTable
CREATE TABLE "aqp_taskcards" (
    "card_id" SERIAL NOT NULL,
    "list_id" INTEGER NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "action_url" VARCHAR(500),
    "created_by" INTEGER NOT NULL,
    "assigned_to" INTEGER,
    "assigned_to_role_id" INTEGER,
    "location_id" INTEGER,
    "due_date" TIMESTAMP(3),
    "category_tag" VARCHAR(100),
    "accent_color" VARCHAR(7),
    "is_complete" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aqp_taskcards_pkey" PRIMARY KEY ("card_id")
);

-- CreateTable
CREATE TABLE "aqp_card_assignees" (
    "id" SERIAL NOT NULL,
    "card_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" INTEGER,

    CONSTRAINT "aqp_card_assignees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aqp_card_assigned_roles" (
    "id" SERIAL NOT NULL,
    "card_id" INTEGER NOT NULL,
    "role_id" INTEGER NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" INTEGER,

    CONSTRAINT "aqp_card_assigned_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aqp_card_comments" (
    "comment_id" SERIAL NOT NULL,
    "card_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "comment_text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aqp_card_comments_pkey" PRIMARY KEY ("comment_id")
);

-- CreateTable
CREATE TABLE "aqp_card_attachments" (
    "attachment_id" SERIAL NOT NULL,
    "card_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "wp_attachment_id" INTEGER NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aqp_card_attachments_pkey" PRIMARY KEY ("attachment_id")
);

-- CreateTable
CREATE TABLE "aqp_card_checklists" (
    "checklist_id" SERIAL NOT NULL,
    "card_id" INTEGER NOT NULL,
    "item_text" VARCHAR(500) NOT NULL,
    "is_complete" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aqp_card_checklists_pkey" PRIMARY KEY ("checklist_id")
);

-- CreateTable
CREATE TABLE "aqp_activity_log" (
    "log_id" SERIAL NOT NULL,
    "card_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "action" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aqp_activity_log_pkey" PRIMARY KEY ("log_id")
);

-- CreateTable
CREATE TABLE "aquaticpro_courses" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "featured_image" TEXT,
    "category" VARCHAR(100),
    "is_sequential" BOOLEAN NOT NULL DEFAULT false,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aquaticpro_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aquaticpro_lessons" (
    "id" SERIAL NOT NULL,
    "course_id" INTEGER NOT NULL,
    "section_id" INTEGER,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "content" TEXT,
    "lesson_type" VARCHAR(20) NOT NULL DEFAULT 'content',
    "featured_image" TEXT,
    "excalidraw_json" TEXT,
    "scroll_cues" TEXT,
    "slide_order" TEXT,
    "hybrid_layout" VARCHAR(20) NOT NULL DEFAULT 'text-left',
    "split_ratio" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
    "estimated_time" VARCHAR(50),
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aquaticpro_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aquaticpro_lesson_sections" (
    "id" SERIAL NOT NULL,
    "course_id" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aquaticpro_lesson_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aquaticpro_progress" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "lesson_id" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'not-started',
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "last_viewed" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "time_spent_seconds" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aquaticpro_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aquaticpro_course_categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aquaticpro_course_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mp_wb_lesson_sections" (
    "id" SERIAL NOT NULL,
    "lesson_id" INTEGER NOT NULL,
    "section_type" VARCHAR(20) NOT NULL DEFAULT 'whiteboard',
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "requires_section_id" INTEGER,
    "unlock_after_minutes" INTEGER,
    "video_url" TEXT,
    "text_content" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mp_wb_lesson_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mp_wb_whiteboards" (
    "id" SERIAL NOT NULL,
    "lesson_section_id" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL DEFAULT 'Untitled',
    "data" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mp_wb_whiteboards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mp_wb_quizzes" (
    "id" SERIAL NOT NULL,
    "lesson_section_id" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "time_limit_minutes" INTEGER,
    "passing_score" INTEGER NOT NULL DEFAULT 70,
    "max_attempts" INTEGER,
    "shuffle_questions" BOOLEAN NOT NULL DEFAULT false,
    "shuffle_options" BOOLEAN NOT NULL DEFAULT false,
    "show_correct_answers" VARCHAR(20) NOT NULL DEFAULT 'after_attempt',
    "allow_review" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mp_wb_quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mp_wb_quiz_questions" (
    "id" SERIAL NOT NULL,
    "quiz_id" INTEGER NOT NULL,
    "question_type" VARCHAR(30) NOT NULL DEFAULT 'multiple-choice',
    "question_text" TEXT NOT NULL,
    "question_image_url" TEXT,
    "question_data" TEXT NOT NULL,
    "explanation" TEXT,
    "points" INTEGER NOT NULL DEFAULT 1,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mp_wb_quiz_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mp_wb_lesson_progress" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "lesson_id" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'not_started',
    "current_section_id" INTEGER,
    "time_spent_seconds" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "last_accessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mp_wb_lesson_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mp_wb_section_progress" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "lesson_section_id" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'not_started',
    "time_spent_seconds" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMP(3),
    "quiz_score" DECIMAL(5,2),
    "quiz_passed" BOOLEAN,
    "quiz_attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mp_wb_section_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mp_wb_quiz_attempts" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "quiz_id" INTEGER NOT NULL,
    "lesson_section_id" INTEGER NOT NULL,
    "score" DECIMAL(5,2) NOT NULL,
    "total_points" INTEGER NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "answers" TEXT NOT NULL,
    "time_taken_seconds" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mp_wb_quiz_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aquaticpro_learning_assignments" (
    "id" SERIAL NOT NULL,
    "lesson_id" INTEGER NOT NULL,
    "assigned_by" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "due_date" TIMESTAMP(3),
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "taskdeck_card_id" INTEGER,
    "reminder_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aquaticpro_learning_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aquaticpro_learning_assignment_users" (
    "id" SERIAL NOT NULL,
    "assignment_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "source" VARCHAR(20) NOT NULL DEFAULT 'direct',
    "source_role_id" INTEGER,
    "email_sent_at" TIMESTAMP(3),
    "email_status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "reminder_sent_at" TIMESTAMP(3),
    "progress_status" VARCHAR(20) NOT NULL DEFAULT 'not-started',
    "quiz_score" DOUBLE PRECISION,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aquaticpro_learning_assignment_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aquaticpro_email_queue" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "email_type" VARCHAR(50) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "context_id" INTEGER,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aquaticpro_email_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aquaticpro_course_auto_assign_rules" (
    "id" SERIAL NOT NULL,
    "course_id" INTEGER NOT NULL,
    "job_role_id" INTEGER NOT NULL,
    "send_notification" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aquaticpro_course_auto_assign_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aquaticpro_course_assignments" (
    "id" SERIAL NOT NULL,
    "course_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "rule_id" INTEGER,
    "source" VARCHAR(20) NOT NULL DEFAULT 'auto',
    "source_role_id" INTEGER,
    "assigned_by" INTEGER,
    "status" VARCHAR(20) NOT NULL DEFAULT 'assigned',
    "due_date" TIMESTAMP(3),
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aquaticpro_course_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mp_mileage_settings" (
    "id" SERIAL NOT NULL,
    "setting_key" VARCHAR(100) NOT NULL,
    "setting_value" TEXT,
    "updated_by" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mp_mileage_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mp_mileage_locations" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "address" VARCHAR(500) NOT NULL,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mp_mileage_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mp_mileage_budget_accounts" (
    "id" SERIAL NOT NULL,
    "account_code" VARCHAR(50) NOT NULL,
    "account_name" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mp_mileage_budget_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mp_mileage_entries" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "trip_date" DATE NOT NULL,
    "business_purpose" VARCHAR(500),
    "odometer_start" INTEGER,
    "odometer_end" INTEGER,
    "calculated_miles" INTEGER NOT NULL DEFAULT 0,
    "route_json" TEXT,
    "tolls" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "parking" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "budget_account_id" INTEGER,
    "notes" TEXT,
    "submitted_for_payment" BOOLEAN NOT NULL DEFAULT false,
    "submitted_at" TIMESTAMP(3),
    "submitted_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mp_mileage_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mp_mileage_entry_stops" (
    "id" SERIAL NOT NULL,
    "entry_id" INTEGER NOT NULL,
    "stop_order" INTEGER NOT NULL,
    "location_id" INTEGER,
    "custom_address" VARCHAR(500),
    "distance_to_next" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mp_mileage_entry_stops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aquaticpro_email_composer_templates" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "subject" VARCHAR(255) NOT NULL DEFAULT '',
    "body_json" TEXT,
    "body_html" TEXT,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aquaticpro_email_composer_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aquaticpro_email_composer_log" (
    "id" SERIAL NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "body_html" TEXT,
    "recipient_count" INTEGER NOT NULL DEFAULT 0,
    "sent_by" INTEGER NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipient_summary" TEXT,

    CONSTRAINT "aquaticpro_email_composer_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aquaticpro_certificate_types" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "default_expiry_months" INTEGER,
    "training_link" VARCHAR(2083) NOT NULL DEFAULT '',
    "email_alerts_enabled" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aquaticpro_certificate_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aquaticpro_user_certificates" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "certificate_type_id" INTEGER NOT NULL,
    "training_date" DATE,
    "expiration_date" DATE,
    "file_attachment_id" INTEGER,
    "file_url" VARCHAR(2083) NOT NULL DEFAULT '',
    "status" VARCHAR(30) NOT NULL DEFAULT 'missing',
    "notes" TEXT,
    "uploaded_by" INTEGER,
    "approved_by" INTEGER,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aquaticpro_user_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aquaticpro_cert_role_requirements" (
    "id" SERIAL NOT NULL,
    "certificate_type_id" INTEGER NOT NULL,
    "job_role_id" INTEGER NOT NULL,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aquaticpro_cert_role_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aquaticpro_new_hires" (
    "id" SERIAL NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(50) NOT NULL DEFAULT '',
    "date_of_birth" DATE,
    "address" TEXT NOT NULL DEFAULT '',
    "position" VARCHAR(100) NOT NULL,
    "is_accepting" BOOLEAN NOT NULL DEFAULT true,
    "needs_work_permit" BOOLEAN NOT NULL DEFAULT false,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "wp_user_id" INTEGER,
    "loi_sent" BOOLEAN NOT NULL DEFAULT false,
    "loi_sent_date" TIMESTAMP(3),
    "loi_download_token" VARCHAR(64),
    "notes" TEXT NOT NULL DEFAULT '',
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aquaticpro_new_hires_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mp_audit_log" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "action" VARCHAR(100) NOT NULL,
    "resource_type" VARCHAR(50),
    "resource_id" INTEGER,
    "details" TEXT,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mp_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aqp_dashboard_action_buttons" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "color" VARCHAR(50) NOT NULL DEFAULT 'blue',
    "thumbnail_url" VARCHAR(500),
    "visible_to_roles" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aqp_dashboard_action_buttons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentorship_notifications" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "context_url" VARCHAR(255) NOT NULL DEFAULT '',
    "time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentorship_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mp_requests" (
    "id" SERIAL NOT NULL,
    "author_id" INTEGER NOT NULL,
    "receiver_id" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'Pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mp_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mp_goals" (
    "id" SERIAL NOT NULL,
    "mentorship_id" INTEGER NOT NULL,
    "author_id" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT,
    "status" VARCHAR(30) NOT NULL DEFAULT 'Not Started',
    "is_portfolio" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mp_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mp_initiatives" (
    "id" SERIAL NOT NULL,
    "goal_id" INTEGER NOT NULL,
    "author_id" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT,
    "status" VARCHAR(30) NOT NULL DEFAULT 'Not Started',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mp_initiatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mp_tasks" (
    "id" SERIAL NOT NULL,
    "goal_id" INTEGER NOT NULL,
    "initiative_id" INTEGER,
    "author_id" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mp_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mp_meetings" (
    "id" SERIAL NOT NULL,
    "goal_id" INTEGER NOT NULL,
    "initiative_id" INTEGER,
    "author_id" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "meeting_date" TIMESTAMP(3),
    "meeting_link" VARCHAR(500),
    "content" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mp_meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mp_updates" (
    "id" SERIAL NOT NULL,
    "goal_id" INTEGER NOT NULL,
    "initiative_id" INTEGER,
    "author_id" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mp_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lm_swimmers" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "parent_name" VARCHAR(255),
    "parent_email" VARCHAR(255),
    "date_of_birth" DATE,
    "notes" TEXT,
    "current_level" INTEGER,
    "levels_mastered" TEXT,
    "skills_mastered" TEXT,
    "evaluation_token" VARCHAR(64),
    "evaluation_token_expires" TIMESTAMP(3),
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lm_swimmers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lm_levels" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "related_skills" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lm_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lm_skills" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "level_associated" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lm_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lm_groups" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "level" INTEGER,
    "instructors" TEXT,
    "swimmers" TEXT,
    "swimmer_grouping" TEXT,
    "days" TEXT,
    "group_time" VARCHAR(50),
    "dates_offered" TEXT,
    "notes" TEXT,
    "media_id" INTEGER,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "year" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lm_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lm_evaluations" (
    "id" SERIAL NOT NULL,
    "swimmer_id" INTEGER NOT NULL,
    "level_evaluated" INTEGER,
    "emailed" BOOLEAN NOT NULL DEFAULT false,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lm_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mp_time_slots_slug_key" ON "mp_time_slots"("slug");

-- CreateIndex
CREATE INDEX "mp_time_slots_is_active_idx" ON "mp_time_slots"("is_active");

-- CreateIndex
CREATE INDEX "mp_time_slots_sort_order_idx" ON "mp_time_slots"("sort_order");

-- CreateIndex
CREATE INDEX "mp_daily_logs_author_id_log_date_idx" ON "mp_daily_logs"("author_id", "log_date");

-- CreateIndex
CREATE INDEX "mp_daily_logs_location_id_idx" ON "mp_daily_logs"("location_id");

-- CreateIndex
CREATE INDEX "mp_daily_logs_status_idx" ON "mp_daily_logs"("status");

-- CreateIndex
CREATE INDEX "mp_daily_log_comments_log_id_idx" ON "mp_daily_log_comments"("log_id");

-- CreateIndex
CREATE INDEX "mp_daily_log_comments_user_id_idx" ON "mp_daily_log_comments"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "mp_daily_log_permissions_job_role_id_key" ON "mp_daily_log_permissions"("job_role_id");

-- CreateIndex
CREATE UNIQUE INDEX "pg_scan_audit_permissions_job_role_id_key" ON "pg_scan_audit_permissions"("job_role_id");

-- CreateIndex
CREATE UNIQUE INDEX "pg_live_drill_permissions_job_role_id_key" ON "pg_live_drill_permissions"("job_role_id");

-- CreateIndex
CREATE UNIQUE INDEX "pg_inservice_permissions_job_role_id_key" ON "pg_inservice_permissions"("job_role_id");

-- CreateIndex
CREATE UNIQUE INDEX "pg_cashier_audit_permissions_job_role_id_key" ON "pg_cashier_audit_permissions"("job_role_id");

-- CreateIndex
CREATE UNIQUE INDEX "pg_instructor_evaluation_permissions_job_role_id_key" ON "pg_instructor_evaluation_permissions"("job_role_id");

-- CreateIndex
CREATE UNIQUE INDEX "pg_lesson_management_permissions_job_role_id_key" ON "pg_lesson_management_permissions"("job_role_id");

-- CreateIndex
CREATE UNIQUE INDEX "pg_taskdeck_permissions_job_role_id_key" ON "pg_taskdeck_permissions"("job_role_id");

-- CreateIndex
CREATE UNIQUE INDEX "pg_reports_permissions_job_role_id_key" ON "pg_reports_permissions"("job_role_id");

-- CreateIndex
CREATE UNIQUE INDEX "pg_lms_permissions_job_role_id_key" ON "pg_lms_permissions"("job_role_id");

-- CreateIndex
CREATE INDEX "pg_lms_permissions_job_role_id_idx" ON "pg_lms_permissions"("job_role_id");

-- CreateIndex
CREATE UNIQUE INDEX "pg_email_permissions_job_role_id_key" ON "pg_email_permissions"("job_role_id");

-- CreateIndex
CREATE INDEX "pg_email_permissions_job_role_id_idx" ON "pg_email_permissions"("job_role_id");

-- CreateIndex
CREATE UNIQUE INDEX "srm_permissions_job_role_id_key" ON "srm_permissions"("job_role_id");

-- CreateIndex
CREATE UNIQUE INDEX "awesome_awards_permissions_job_role_id_key" ON "awesome_awards_permissions"("job_role_id");

-- CreateIndex
CREATE UNIQUE INDEX "mp_mileage_permissions_job_role_id_key" ON "mp_mileage_permissions"("job_role_id");

-- CreateIndex
CREATE UNIQUE INDEX "aquaticpro_cert_permissions_job_role_id_key" ON "aquaticpro_cert_permissions"("job_role_id");

-- CreateIndex
CREATE INDEX "mp_daily_log_reactions_log_id_idx" ON "mp_daily_log_reactions"("log_id");

-- CreateIndex
CREATE INDEX "mp_daily_log_reactions_user_id_idx" ON "mp_daily_log_reactions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "mp_daily_log_reactions_user_id_log_id_key" ON "mp_daily_log_reactions"("user_id", "log_id");

-- CreateIndex
CREATE INDEX "mp_comment_reactions_comment_id_idx" ON "mp_comment_reactions"("comment_id");

-- CreateIndex
CREATE INDEX "mp_comment_reactions_user_id_idx" ON "mp_comment_reactions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "mp_comment_reactions_user_id_comment_id_key" ON "mp_comment_reactions"("user_id", "comment_id");

-- CreateIndex
CREATE INDEX "aqp_unified_reactions_object_id_object_type_idx" ON "aqp_unified_reactions"("object_id", "object_type");

-- CreateIndex
CREATE INDEX "aqp_unified_reactions_user_id_idx" ON "aqp_unified_reactions"("user_id");

-- CreateIndex
CREATE INDEX "aqp_unified_reactions_item_author_id_idx" ON "aqp_unified_reactions"("item_author_id");

-- CreateIndex
CREATE UNIQUE INDEX "aqp_unified_reactions_user_id_object_id_object_type_key" ON "aqp_unified_reactions"("user_id", "object_id", "object_type");

-- CreateIndex
CREATE INDEX "aqp_card_comment_reactions_comment_id_idx" ON "aqp_card_comment_reactions"("comment_id");

-- CreateIndex
CREATE INDEX "aqp_card_comment_reactions_user_id_idx" ON "aqp_card_comment_reactions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "aqp_card_comment_reactions_user_id_comment_id_key" ON "aqp_card_comment_reactions"("user_id", "comment_id");

-- CreateIndex
CREATE INDEX "awesome_awards_periods_status_idx" ON "awesome_awards_periods"("status");

-- CreateIndex
CREATE INDEX "awesome_awards_periods_start_date_end_date_idx" ON "awesome_awards_periods"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "awesome_awards_periods_archived_idx" ON "awesome_awards_periods"("archived");

-- CreateIndex
CREATE INDEX "awesome_awards_categories_period_id_idx" ON "awesome_awards_categories"("period_id");

-- CreateIndex
CREATE INDEX "awesome_awards_nominations_period_id_idx" ON "awesome_awards_nominations"("period_id");

-- CreateIndex
CREATE INDEX "awesome_awards_nominations_category_id_idx" ON "awesome_awards_nominations"("category_id");

-- CreateIndex
CREATE INDEX "awesome_awards_nominations_nominee_id_idx" ON "awesome_awards_nominations"("nominee_id");

-- CreateIndex
CREATE INDEX "awesome_awards_nominations_nominator_id_idx" ON "awesome_awards_nominations"("nominator_id");

-- CreateIndex
CREATE INDEX "awesome_awards_nominations_status_idx" ON "awesome_awards_nominations"("status");

-- CreateIndex
CREATE INDEX "awesome_awards_nominations_is_winner_idx" ON "awesome_awards_nominations"("is_winner");

-- CreateIndex
CREATE INDEX "awesome_awards_nominations_archived_idx" ON "awesome_awards_nominations"("archived");

-- CreateIndex
CREATE INDEX "awesome_awards_votes_nomination_id_idx" ON "awesome_awards_votes"("nomination_id");

-- CreateIndex
CREATE INDEX "awesome_awards_votes_voter_id_idx" ON "awesome_awards_votes"("voter_id");

-- CreateIndex
CREATE UNIQUE INDEX "awesome_awards_votes_nomination_id_voter_id_key" ON "awesome_awards_votes"("nomination_id", "voter_id");

-- CreateIndex
CREATE INDEX "awesome_awards_announcements_seen_user_id_idx" ON "awesome_awards_announcements_seen"("user_id");

-- CreateIndex
CREATE INDEX "awesome_awards_announcements_seen_nomination_id_idx" ON "awesome_awards_announcements_seen"("nomination_id");

-- CreateIndex
CREATE UNIQUE INDEX "awesome_awards_announcements_seen_user_id_nomination_id_ann_key" ON "awesome_awards_announcements_seen"("user_id", "nomination_id", "announcement_type");

-- CreateIndex
CREATE INDEX "awesome_awards_taskdeck_cards_card_id_idx" ON "awesome_awards_taskdeck_cards"("card_id");

-- CreateIndex
CREATE INDEX "awesome_awards_taskdeck_cards_is_completed_idx" ON "awesome_awards_taskdeck_cards"("is_completed");

-- CreateIndex
CREATE UNIQUE INDEX "awesome_awards_taskdeck_cards_period_id_card_type_key" ON "awesome_awards_taskdeck_cards"("period_id", "card_type");

-- CreateIndex
CREATE INDEX "srm_pay_config_config_type_idx" ON "srm_pay_config"("config_type");

-- CreateIndex
CREATE INDEX "srm_pay_config_is_active_idx" ON "srm_pay_config"("is_active");

-- CreateIndex
CREATE INDEX "srm_pay_config_job_role_id_idx" ON "srm_pay_config"("job_role_id");

-- CreateIndex
CREATE INDEX "srm_pay_config_effective_date_idx" ON "srm_pay_config"("effective_date");

-- CreateIndex
CREATE INDEX "srm_pay_config_expiration_date_idx" ON "srm_pay_config"("expiration_date");

-- CreateIndex
CREATE INDEX "srm_seasons_is_active_idx" ON "srm_seasons"("is_active");

-- CreateIndex
CREATE INDEX "srm_seasons_is_current_idx" ON "srm_seasons"("is_current");

-- CreateIndex
CREATE INDEX "srm_seasons_year_idx" ON "srm_seasons"("year");

-- CreateIndex
CREATE INDEX "srm_seasons_start_date_end_date_idx" ON "srm_seasons"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "srm_employee_seasons_user_id_idx" ON "srm_employee_seasons"("user_id");

-- CreateIndex
CREATE INDEX "srm_employee_seasons_season_id_idx" ON "srm_employee_seasons"("season_id");

-- CreateIndex
CREATE INDEX "srm_employee_seasons_status_idx" ON "srm_employee_seasons"("status");

-- CreateIndex
CREATE INDEX "srm_employee_seasons_return_token_idx" ON "srm_employee_seasons"("return_token");

-- CreateIndex
CREATE INDEX "srm_employee_seasons_eligible_for_rehire_idx" ON "srm_employee_seasons"("eligible_for_rehire");

-- CreateIndex
CREATE INDEX "srm_employee_seasons_is_archived_idx" ON "srm_employee_seasons"("is_archived");

-- CreateIndex
CREATE INDEX "srm_employee_seasons_updated_at_idx" ON "srm_employee_seasons"("updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "srm_employee_seasons_user_id_season_id_key" ON "srm_employee_seasons"("user_id", "season_id");

-- CreateIndex
CREATE INDEX "srm_email_templates_template_type_idx" ON "srm_email_templates"("template_type");

-- CreateIndex
CREATE INDEX "srm_email_templates_is_default_idx" ON "srm_email_templates"("is_default");

-- CreateIndex
CREATE INDEX "srm_email_log_user_id_idx" ON "srm_email_log"("user_id");

-- CreateIndex
CREATE INDEX "srm_email_log_season_id_idx" ON "srm_email_log"("season_id");

-- CreateIndex
CREATE INDEX "srm_email_log_sent_at_idx" ON "srm_email_log"("sent_at");

-- CreateIndex
CREATE INDEX "srm_retention_stats_season_id_idx" ON "srm_retention_stats"("season_id");

-- CreateIndex
CREATE INDEX "srm_retention_stats_calculated_at_idx" ON "srm_retention_stats"("calculated_at");

-- CreateIndex
CREATE UNIQUE INDEX "srm_longevity_rates_work_year_key" ON "srm_longevity_rates"("work_year");

-- CreateIndex
CREATE INDEX "srm_longevity_rates_work_year_idx" ON "srm_longevity_rates"("work_year");

-- CreateIndex
CREATE INDEX "srm_employee_work_years_user_id_idx" ON "srm_employee_work_years"("user_id");

-- CreateIndex
CREATE INDEX "srm_employee_work_years_work_year_idx" ON "srm_employee_work_years"("work_year");

-- CreateIndex
CREATE INDEX "srm_employee_work_years_verified_idx" ON "srm_employee_work_years"("verified");

-- CreateIndex
CREATE UNIQUE INDEX "srm_employee_work_years_user_id_work_year_key" ON "srm_employee_work_years"("user_id", "work_year");

-- CreateIndex
CREATE INDEX "srm_pay_cache_calculated_at_idx" ON "srm_pay_cache"("calculated_at");

-- CreateIndex
CREATE INDEX "pg_job_roles_tier_idx" ON "pg_job_roles"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "pg_locations_name_key" ON "pg_locations"("name");

-- CreateIndex
CREATE INDEX "pg_locations_is_active_idx" ON "pg_locations"("is_active");

-- CreateIndex
CREATE INDEX "pg_locations_sort_order_idx" ON "pg_locations"("sort_order");

-- CreateIndex
CREATE INDEX "pg_user_job_assignments_user_id_idx" ON "pg_user_job_assignments"("user_id");

-- CreateIndex
CREATE INDEX "pg_user_job_assignments_job_role_id_idx" ON "pg_user_job_assignments"("job_role_id");

-- CreateIndex
CREATE INDEX "pg_user_job_assignments_assigned_by_idx" ON "pg_user_job_assignments"("assigned_by");

-- CreateIndex
CREATE INDEX "pg_user_job_assignments_user_id_is_primary_idx" ON "pg_user_job_assignments"("user_id", "is_primary");

-- CreateIndex
CREATE INDEX "pg_user_job_assignments_job_role_id_is_primary_idx" ON "pg_user_job_assignments"("job_role_id", "is_primary");

-- CreateIndex
CREATE UNIQUE INDEX "pg_user_job_assignments_user_id_job_role_id_key" ON "pg_user_job_assignments"("user_id", "job_role_id");

-- CreateIndex
CREATE INDEX "pg_user_metadata_archived_idx" ON "pg_user_metadata"("archived");

-- CreateIndex
CREATE INDEX "pg_user_metadata_is_member_idx" ON "pg_user_metadata"("is_member");

-- CreateIndex
CREATE INDEX "pg_user_metadata_hire_date_idx" ON "pg_user_metadata"("hire_date");

-- CreateIndex
CREATE INDEX "pg_user_metadata_employee_id_idx" ON "pg_user_metadata"("employee_id");

-- CreateIndex
CREATE INDEX "pg_promotion_criteria_job_role_id_idx" ON "pg_promotion_criteria"("job_role_id");

-- CreateIndex
CREATE INDEX "pg_user_progress_user_id_idx" ON "pg_user_progress"("user_id");

-- CreateIndex
CREATE INDEX "pg_user_progress_criterion_id_idx" ON "pg_user_progress"("criterion_id");

-- CreateIndex
CREATE UNIQUE INDEX "pg_user_progress_user_id_criterion_id_key" ON "pg_user_progress"("user_id", "criterion_id");

-- CreateIndex
CREATE INDEX "pg_criterion_activities_criterion_id_idx" ON "pg_criterion_activities"("criterion_id");

-- CreateIndex
CREATE INDEX "pg_criterion_activities_user_id_idx" ON "pg_criterion_activities"("user_id");

-- CreateIndex
CREATE INDEX "pg_criterion_activities_affected_user_id_idx" ON "pg_criterion_activities"("affected_user_id");

-- CreateIndex
CREATE INDEX "pg_criterion_activities_created_at_idx" ON "pg_criterion_activities"("created_at");

-- CreateIndex
CREATE INDEX "pg_inservice_logs_training_date_idx" ON "pg_inservice_logs"("training_date");

-- CreateIndex
CREATE INDEX "pg_inservice_logs_created_by_idx" ON "pg_inservice_logs"("created_by");

-- CreateIndex
CREATE INDEX "pg_inservice_logs_archived_idx" ON "pg_inservice_logs"("archived");

-- CreateIndex
CREATE INDEX "pg_inservice_logs_created_by_training_date_idx" ON "pg_inservice_logs"("created_by", "training_date");

-- CreateIndex
CREATE INDEX "pg_inservice_logs_archived_training_date_idx" ON "pg_inservice_logs"("archived", "training_date");

-- CreateIndex
CREATE INDEX "pg_inservice_attendees_inservice_id_idx" ON "pg_inservice_attendees"("inservice_id");

-- CreateIndex
CREATE INDEX "pg_inservice_attendees_user_id_idx" ON "pg_inservice_attendees"("user_id");

-- CreateIndex
CREATE INDEX "pg_inservice_attendees_attendance_status_idx" ON "pg_inservice_attendees"("attendance_status");

-- CreateIndex
CREATE UNIQUE INDEX "pg_inservice_attendees_inservice_id_user_id_key" ON "pg_inservice_attendees"("inservice_id", "user_id");

-- CreateIndex
CREATE INDEX "pg_inservice_job_roles_inservice_id_idx" ON "pg_inservice_job_roles"("inservice_id");

-- CreateIndex
CREATE INDEX "pg_inservice_job_roles_job_role_id_idx" ON "pg_inservice_job_roles"("job_role_id");

-- CreateIndex
CREATE UNIQUE INDEX "pg_inservice_job_roles_inservice_id_job_role_id_key" ON "pg_inservice_job_roles"("inservice_id", "job_role_id");

-- CreateIndex
CREATE INDEX "pg_inservice_cache_month_idx" ON "pg_inservice_cache"("month");

-- CreateIndex
CREATE INDEX "pg_inservice_cache_calculated_at_idx" ON "pg_inservice_cache"("calculated_at");

-- CreateIndex
CREATE UNIQUE INDEX "pg_inservice_cache_user_id_month_key" ON "pg_inservice_cache"("user_id", "month");

-- CreateIndex
CREATE INDEX "pg_scan_audit_logs_audited_user_id_idx" ON "pg_scan_audit_logs"("audited_user_id");

-- CreateIndex
CREATE INDEX "pg_scan_audit_logs_auditor_id_idx" ON "pg_scan_audit_logs"("auditor_id");

-- CreateIndex
CREATE INDEX "pg_scan_audit_logs_audit_date_idx" ON "pg_scan_audit_logs"("audit_date");

-- CreateIndex
CREATE INDEX "pg_scan_audit_logs_archived_idx" ON "pg_scan_audit_logs"("archived");

-- CreateIndex
CREATE INDEX "pg_cashier_audit_logs_audited_user_id_idx" ON "pg_cashier_audit_logs"("audited_user_id");

-- CreateIndex
CREATE INDEX "pg_cashier_audit_logs_auditor_id_idx" ON "pg_cashier_audit_logs"("auditor_id");

-- CreateIndex
CREATE INDEX "pg_cashier_audit_logs_audit_date_idx" ON "pg_cashier_audit_logs"("audit_date");

-- CreateIndex
CREATE INDEX "pg_cashier_audit_logs_archived_idx" ON "pg_cashier_audit_logs"("archived");

-- CreateIndex
CREATE INDEX "pg_live_recognition_drill_logs_drilled_user_id_idx" ON "pg_live_recognition_drill_logs"("drilled_user_id");

-- CreateIndex
CREATE INDEX "pg_live_recognition_drill_logs_drill_conductor_id_idx" ON "pg_live_recognition_drill_logs"("drill_conductor_id");

-- CreateIndex
CREATE INDEX "pg_live_recognition_drill_logs_drill_date_idx" ON "pg_live_recognition_drill_logs"("drill_date");

-- CreateIndex
CREATE INDEX "pg_live_recognition_drill_logs_archived_idx" ON "pg_live_recognition_drill_logs"("archived");

-- CreateIndex
CREATE INDEX "pg_instructor_evaluation_logs_evaluated_user_id_idx" ON "pg_instructor_evaluation_logs"("evaluated_user_id");

-- CreateIndex
CREATE INDEX "pg_instructor_evaluation_logs_evaluator_id_idx" ON "pg_instructor_evaluation_logs"("evaluator_id");

-- CreateIndex
CREATE INDEX "pg_instructor_evaluation_logs_evaluation_date_idx" ON "pg_instructor_evaluation_logs"("evaluation_date");

-- CreateIndex
CREATE INDEX "pg_instructor_evaluation_logs_archived_idx" ON "pg_instructor_evaluation_logs"("archived");

-- CreateIndex
CREATE INDEX "aqp_taskdecks_created_by_idx" ON "aqp_taskdecks"("created_by");

-- CreateIndex
CREATE INDEX "aqp_taskdecks_is_archived_idx" ON "aqp_taskdecks"("is_archived");

-- CreateIndex
CREATE INDEX "aqp_taskdecks_is_public_idx" ON "aqp_taskdecks"("is_public");

-- CreateIndex
CREATE INDEX "aqp_taskdecks_is_primary_idx" ON "aqp_taskdecks"("is_primary");

-- CreateIndex
CREATE INDEX "aqp_tasklists_deck_id_idx" ON "aqp_tasklists"("deck_id");

-- CreateIndex
CREATE INDEX "aqp_tasklists_sort_order_idx" ON "aqp_tasklists"("sort_order");

-- CreateIndex
CREATE INDEX "aqp_tasklists_deck_id_sort_order_idx" ON "aqp_tasklists"("deck_id", "sort_order");

-- CreateIndex
CREATE INDEX "aqp_taskcards_list_id_idx" ON "aqp_taskcards"("list_id");

-- CreateIndex
CREATE INDEX "aqp_taskcards_created_by_idx" ON "aqp_taskcards"("created_by");

-- CreateIndex
CREATE INDEX "aqp_taskcards_assigned_to_idx" ON "aqp_taskcards"("assigned_to");

-- CreateIndex
CREATE INDEX "aqp_taskcards_assigned_to_role_id_idx" ON "aqp_taskcards"("assigned_to_role_id");

-- CreateIndex
CREATE INDEX "aqp_taskcards_location_id_idx" ON "aqp_taskcards"("location_id");

-- CreateIndex
CREATE INDEX "aqp_taskcards_sort_order_idx" ON "aqp_taskcards"("sort_order");

-- CreateIndex
CREATE INDEX "aqp_taskcards_is_complete_idx" ON "aqp_taskcards"("is_complete");

-- CreateIndex
CREATE INDEX "aqp_taskcards_list_id_is_complete_idx" ON "aqp_taskcards"("list_id", "is_complete");

-- CreateIndex
CREATE INDEX "aqp_taskcards_list_id_sort_order_idx" ON "aqp_taskcards"("list_id", "sort_order");

-- CreateIndex
CREATE INDEX "aqp_taskcards_is_complete_updated_at_idx" ON "aqp_taskcards"("is_complete", "updated_at");

-- CreateIndex
CREATE INDEX "aqp_card_assignees_card_id_idx" ON "aqp_card_assignees"("card_id");

-- CreateIndex
CREATE INDEX "aqp_card_assignees_user_id_idx" ON "aqp_card_assignees"("user_id");

-- CreateIndex
CREATE INDEX "aqp_card_assignees_user_id_card_id_idx" ON "aqp_card_assignees"("user_id", "card_id");

-- CreateIndex
CREATE UNIQUE INDEX "aqp_card_assignees_card_id_user_id_key" ON "aqp_card_assignees"("card_id", "user_id");

-- CreateIndex
CREATE INDEX "aqp_card_assigned_roles_card_id_idx" ON "aqp_card_assigned_roles"("card_id");

-- CreateIndex
CREATE INDEX "aqp_card_assigned_roles_role_id_idx" ON "aqp_card_assigned_roles"("role_id");

-- CreateIndex
CREATE INDEX "aqp_card_assigned_roles_role_id_card_id_idx" ON "aqp_card_assigned_roles"("role_id", "card_id");

-- CreateIndex
CREATE UNIQUE INDEX "aqp_card_assigned_roles_card_id_role_id_key" ON "aqp_card_assigned_roles"("card_id", "role_id");

-- CreateIndex
CREATE INDEX "aqp_card_comments_card_id_idx" ON "aqp_card_comments"("card_id");

-- CreateIndex
CREATE INDEX "aqp_card_comments_user_id_idx" ON "aqp_card_comments"("user_id");

-- CreateIndex
CREATE INDEX "aqp_card_attachments_card_id_idx" ON "aqp_card_attachments"("card_id");

-- CreateIndex
CREATE INDEX "aqp_card_attachments_user_id_idx" ON "aqp_card_attachments"("user_id");

-- CreateIndex
CREATE INDEX "aqp_card_attachments_wp_attachment_id_idx" ON "aqp_card_attachments"("wp_attachment_id");

-- CreateIndex
CREATE INDEX "aqp_card_checklists_card_id_idx" ON "aqp_card_checklists"("card_id");

-- CreateIndex
CREATE INDEX "aqp_card_checklists_sort_order_idx" ON "aqp_card_checklists"("sort_order");

-- CreateIndex
CREATE INDEX "aqp_activity_log_card_id_idx" ON "aqp_activity_log"("card_id");

-- CreateIndex
CREATE INDEX "aqp_activity_log_user_id_idx" ON "aqp_activity_log"("user_id");

-- CreateIndex
CREATE INDEX "aqp_activity_log_created_at_idx" ON "aqp_activity_log"("created_at");

-- CreateIndex
CREATE INDEX "aquaticpro_courses_status_idx" ON "aquaticpro_courses"("status");

-- CreateIndex
CREATE INDEX "aquaticpro_courses_display_order_idx" ON "aquaticpro_courses"("display_order");

-- CreateIndex
CREATE INDEX "aquaticpro_courses_category_idx" ON "aquaticpro_courses"("category");

-- CreateIndex
CREATE INDEX "aquaticpro_lessons_course_id_idx" ON "aquaticpro_lessons"("course_id");

-- CreateIndex
CREATE INDEX "aquaticpro_lessons_section_id_idx" ON "aquaticpro_lessons"("section_id");

-- CreateIndex
CREATE INDEX "aquaticpro_lessons_display_order_idx" ON "aquaticpro_lessons"("display_order");

-- CreateIndex
CREATE INDEX "aquaticpro_lesson_sections_course_id_idx" ON "aquaticpro_lesson_sections"("course_id");

-- CreateIndex
CREATE INDEX "aquaticpro_lesson_sections_display_order_idx" ON "aquaticpro_lesson_sections"("display_order");

-- CreateIndex
CREATE INDEX "aquaticpro_progress_user_id_idx" ON "aquaticpro_progress"("user_id");

-- CreateIndex
CREATE INDEX "aquaticpro_progress_lesson_id_idx" ON "aquaticpro_progress"("lesson_id");

-- CreateIndex
CREATE INDEX "aquaticpro_progress_status_idx" ON "aquaticpro_progress"("status");

-- CreateIndex
CREATE UNIQUE INDEX "aquaticpro_progress_user_id_lesson_id_key" ON "aquaticpro_progress"("user_id", "lesson_id");

-- CreateIndex
CREATE UNIQUE INDEX "aquaticpro_course_categories_name_key" ON "aquaticpro_course_categories"("name");

-- CreateIndex
CREATE INDEX "aquaticpro_course_categories_display_order_idx" ON "aquaticpro_course_categories"("display_order");

-- CreateIndex
CREATE INDEX "mp_wb_lesson_sections_lesson_id_idx" ON "mp_wb_lesson_sections"("lesson_id");

-- CreateIndex
CREATE INDEX "mp_wb_lesson_sections_display_order_idx" ON "mp_wb_lesson_sections"("display_order");

-- CreateIndex
CREATE INDEX "mp_wb_lesson_sections_section_type_idx" ON "mp_wb_lesson_sections"("section_type");

-- CreateIndex
CREATE INDEX "mp_wb_whiteboards_lesson_section_id_idx" ON "mp_wb_whiteboards"("lesson_section_id");

-- CreateIndex
CREATE INDEX "mp_wb_whiteboards_display_order_idx" ON "mp_wb_whiteboards"("display_order");

-- CreateIndex
CREATE UNIQUE INDEX "mp_wb_quizzes_lesson_section_id_key" ON "mp_wb_quizzes"("lesson_section_id");

-- CreateIndex
CREATE INDEX "mp_wb_quiz_questions_quiz_id_idx" ON "mp_wb_quiz_questions"("quiz_id");

-- CreateIndex
CREATE INDEX "mp_wb_quiz_questions_display_order_idx" ON "mp_wb_quiz_questions"("display_order");

-- CreateIndex
CREATE INDEX "mp_wb_lesson_progress_user_id_idx" ON "mp_wb_lesson_progress"("user_id");

-- CreateIndex
CREATE INDEX "mp_wb_lesson_progress_lesson_id_idx" ON "mp_wb_lesson_progress"("lesson_id");

-- CreateIndex
CREATE INDEX "mp_wb_lesson_progress_status_idx" ON "mp_wb_lesson_progress"("status");

-- CreateIndex
CREATE UNIQUE INDEX "mp_wb_lesson_progress_user_id_lesson_id_key" ON "mp_wb_lesson_progress"("user_id", "lesson_id");

-- CreateIndex
CREATE INDEX "mp_wb_section_progress_user_id_idx" ON "mp_wb_section_progress"("user_id");

-- CreateIndex
CREATE INDEX "mp_wb_section_progress_lesson_section_id_idx" ON "mp_wb_section_progress"("lesson_section_id");

-- CreateIndex
CREATE UNIQUE INDEX "mp_wb_section_progress_user_id_lesson_section_id_key" ON "mp_wb_section_progress"("user_id", "lesson_section_id");

-- CreateIndex
CREATE INDEX "mp_wb_quiz_attempts_user_id_idx" ON "mp_wb_quiz_attempts"("user_id");

-- CreateIndex
CREATE INDEX "mp_wb_quiz_attempts_quiz_id_idx" ON "mp_wb_quiz_attempts"("quiz_id");

-- CreateIndex
CREATE INDEX "mp_wb_quiz_attempts_lesson_section_id_idx" ON "mp_wb_quiz_attempts"("lesson_section_id");

-- CreateIndex
CREATE INDEX "mp_wb_quiz_attempts_submitted_at_idx" ON "mp_wb_quiz_attempts"("submitted_at");

-- CreateIndex
CREATE INDEX "aquaticpro_learning_assignments_lesson_id_idx" ON "aquaticpro_learning_assignments"("lesson_id");

-- CreateIndex
CREATE INDEX "aquaticpro_learning_assignments_assigned_by_idx" ON "aquaticpro_learning_assignments"("assigned_by");

-- CreateIndex
CREATE INDEX "aquaticpro_learning_assignments_status_idx" ON "aquaticpro_learning_assignments"("status");

-- CreateIndex
CREATE INDEX "aquaticpro_learning_assignments_due_date_idx" ON "aquaticpro_learning_assignments"("due_date");

-- CreateIndex
CREATE INDEX "aquaticpro_learning_assignment_users_assignment_id_idx" ON "aquaticpro_learning_assignment_users"("assignment_id");

-- CreateIndex
CREATE INDEX "aquaticpro_learning_assignment_users_user_id_idx" ON "aquaticpro_learning_assignment_users"("user_id");

-- CreateIndex
CREATE INDEX "aquaticpro_learning_assignment_users_progress_status_idx" ON "aquaticpro_learning_assignment_users"("progress_status");

-- CreateIndex
CREATE INDEX "aquaticpro_learning_assignment_users_email_status_idx" ON "aquaticpro_learning_assignment_users"("email_status");

-- CreateIndex
CREATE UNIQUE INDEX "aquaticpro_learning_assignment_users_assignment_id_user_id_key" ON "aquaticpro_learning_assignment_users"("assignment_id", "user_id");

-- CreateIndex
CREATE INDEX "aquaticpro_email_queue_status_idx" ON "aquaticpro_email_queue"("status");

-- CreateIndex
CREATE INDEX "aquaticpro_email_queue_email_type_idx" ON "aquaticpro_email_queue"("email_type");

-- CreateIndex
CREATE INDEX "aquaticpro_course_auto_assign_rules_course_id_idx" ON "aquaticpro_course_auto_assign_rules"("course_id");

-- CreateIndex
CREATE INDEX "aquaticpro_course_auto_assign_rules_job_role_id_idx" ON "aquaticpro_course_auto_assign_rules"("job_role_id");

-- CreateIndex
CREATE UNIQUE INDEX "aquaticpro_course_auto_assign_rules_course_id_job_role_id_key" ON "aquaticpro_course_auto_assign_rules"("course_id", "job_role_id");

-- CreateIndex
CREATE INDEX "aquaticpro_course_assignments_course_id_idx" ON "aquaticpro_course_assignments"("course_id");

-- CreateIndex
CREATE INDEX "aquaticpro_course_assignments_user_id_idx" ON "aquaticpro_course_assignments"("user_id");

-- CreateIndex
CREATE INDEX "aquaticpro_course_assignments_rule_id_idx" ON "aquaticpro_course_assignments"("rule_id");

-- CreateIndex
CREATE INDEX "aquaticpro_course_assignments_status_idx" ON "aquaticpro_course_assignments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "aquaticpro_course_assignments_course_id_user_id_key" ON "aquaticpro_course_assignments"("course_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "mp_mileage_settings_setting_key_key" ON "mp_mileage_settings"("setting_key");

-- CreateIndex
CREATE INDEX "mp_mileage_entries_user_id_trip_date_idx" ON "mp_mileage_entries"("user_id", "trip_date");

-- CreateIndex
CREATE INDEX "mp_mileage_entries_trip_date_idx" ON "mp_mileage_entries"("trip_date");

-- CreateIndex
CREATE INDEX "mp_mileage_entries_submitted_for_payment_idx" ON "mp_mileage_entries"("submitted_for_payment");

-- CreateIndex
CREATE INDEX "mp_mileage_entry_stops_entry_id_idx" ON "mp_mileage_entry_stops"("entry_id");

-- CreateIndex
CREATE INDEX "aquaticpro_email_composer_templates_created_by_idx" ON "aquaticpro_email_composer_templates"("created_by");

-- CreateIndex
CREATE INDEX "aquaticpro_email_composer_log_sent_by_idx" ON "aquaticpro_email_composer_log"("sent_by");

-- CreateIndex
CREATE INDEX "aquaticpro_email_composer_log_sent_at_idx" ON "aquaticpro_email_composer_log"("sent_at");

-- CreateIndex
CREATE INDEX "aquaticpro_certificate_types_is_active_idx" ON "aquaticpro_certificate_types"("is_active");

-- CreateIndex
CREATE INDEX "aquaticpro_certificate_types_sort_order_idx" ON "aquaticpro_certificate_types"("sort_order");

-- CreateIndex
CREATE INDEX "aquaticpro_user_certificates_user_id_idx" ON "aquaticpro_user_certificates"("user_id");

-- CreateIndex
CREATE INDEX "aquaticpro_user_certificates_certificate_type_id_idx" ON "aquaticpro_user_certificates"("certificate_type_id");

-- CreateIndex
CREATE INDEX "aquaticpro_user_certificates_status_idx" ON "aquaticpro_user_certificates"("status");

-- CreateIndex
CREATE INDEX "aquaticpro_user_certificates_expiration_date_idx" ON "aquaticpro_user_certificates"("expiration_date");

-- CreateIndex
CREATE UNIQUE INDEX "aquaticpro_user_certificates_user_id_certificate_type_id_key" ON "aquaticpro_user_certificates"("user_id", "certificate_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "aquaticpro_cert_role_requirements_certificate_type_id_job_r_key" ON "aquaticpro_cert_role_requirements"("certificate_type_id", "job_role_id");

-- CreateIndex
CREATE INDEX "aquaticpro_new_hires_email_idx" ON "aquaticpro_new_hires"("email");

-- CreateIndex
CREATE INDEX "aquaticpro_new_hires_status_idx" ON "aquaticpro_new_hires"("status");

-- CreateIndex
CREATE INDEX "aquaticpro_new_hires_needs_work_permit_idx" ON "aquaticpro_new_hires"("needs_work_permit");

-- CreateIndex
CREATE INDEX "aquaticpro_new_hires_position_idx" ON "aquaticpro_new_hires"("position");

-- CreateIndex
CREATE INDEX "aquaticpro_new_hires_is_archived_idx" ON "aquaticpro_new_hires"("is_archived");

-- CreateIndex
CREATE INDEX "mp_audit_log_user_id_idx" ON "mp_audit_log"("user_id");

-- CreateIndex
CREATE INDEX "mp_audit_log_action_idx" ON "mp_audit_log"("action");

-- CreateIndex
CREATE INDEX "mp_audit_log_resource_type_resource_id_idx" ON "mp_audit_log"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "mp_audit_log_created_at_idx" ON "mp_audit_log"("created_at");

-- CreateIndex
CREATE INDEX "mp_audit_log_ip_address_idx" ON "mp_audit_log"("ip_address");

-- CreateIndex
CREATE INDEX "aqp_dashboard_action_buttons_sort_order_idx" ON "aqp_dashboard_action_buttons"("sort_order");

-- CreateIndex
CREATE INDEX "mentorship_notifications_user_id_idx" ON "mentorship_notifications"("user_id");

-- CreateIndex
CREATE INDEX "mp_requests_author_id_idx" ON "mp_requests"("author_id");

-- CreateIndex
CREATE INDEX "mp_requests_receiver_id_idx" ON "mp_requests"("receiver_id");

-- CreateIndex
CREATE INDEX "mp_requests_status_idx" ON "mp_requests"("status");

-- CreateIndex
CREATE INDEX "mp_goals_mentorship_id_idx" ON "mp_goals"("mentorship_id");

-- CreateIndex
CREATE INDEX "mp_goals_author_id_idx" ON "mp_goals"("author_id");

-- CreateIndex
CREATE INDEX "mp_initiatives_goal_id_idx" ON "mp_initiatives"("goal_id");

-- CreateIndex
CREATE INDEX "mp_tasks_goal_id_idx" ON "mp_tasks"("goal_id");

-- CreateIndex
CREATE INDEX "mp_tasks_initiative_id_idx" ON "mp_tasks"("initiative_id");

-- CreateIndex
CREATE INDEX "mp_meetings_goal_id_idx" ON "mp_meetings"("goal_id");

-- CreateIndex
CREATE INDEX "mp_meetings_initiative_id_idx" ON "mp_meetings"("initiative_id");

-- CreateIndex
CREATE INDEX "mp_updates_goal_id_idx" ON "mp_updates"("goal_id");

-- CreateIndex
CREATE INDEX "lm_swimmers_archived_idx" ON "lm_swimmers"("archived");

-- CreateIndex
CREATE INDEX "lm_groups_archived_idx" ON "lm_groups"("archived");

-- CreateIndex
CREATE INDEX "lm_groups_year_idx" ON "lm_groups"("year");

-- CreateIndex
CREATE INDEX "lm_evaluations_swimmer_id_idx" ON "lm_evaluations"("swimmer_id");
