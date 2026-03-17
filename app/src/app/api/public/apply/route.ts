import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { created, badRequest, serverError, parseBody } from "@/lib/utils/api-helpers";

const VALID_POSITIONS = [
  "Lifeguard",
  "Head Lifeguard",
  "Swim Instructor",
  "Head Swim Instructor / Lesson Coordinator",
  "Pool Cashier",
  "Camp Counselor",
  "Camp Director",
  "Aquatics Director",
  "Other",
] as const;

export const dynamic = "force-dynamic";

/** POST /api/public/apply — Submit a new-hire application (no auth required). */
export async function POST(request: NextRequest) {
  try {
    const body = await parseBody(request) as Record<string, unknown>;
    if (!body) return badRequest("Invalid JSON.");

    // Check if applications are open
    const setting = await prisma.appSetting.findUnique({
      where: { key: "aquaticpro_is_accepting" },
    });
    if (
      setting?.value === "0" ||
      setting?.value === "false" ||
      setting?.value === "closed"
    ) {
      return badRequest(
        "Applications are not currently being accepted. Please check back later."
      );
    }

    // Validate required fields
    const { firstName, lastName, email, phone, dateOfBirth, address, position, needsWorkPermit } =
      body as { firstName?: string; lastName?: string; email?: string; phone?: string; dateOfBirth?: string; address?: string; position?: string; needsWorkPermit?: boolean | string };

    if (!firstName?.trim()) return badRequest("First name is required.");
    if (!lastName?.trim()) return badRequest("Last name is required.");
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email?.trim() || !emailRe.test(email)) return badRequest("A valid email is required.");
    if (!position?.trim()) return badRequest("Position is required.");

    // Prevent duplicate active applications
    const existing = await prisma.aquaticproNewHire.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        status: { notIn: ["rejected", "withdrawn"] },
        isArchived: false,
      },
    });
    if (existing) {
      return badRequest(
        "An application with that email address already exists. If you have questions, please contact us directly."
      );
    }

    const hire = await prisma.aquaticproNewHire.create({
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.toLowerCase().trim(),
        phone: phone?.trim() ?? "",
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        address: address?.trim() ?? "",
        position: position.trim(),
        needsWorkPermit: needsWorkPermit === true || needsWorkPermit === "true",
        status: "pending",
      },
    });

    return created({
      id: hire.id,
      message: "Your application has been submitted successfully. We will be in touch soon!",
    });
  } catch (e) {
    return serverError(e);
  }
}
