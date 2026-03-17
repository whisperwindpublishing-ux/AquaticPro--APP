import { prisma } from "@/lib/prisma";
import { cached } from "@/lib/cache/redis";
import { forbidden } from "@/lib/utils/api-helpers";
import type { SessionUser } from "./session";

/**
 * Permission resolution — replaces WordPress tier checks, mp_is_plugin_admin(),
 * and per-module permission table lookups.
 *
 * TODO Phase 2: implement full tier + per-module resolution from:
 *   - pg_job_roles (tier 1-6)
 *   - pg_user_job_assignments (user → role mapping)
 *   - mp_daily_log_permissions, pg_scan_audit_permissions, etc.
 */

export interface UserPermissions {
  isAdmin: boolean;       // isWpAdmin OR tier >= 6
  tier: number;           // Max tier across all job role assignments (1-6)
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

/**
 * Resolve full permissions for a user.
 * Results are cached in Redis for 5 minutes.
 */
export async function resolvePermissions(userId: number): Promise<UserPermissions> {
  return cached(
    `permissions:${userId}`,
    async () => {
      // TODO Phase 2: query pg_user_job_assignments → pg_job_roles for tier
      // For now, return safe defaults — admins must be marked isWpAdmin in DB
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { isWpAdmin: true },
      });

      const isAdmin = user?.isWpAdmin ?? false;

      return {
        isAdmin,
        tier: isAdmin ? 6 : 1,
        modules: {
          dailyLogs: true,
          professionalGrowth: true,
          taskdeck: true,
          awesomeAwards: true,
          seasonalReturns: true,
          mileage: true,
          certificates: true,
          lms: true,
          whiteboard: true,
          newHires: isAdmin,
          emailComposer: isAdmin,
          foiaExport: isAdmin,
          lessonManagement: true,
        },
      };
    },
    300 // 5 min cache
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
export async function requireTier(user: SessionUser, minTier: number): Promise<
  [UserPermissions, null] | [null, ReturnType<typeof forbidden>]
> {
  const perms = await resolvePermissions(user.id);
  if (perms.tier < minTier) return [null, forbidden(`Tier ${minTier}+ required`)];
  return [perms, null];
}
