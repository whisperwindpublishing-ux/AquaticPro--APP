import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, notFound, serverError } from "@/lib/utils/api-helpers";

export const dynamic = "force-dynamic";

/** GET /api/public/swimmer/[token] — Load a swimmer's progress (no auth). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const swimmer = await prisma.lmSwimmer.findFirst({
      where: { evaluationToken: token, archived: false },
    });
    if (!swimmer) return notFound("Invalid or expired swimmer progress link.");
    if (swimmer.evaluationTokenExp && swimmer.evaluationTokenExp < new Date()) {
      return notFound("This swimmer progress link has expired. Please ask your instructor for a new link.");
    }

    // Load all levels and skills
    const [levels, skills] = await Promise.all([
      prisma.lmLevel.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.lmSkill.findMany({ orderBy: { sortOrder: "asc" } }),
    ]);

    // Parse mastered sets from JSON
    let skillsMastered: { skillId: number; date: string }[] = [];
    let levelsMastered: number[] = [];
    try {
      if (swimmer.skillsMastered) skillsMastered = JSON.parse(swimmer.skillsMastered);
      if (swimmer.levelsMastered) levelsMastered = JSON.parse(swimmer.levelsMastered);
    } catch { /* ignore */ }

    const masteredSkillIds = new Set(skillsMastered.map((s) => s.skillId));
    const masteredLevelIds = new Set(levelsMastered);

    return ok({
      swimmer: {
        id: swimmer.id,
        name: swimmer.title,
        parentName: swimmer.parentName,
        dateOfBirth: swimmer.dateOfBirth?.toISOString() ?? null,
        currentLevel: swimmer.currentLevel,
        notes: swimmer.notes,
      },
      levels: levels.map((level) => {
        const levelSkills = skills.filter((s) => s.levelAssociated === level.id);
        return {
          id: level.id,
          title: level.title,
          sortOrder: level.sortOrder,
          mastered: masteredLevelIds.has(level.id),
          skills: levelSkills.map((skill) => {
            const mastery = skillsMastered.find((s) => s.skillId === skill.id);
            return {
              id: skill.id,
              title: skill.title,
              mastered: masteredSkillIds.has(skill.id),
              masteredDate: mastery?.date ?? null,
            };
          }),
        };
      }),
    });
  } catch (e) {
    return serverError(e);
  }
}
