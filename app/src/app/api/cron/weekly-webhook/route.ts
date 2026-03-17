/**
 * Cron: Weekly Webhook
 * Sends weekly staff data export to n8n.
 * Replaces class-daily-logs-webhook.php WP cron job.
 * Triggered by Vercel Cron — see vercel.json
 */

import { ok, serverError } from "@/lib/utils/api-helpers";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // TODO Phase 5: port class-daily-logs-webhook.php logic
    return ok({ message: "Weekly webhook cron stub — not yet implemented" });
  } catch (error) {
    return serverError(error);
  }
}
