import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { resolvePermissions } from "@/lib/auth/permissions";
import { ok, created, badRequest, forbidden, serverError, notFound, parseBody } from "@/lib/utils/api-helpers";

/** GET /api/taskdeck  Params: deckId, section=decks|cards, page, limit */
export async function GET(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms = await resolvePermissions(user.id);
    if (!perms.modules.taskdeck) return forbidden("TaskDeck access required");

    const sp      = new URL(request.url).searchParams;
    const section = sp.get("section") ?? "decks";
    const deckId  = sp.get("deckId") ? parseInt(sp.get("deckId")!, 10) : null;
    const page    = Math.max(1, parseInt(sp.get("page")  ?? "1",  10));
    const limit   = Math.min(100, parseInt(sp.get("limit") ?? "25", 10));

    if (section === "cards") {
      if (!deckId) return badRequest("deckId required for cards section");
      const deck = await prisma.aqpTaskdeck.findUnique({ where: { id: deckId } });
      if (!deck) return notFound("Deck not found");

      const lists = await prisma.aqpTasklist.findMany({
        where: { deckId }, orderBy: { sortOrder: "asc" },
      });
      const cards = await prisma.aqpTaskcard.findMany({
        where: { listId: { in: lists.map((l) => l.id) } },
        orderBy: [{ listId: "asc" }, { sortOrder: "asc" }],
      });
      return ok({ deck, lists, cards });
    }

    // Decks visible to this user
    const assignments = await prisma.pgUserJobAssignment.findMany({
      where: { userId: user.id }, select: { jobRoleId: true },
    });
    const roleIds = assignments.map((a) => a.jobRoleId);
    const permRows = await prisma.pgTaskdeckPermission.findMany({
      where: { jobRoleId: { in: roleIds } },
    });
    const canViewAll = perms.isAdmin || permRows.some((p) => p.canModerateAll);

    const where = {
      isArchived: false,
      ...(canViewAll ? {} : { OR: [{ createdBy: user.id }, { isPublic: true }] }),
    };

    const [decks, total] = await Promise.all([
      prisma.aqpTaskdeck.findMany({ where, orderBy: { deckName: "asc" }, skip: (page - 1) * limit, take: limit }),
      prisma.aqpTaskdeck.count({ where }),
    ]);
    return ok({ decks, total, page, limit });
  } catch (e) { return serverError(e); }
}

/** POST /api/taskdeck  Create a deck or card depending on body.type */
export async function POST(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms = await resolvePermissions(user.id);
    if (!perms.modules.taskdeck) return forbidden("TaskDeck access required");

    const body = await parseBody<{ type: "deck" | "list" | "card"; [k: string]: unknown }>(request);
    if (!body?.type) return badRequest("type is required (deck | list | card)");

    if (body.type === "deck") {
      const deck = await prisma.aqpTaskdeck.create({
        data: {
          deckName:        String(body.deckName ?? "Untitled Deck"),
          deckDescription: body.deckDescription ? String(body.deckDescription) : null,
          createdBy:       user.id,
          isPublic:        Boolean(body.isPublic ?? false),
          isPrimary:       perms.isAdmin ? Boolean(body.isPrimary ?? false) : false,
        },
      });
      return created(deck);
    }

    if (body.type === "list") {
      if (!body.deckId) return badRequest("deckId required");
      const list = await prisma.aqpTasklist.create({
        data: { deckId: Number(body.deckId), listName: String(body.listName ?? "Untitled List"), sortOrder: Number(body.sortOrder ?? 0) },
      });
      return created(list);
    }

    if (body.type === "card") {
      if (!body.listId) return badRequest("listId required");
      const card = await prisma.aqpTaskcard.create({
        data: {
          listId:    Number(body.listId),
          title:     String(body.title ?? "Untitled Card"),
          description: body.description ? String(body.description) : null,
          createdBy: user.id,
          assignedTo: body.assignedTo ? Number(body.assignedTo) : null,
          dueDate:   body.dueDate ? new Date(String(body.dueDate)) : null,
          sortOrder: Number(body.sortOrder ?? 0),
        },
      });
      return created(card);
    }

    return badRequest("type must be deck | list | card");
  } catch (e) { return serverError(e); }
}

/** PATCH /api/taskdeck  Body: { type, id, ...fields } */
export async function PATCH(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms = await resolvePermissions(user.id);
    if (!perms.modules.taskdeck) return forbidden();

    const body = await parseBody<{ type: "card"; id: number; isComplete?: boolean; title?: string; assignedTo?: number | null; dueDate?: string | null; sortOrder?: number }>(request);
    if (!body?.id) return badRequest("id required");

    const card = await prisma.aqpTaskcard.findUnique({ where: { id: body.id } });
    if (!card) return notFound("Card not found");
    if (!perms.isAdmin && card.createdBy !== user.id) return forbidden();

    const updated = await prisma.aqpTaskcard.update({
      where: { id: body.id },
      data: {
        ...(body.title       !== undefined && { title:      body.title }),
        ...(body.isComplete  !== undefined && { isComplete: body.isComplete }),
        ...(body.assignedTo  !== undefined && { assignedTo: body.assignedTo }),
        ...(body.dueDate     !== undefined && { dueDate:    body.dueDate ? new Date(body.dueDate) : null }),
        ...(body.sortOrder   !== undefined && { sortOrder:  body.sortOrder }),
      },
    });
    return ok(updated);
  } catch (e) { return serverError(e); }
}
