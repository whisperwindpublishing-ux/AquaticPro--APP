/**
 * AquaticPro — Database Seed
 *
 * Creates a full tier-6 admin test account in both Supabase Auth
 * and the application database, with all module permissions enabled.
 *
 * Usage:
 *   npm run seed
 *
 * Requires .env.local to be populated with real Supabase credentials.
 */

import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";
import * as path from "path";

// Load env — try .env.local first, fall back to .env
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ─── Config ───────────────────────────────────────────────────────────────────

const TEST_USER = {
  email: "jeffrey.napolski+test@gmail.com",
  password: "Youonly1",
  firstName: "Jeff",
  lastName: "Test",
  displayName: "Jeff Test",
};

const ADMIN_JOB_ROLE = {
  title: "Director / Admin",
  tier: 6,
  description: "Full platform administration",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name} — did you create .env.local?`);
  return v;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 AquaticPro seed starting…\n");

  // Supabase admin client (needs service role key)
  const supabase = createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // ── 1. Supabase Auth user ──────────────────────────────────────────────────
  console.log(`📧 Creating Supabase auth user: ${TEST_USER.email}`);

  let supabaseUid: string;

  // Try to look up existing user first
  const { data: existingList } = await supabase.auth.admin.listUsers();
  const existing = existingList?.users?.find(
    (u) => u.email === TEST_USER.email
  );

  if (existing) {
    supabaseUid = existing.id;
    // Update password in case it changed
    await supabase.auth.admin.updateUserById(supabaseUid, {
      password: TEST_USER.password,
      email_confirm: true,
    });
    console.log(`   ↳ Auth user already exists (uid: ${supabaseUid}) — password updated.`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: TEST_USER.email,
      password: TEST_USER.password,
      email_confirm: true,
    });
    if (error || !data?.user) {
      throw new Error(`Failed to create Supabase auth user: ${error?.message}`);
    }
    supabaseUid = data.user.id;
    console.log(`   ↳ Created. (uid: ${supabaseUid})`);
  }

  // ── 2. App settings ────────────────────────────────────────────────────────
  console.log("\n⚙️  Ensuring app settings…");
  await prisma.appSetting.upsert({
    where: { key: "aquaticpro_app_admin_tier" },
    create: { key: "aquaticpro_app_admin_tier", value: "6" },
    update: { value: "6" },
  });
  console.log("   ↳ aquaticpro_app_admin_tier = 6");

  // ── 3. Tier-6 job role ──────────────────────────────────────────────────────
  console.log("\n🏷️  Upserting tier-6 job role…");
  const jobRole = await prisma.pgJobRole.upsert({
    where: { id: 1 },
    create: ADMIN_JOB_ROLE,
    update: ADMIN_JOB_ROLE,
  });
  console.log(`   ↳ PgJobRole #${jobRole.id}: "${jobRole.title}" (tier ${jobRole.tier})`);

  // ── 4. DB user row ──────────────────────────────────────────────────────────
  console.log("\n👤 Upserting User row…");
  const dbUser = await prisma.user.upsert({
    where: { supabaseUid },
    create: {
      supabaseUid,
      email: TEST_USER.email,
      displayName: TEST_USER.displayName,
      firstName: TEST_USER.firstName,
      lastName: TEST_USER.lastName,
      isMember: true,
      isArchived: false,
    },
    update: {
      email: TEST_USER.email,
      displayName: TEST_USER.displayName,
      firstName: TEST_USER.firstName,
      lastName: TEST_USER.lastName,
      isMember: true,
      isArchived: false,
    },
  });
  console.log(`   ↳ User #${dbUser.id}: ${dbUser.displayName} <${dbUser.email}>`);

  // ── 5. Job role assignment ──────────────────────────────────────────────────
  console.log("\n🔗 Assigning tier-6 role to user…");
  await prisma.pgUserJobAssignment.upsert({
    where: { userId_jobRoleId: { userId: dbUser.id, jobRoleId: jobRole.id } },
    create: {
      userId: dbUser.id,
      jobRoleId: jobRole.id,
      isPrimary: true,
      assignedDate: new Date(),
    },
    update: { isPrimary: true },
  });
  console.log(`   ↳ User #${dbUser.id} → Role #${jobRole.id}`);

  // ── 6. Permission rows (all flags true) ─────────────────────────────────────
  console.log("\n🔐 Creating permission rows (all flags enabled)…");

  const rId = jobRole.id;

  await Promise.all([
    prisma.mpDailyLogPermission.upsert({
      where: { jobRoleId: rId },
      create:  { jobRoleId: rId, canView: true, canCreate: true, canEdit: true, canDelete: true, canModerateAll: true },
      update:  { canView: true, canCreate: true, canEdit: true, canDelete: true, canModerateAll: true },
    }),
    prisma.pgLmsPermission.upsert({
      where: { jobRoleId: rId },
      create:  { jobRoleId: rId, canViewCourses: true, canViewLessons: true, canCreateCourses: true, canEditCourses: true, canDeleteCourses: true, canCreateLessons: true, canEditLessons: true, canDeleteLessons: true, canManageHotspots: true, canManageExcalidraw: true, canModerateAll: true },
      update:  { canViewCourses: true, canViewLessons: true, canCreateCourses: true, canEditCourses: true, canDeleteCourses: true, canCreateLessons: true, canEditLessons: true, canDeleteLessons: true, canManageHotspots: true, canManageExcalidraw: true, canModerateAll: true },
    }),
    prisma.pgTaskdeckPermission.upsert({
      where: { jobRoleId: rId },
      create:  { jobRoleId: rId, canView: true, canViewOnlyAssigned: false, canCreate: true, canEdit: true, canDelete: true, canModerateAll: true, canManagePrimaryDeck: true, canManageAllPrimaryCards: true, canCreatePublicDecks: true },
      update:  { canView: true, canViewOnlyAssigned: false, canCreate: true, canEdit: true, canDelete: true, canModerateAll: true, canManagePrimaryDeck: true, canManageAllPrimaryCards: true, canCreatePublicDecks: true },
    }),
    prisma.srmPermission.upsert({
      where: { jobRoleId: rId },
      create:  { jobRoleId: rId, srmViewOwnPay: true, srmViewAllPay: true, srmManagePayConfig: true, srmSendInvites: true, srmViewResponses: true, srmManageStatus: true, srmManageTemplates: true, srmViewRetention: true, srmBulkActions: true },
      update:  { srmViewOwnPay: true, srmViewAllPay: true, srmManagePayConfig: true, srmSendInvites: true, srmViewResponses: true, srmManageStatus: true, srmManageTemplates: true, srmViewRetention: true, srmBulkActions: true },
    }),
    prisma.awesomeAwardsPermission.upsert({
      where: { jobRoleId: rId },
      create:  { jobRoleId: rId, canNominate: true, canVote: true, canApprove: true, canDirectAssign: true, canManagePeriods: true, canViewNominations: true, canViewWinners: true, canViewArchives: true, canArchive: true },
      update:  { canNominate: true, canVote: true, canApprove: true, canDirectAssign: true, canManagePeriods: true, canViewNominations: true, canViewWinners: true, canViewArchives: true, canArchive: true },
    }),
    prisma.mpMileagePermission.upsert({
      where: { jobRoleId: rId },
      create:  { jobRoleId: rId, canSubmit: true, canViewAll: true, canManage: true },
      update:  { canSubmit: true, canViewAll: true, canManage: true },
    }),
    prisma.pgEmailPermission.upsert({
      where: { jobRoleId: rId },
      create:  { jobRoleId: rId, canSendEmail: true, canManageTemplates: true, canViewHistory: true },
      update:  { canSendEmail: true, canManageTemplates: true, canViewHistory: true },
    }),
    prisma.pgLessonManagementPermission.upsert({
      where: { jobRoleId: rId },
      create:  { jobRoleId: rId, canView: true, canCreate: true, canEdit: true, canDelete: true, canModerateAll: true },
      update:  { canView: true, canCreate: true, canEdit: true, canDelete: true, canModerateAll: true },
    }),
  ]);

  console.log("   ↳ All 8 permission tables seeded with full access.");

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`
✅ Seed complete!

  Email:    ${TEST_USER.email}
  Password: ${TEST_USER.password}
  Role:     ${ADMIN_JOB_ROLE.title} (Tier ${ADMIN_JOB_ROLE.tier})
  DB User:  #${dbUser.id}
  Admin:    yes (tier 6 ≥ admin threshold 6)

  Run the app: npm run dev
  Then visit:  http://localhost:3000/login
`);
}

main()
  .catch((e) => {
    console.error("\n❌ Seed failed:", e.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
