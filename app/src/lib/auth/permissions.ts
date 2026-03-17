import { prisma } from "@/lib/prisma";
import { cached } from "@/lib/cache/redis";
import { forbidden } from "@/lib/utils/api-helpers";
import type { SessionUser } from "./session";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UserPermissions {
  /** true when the user's max tier meets or exceeds the aquaticpro_app_admin_tier threshold */
  isAdmin: boolean;
  /** highest tier (1-6) across all pg_user_job_assignments → pg_job_roles */
  tier: number;
  /** per-module access flags derived from the job-role permission tables */
  modules: {
    dailyLogs: boolean;
    professionalGrowth: boolean;
    taskdeck: boolean;
    awesomeAwards: boolean;
    seasonalReturns: boolean;
    mileage: boolean;
    certificates: boolean;
    lms: boolean;
    whiteboard: boolean;
    newHires: boolean;
    emailComposer: boolean;
    foiaExport: boolean;
    lessonManagement: boolean;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** true if any record in arr satisfies pred */
function any<T>(arr: T[], pred: (x: T) => boolean): boolean {
  return arr.some(pred);
}

/** Returns all-false modules — used when user has no job role assignments */
function noAccess(): UserPermissions["modules"] {
  return {
    dailyLogs: false,
    professionalGrowth: false,
    taskdeck: false,
    awesomeAwards: false,
    seasonalReturns: false,
    mileage: false,
    certificates: false,
    lms: false,
    whiteboard: false,
    newHires: false,
    emailComposer: false,
    foiaExport: false,
    lessonManagement: false,
  };
}

/** Fetch max tier across a list of job role IDs. Returns 0 if none. */
async function maxTierForRoles(jobRoleIds: number[]): Promise<number> {
  if (jobRoleIds.length === 0) return 0;
  const roles = await prisma.pgJobRole.findMany({
    where: { id: { in: jobRoleIds } },
    select: { tier: true },
  });
  return roles.reduce((max, r) => Math.max(max, r.tier), 0);
}

// ─── Core resolver ────────────────────────────────────────────────────────────

/**
 * Resolve full permissions for a user.
 *
 * Algorithm:
 *  1. Load all pg_user_job_assignments for the user → collect jobRoleIds
 *  2. Query pg_job_roles to find the user's max tier (1-6)
 *  3. Read aquaticpro_app_admin_tier from app_settings (default: 6)
 *  4. isAdmin = maxTier >= adminTier
 *  5. For each module, query its permission table keyed by jobRoleId and
 *     aggregate across all of the user's roles using OR logic
 *
 * Results are cached in Redis for 5 minutes per user.
 */
export async function resolvePermissions(userId: number): Promise<UserPermissions> {
  return cached(
    `permissions:${userId}`,
    async () => {
      // 1. Get all job role IDs for this user
      const assignments = await prisma.pgUserJobAssignment.findMany({
        where: { userId },
        select: { jobRoleId: true },
      });
      const jobRoleIds = assignments.map((a) => a.jobRoleId);

      // 2. Determine max tier
      const tier = await maxTierForRoles(jobRoleIds);

      // 3. Get admin threshold from app_settings
      const adminTierSetting = await prisma.appSetting.findUnique({
        where: { key: "aquaticpro_app_admin_tier" },
        select: { value: true },
      });
      const adminTier = parseInt(adminTierSetting?.value ?? "6", 10);
      const isAdmin = tier >= adminTier;

      // Fast-path: no role assignments → completely locked out
      if (jobRoleIds.length === 0) {
        return { isAdmin: false, tier: 0, modules: noAccess() };
      }

      // 4. Fetch per-module permission rows in parallel
      const [
        dailyLogPerms,
        lmsPerms,
        taskdeckPerms,
        srmPerms,
        awardsPerms,
        mileagePerms,
        emailPerms,
        lessonMgmtPerms,
      ] = await Promise.all([
        prisma.mpDailyLogPermission.findMany({
          where: { jobRoleId: { in: jobRoleIds } },
        }),
        prisma.pgLmsPermission.findMany({
          where: { jobRoleId: { in: jobRoleIds } },
        }),
        prisma.pgTaskdeckPermission.findMany({
          where: { jobRoleId: { in: jobRoleIds } },
        }),
        prisma.srmPermission.findMany({
          where: { jobRoleId: { in: jobRoleIds } },
        }),
        prisma.awesomeAwardsPermission.findMany({
          where: { jobRoleId: { in: jobRoleIds } },
        }),
        prisma.mpMileagePermission.findMany({
          where: { jobRoleId: { in: jobRoleIds } },
        }),
        prisma.pgEmailPermission.findMany({
          where: { jobRoleId: { in: jobRoleIds } },
        }),
        prisma.pgLessonManagementPermission.findMany({
          where: { jobRoleId: { in: jobRoleIds } },
        }),
      ]);

      // 5. Build module flags — OR logic across all assigned roles
      return {
        isAdmin,
        tier,
        modules: {
          // Daily Logs: any role record with canView
          dailyLogs: any(dailyLogPerms, (p) => p.canView),

          // Professional Growth: all assigned staff (tier ≥ 1), admin gets full access
          professionalGrowth: tier >= 1,

          // TaskDeck: any role record with canView
          taskdeck: any(taskdeckPerms, (p) => p.canView),

          // Awesome Awards: can nominate or vote
          awesomeAwards:
            any(awardsPerms, (p) => p.canNominate) ||
            any(awardsPerms, (p) => p.canVote),

          // Seasonal Returns: can view own pay
          seasonalReturns: any(srmPerms, (p) => p.srmViewOwnPay),

          // Mileage: can submit entries
          mileage: any(mileagePerms, (p) => p.canSubmit),

          // Certificates: all active staff can see their own certs (tier ≥ 1)
          certificates: tier >= 1,

          // LMS: can view courses
          lms: any(lmsPerms, (p) => p.canViewCourses),

          // Whiteboard: tied to lesson management viewing
          whiteboard: any(lessonMgmtPerms, (p) => p.canView),

          // New Hires: admin-only
          newHires: isAdmin,

          // Email Composer: explicit per-role grant
          emailComposer: any(emailPerms, (p) => p.canSendEmail),

          // FOIA Export: admin-only
          foiaExport: isAdmin,

          // Lesson Management: can view lessons/courses in editor
          lessonManagement: any(lessonMgmtPerms, (p) => p.canView),
        },
      };
    },
    300 // 5 min TTL
  );
}

// ─── Guard helpers ────────────────────────────────────────────────────────────

/**
 * Invalidate cached permissions for a user (call after role assignment changes).
 */
export function invalidatePermissions(userId: number): Promise<void> {
  // Import lazily to avoid circular dep issues at module load time
  return import("@/lib/cache/redis").then(({ invalidateCachePrefix }) =>
    invalidateCachePrefix(`permissions:${userId}`)
  );
}

/**
 * Require admin — returns [perms, null] or [null, errorResponse].
 */
export async function requireAdmin(user: SessionUser): Promise<
  [UserPermissions, null] | [null, ReturnType<typeof forbidden>]
> {
  const perms = await resolvePermissions(user.id);
  if (!perms.isAdmin) return [null, forbidden("Admin access required")];
  return [perms, null];
}

/**
 * Require minimum tier level.
 */
export async function requireTier(
  user: SessionUser,
  minTier: number
): Promise<[UserPermissions, null] | [null, ReturnType<typeof forbidden>]> {
  const perms = await resolvePermissions(user.id);
  if (perms.tier < minTier) return [null, forbidden(`Tier ${minTier}+ required`)];
  return [perms, null];
}

/**
 * Require access to a specific module — returns [perms, null] or [null, 403].
 */
export async function requireModule(
  user: SessionUser,
  module: keyof UserPermissions["modules"]
): Promise<[UserPermissions, null] | [null, ReturnType<typeof forbidden>]> {
  const perms = await resolvePermissions(user.id);
  if (!perms.modules[module])
    return [null, forbidden(`${module} access required`)];
  return [perms, null];
}
