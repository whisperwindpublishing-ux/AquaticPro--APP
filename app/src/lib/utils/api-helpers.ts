import { NextResponse } from "next/server";

/**
 * Standard API response helpers.
 * Replaces the WordPress REST API response pattern.
 */

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function created<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

export function unauthorized(message = "Authentication required") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "Insufficient permissions") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function notFound(message = "Resource not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 });
}

export function serverError(error: unknown) {
  console.error("[API Error]", error);
  const message =
    error instanceof Error ? error.message : "Internal server error";
  return NextResponse.json({ error: message }, { status: 500 });
}

/** Parse the request body safely */
export async function parseBody<T>(request: Request): Promise<T | null> {
  try {
    return await request.json() as T;
  } catch {
    return null;
  }
}
