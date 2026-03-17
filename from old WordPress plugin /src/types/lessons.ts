/**
 * TypeScript types for the Lesson Management module
 * @package AquaticPro
 */

// ============================================================================
// Core Entities
// ============================================================================

export interface Swimmer {
  id: number;
  title: { rendered: string };
  meta: {
    parent_name: string;
    parent_email: string;
    date_of_birth: string;
    dob?: string; // Alias for date_of_birth used in some contexts
    notes: string;
    current_level: number | '';
    levels_mastered: number[];
    skills_mastered: SkillMastery[];
    evaluations: number[];
    archived?: boolean;
  };
  modified_gmt: string;
  date?: string; // WordPress post date
  status: 'publish' | 'draft' | 'trash';
}

export interface SkillMastery {
  skill_id: number;
  date: string; // ISO date string
}

export interface Level {
  id: number;
  title: { rendered: string };
  // Extended fields that may be included from API
  name?: string;
  color?: string;
  meta: {
    sort_order: number;
    related_skills: number[];
    group_class: number[];
    swimmers_mastered: number[];
    evaluated: number[];
  };
}

export interface Skill {
  id: number;
  title: { rendered: string };
  meta: {
    sort_order: number;
    level_associated: number;
    swimmer_skilled: number[];
  };
}

export interface Group {
  id: number;
  title: { rendered: string };
  meta: {
    level: number | '';
    instructor: number[];
    swimmers: number[];
    swimmer_grouping: Record<string, number[]>;
    days: string[];
    group_time: string;
    dates_offered: string[];
    notes: string;
    media: number;
    archived: boolean;
    year: number;
  };
  lm_camp: number[];
  lm_animal: number[];
  lm_lesson_type: number[];
  modified_gmt: string;
  status: 'publish' | 'draft' | 'trash';
}

export interface Evaluation {
  id: number;
  title: { rendered: string };
  content: { rendered: string };
  date: string; // WordPress post date
  meta: {
    swimmer: number;
    level_evaluated: number;
    emailed: boolean;
    archived?: boolean;
    content?: string; // Evaluation content (may also be in main content field)
  };
  swimmer_name?: string; // Added via REST field
  author?: number; // WordPress post_author ID
  author_name?: string; // Author display name (added via REST field)
  modified_gmt: string;
  status: 'publish' | 'draft' | 'trash';
}

// ============================================================================
// Taxonomies
// ============================================================================

export interface Camp {
  id: number;
  name: string;
  slug: string;
  description: string;
  count: number;
}

export interface Animal {
  id: number;
  name: string;
  slug: string;
  description: string;
  count: number;
}

export interface LessonType {
  id: number;
  name: string;
  slug: string;
  description: string;
  count: number;
}

// ============================================================================
// UI State Types
// ============================================================================

export type LessonTab = 'groups' | 'swimmers' | 'evaluations' | 'settings';

export type SettingsSubTab = 'levels' | 'skills' | 'camps' | 'animals' | 'lesson-types';

// ============================================================================
// API Response Types
// ============================================================================

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  totalPages: number;
  total: number;
}

export interface EssentialData {
  levels: Level[];
  skills: Skill[];
  camps: Camp[];
  animals: Animal[];
  lessonTypes: LessonType[];
  swimmerCount: number;
  groupCount: number;
  evaluationCount: number;
}

export interface PublicRosterGroup {
  id: number;
  title: string;
  level: string;
  level_id: number | null;
  instructors: { id: number; name: string }[];
  swimmers: { id: number; name: string }[];
  swimmer_count: number;
  time: string;
  days: string[];
  camps: { id: number; name: string; slug: string }[];
  animals: { id: number; name: string; slug: string }[];
}

export interface PublicRosterResponse {
  groups: PublicRosterGroup[];
  camps: Camp[];
}

export interface RosterPasswordResponse {
  success: boolean;
  token: string;
  expires: number;
}

export interface RosterTokenValidation {
  valid: boolean;
}

// ============================================================================
// Lock Types (for conflict detection)
// ============================================================================

export interface LockStatus {
  locked: boolean;
  locked_by?: string;
  locked_by_id?: number;
}

export interface ConflictError {
  code: 'conflict_detected';
  message: string;
  data: {
    status: 409;
    current_modified: string;
    modified_by: string;
  };
}

// ============================================================================
// Form Types
// ============================================================================

export interface SwimmerFormData {
  title: string;
  parent_name: string;
  parent_email: string;
  date_of_birth: string;
  notes: string;
  current_level: number | '';
}

export interface GroupFormData {
  title: string;
  level: number | '';
  instructor: number[];
  swimmers: number[];
  days: string[];
  group_time: string;
  notes: string;
  lm_camp: number[];
  lm_animal: number[];
  lm_lesson_type: number[];
}

export interface EvaluationFormData {
  title: string;
  content: string;
  swimmer: number;
  level_evaluated: number;
}

export interface LevelFormData {
  title: string;
  sort_order: number;
}

export interface SkillFormData {
  title: string;
  sort_order: number;
  level_associated: number;
}

// ============================================================================
// Instructor Type (WordPress User)
// ============================================================================

export interface Instructor {
  id: number;
  name: string;
  email: string;
  avatar_url?: string;
}
