/**
 * AquaticPro — Email HTML Templates
 * Replaces the inline wp_mail() HTML strings scattered across the PHP codebase.
 * Each function returns a ready-to-send HTML string.
 */

const APP_NAME = "AquaticPro";
const BASE_COLOR = "#0ea5e9"; // brand blue

/** Shared wrapper — consistent header/footer for all transactional emails */
function wrap(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.12);">
        <!-- Header -->
        <tr><td style="background:${BASE_COLOR};padding:24px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">${APP_NAME}</h1>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          ${body}
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f4f6f8;padding:16px 32px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">
            You are receiving this because you are a member of ${APP_NAME}.
            Please do not reply to this email.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// LMS Assignment Notification
// ─────────────────────────────────────────────────────────────────────────────

export interface LmsAssignmentEmailData {
  recipientName: string;
  lessonTitle: string;
  assignmentTitle: string;
  dueDate?: string;
  lessonUrl: string;
}

export function lmsAssignmentEmail(data: LmsAssignmentEmailData): {
  subject: string;
  html: string;
} {
  const subject = `New Learning Assignment: ${data.assignmentTitle}`;
  const html = wrap(
    subject,
    `<h2 style="margin:0 0 8px;font-size:18px;color:#111827;">You have a new assignment</h2>
     <p style="margin:0 0 20px;color:#374151;">Hi ${data.recipientName},</p>
     <p style="color:#374151;">You've been assigned a new learning module in ${APP_NAME}:</p>
     <div style="background:#f0f9ff;border-left:4px solid ${BASE_COLOR};padding:16px 20px;margin:20px 0;border-radius:0 6px 6px 0;">
       <p style="margin:0 0 4px;font-weight:600;color:#0369a1;">${data.assignmentTitle}</p>
       <p style="margin:0;font-size:14px;color:#64748b;">Lesson: ${data.lessonTitle}</p>
       ${data.dueDate ? `<p style="margin:8px 0 0;font-size:13px;color:#dc2626;">Due: ${data.dueDate}</p>` : ""}
     </div>
     <p style="margin:24px 0 0;">
       <a href="${data.lessonUrl}" style="display:inline-block;background:${BASE_COLOR};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;">Start Lesson →</a>
     </p>`
  );
  return { subject, html };
}

// ─────────────────────────────────────────────────────────────────────────────
// Awesome Awards — Nomination Received
// ─────────────────────────────────────────────────────────────────────────────

export interface AwardsNominationEmailData {
  nominatorName: string;
  categoryName: string;
  message?: string;
  appUrl: string;
}

export function awardsNominationEmail(data: AwardsNominationEmailData): {
  subject: string;
  html: string;
} {
  const subject = `You've been nominated for an Awesome Award! 🏆`;
  const html = wrap(
    subject,
    `<h2 style="margin:0 0 8px;font-size:18px;color:#111827;">You've been nominated!</h2>
     <p style="color:#374151;">
       <strong>${data.nominatorName}</strong> has nominated you for the
       <strong>${data.categoryName}</strong> award on ${APP_NAME}.
     </p>
     ${
       data.message
         ? `<blockquote style="border-left:4px solid #fbbf24;padding:12px 16px;margin:16px 0;background:#fefce8;border-radius:0 6px 6px 0;color:#78350f;font-style:italic;">"${data.message}"</blockquote>`
         : ""
     }
     <p style="margin:24px 0 0;">
       <a href="${data.appUrl}/awards" style="display:inline-block;background:#f59e0b;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;">View Awards →</a>
     </p>`
  );
  return { subject, html };
}

// ─────────────────────────────────────────────────────────────────────────────
// New Hire — Application Received Confirmation
// ─────────────────────────────────────────────────────────────────────────────

export interface NewHireConfirmationEmailData {
  firstName: string;
  orgName?: string;
  appUrl: string;
}

export function newHireConfirmationEmail(data: NewHireConfirmationEmailData): {
  subject: string;
  html: string;
} {
  const subject = `Application received${data.orgName ? ` — ${data.orgName}` : ""}`;
  const html = wrap(
    subject,
    `<h2 style="margin:0 0 8px;font-size:18px;color:#111827;">Thanks for applying, ${data.firstName}!</h2>
     <p style="color:#374151;">
       We've received your application and our team will review it shortly.
       You'll hear from us as soon as a decision has been made.
     </p>
     <p style="color:#374151;">In the meantime, feel free to check the status of your application:</p>
     <p style="margin:24px 0 0;">
       <a href="${data.appUrl}" style="display:inline-block;background:${BASE_COLOR};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;">View Application Status →</a>
     </p>`
  );
  return { subject, html };
}

// ─────────────────────────────────────────────────────────────────────────────
// New Hire — Application Status Update (admin-to-applicant)
// ─────────────────────────────────────────────────────────────────────────────

export interface NewHireStatusEmailData {
  firstName: string;
  status: "approved" | "rejected" | "interview" | "offer";
  notes?: string;
  appUrl: string;
}

const STATUS_LABELS: Record<NewHireStatusEmailData["status"], string> = {
  approved: "Approved ✓",
  rejected: "Not Moving Forward",
  interview: "Interview Scheduled",
  offer: "Offer Extended",
};

export function newHireStatusEmail(data: NewHireStatusEmailData): {
  subject: string;
  html: string;
} {
  const label = STATUS_LABELS[data.status];
  const subject = `Application update: ${label}`;
  const html = wrap(
    subject,
    `<h2 style="margin:0 0 8px;font-size:18px;color:#111827;">Application update</h2>
     <p style="color:#374151;">Hi ${data.firstName},</p>
     <p style="color:#374151;">There's an update on your application:</p>
     <div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:16px 20px;margin:20px 0;border-radius:0 6px 6px 0;">
       <p style="margin:0;font-weight:600;color:#15803d;">${label}</p>
       ${data.notes ? `<p style="margin:8px 0 0;color:#374151;font-size:14px;">${data.notes}</p>` : ""}
     </div>
     <p style="margin:24px 0 0;">
       <a href="${data.appUrl}" style="display:inline-block;background:${BASE_COLOR};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;">View Details →</a>
     </p>`
  );
  return { subject, html };
}

// ─────────────────────────────────────────────────────────────────────────────
// Seasonal Return — Invite to return next season
// ─────────────────────────────────────────────────────────────────────────────

export interface SeasonalReturnInviteEmailData {
  recipientName: string;
  seasonName: string;
  returnUrl: string;
  deadlineDate?: string;
}

export function seasonalReturnInviteEmail(
  data: SeasonalReturnInviteEmailData
): { subject: string; html: string } {
  const subject = `Will you be returning for ${data.seasonName}?`;
  const html = wrap(
    subject,
    `<h2 style="margin:0 0 8px;font-size:18px;color:#111827;">Season return confirmation needed</h2>
     <p style="color:#374151;">Hi ${data.recipientName},</p>
     <p style="color:#374151;">
       We're planning for the upcoming <strong>${data.seasonName}</strong> season and would love to have you back!
       Please let us know if you plan to return.
     </p>
     ${
       data.deadlineDate
         ? `<p style="color:#dc2626;font-weight:500;">Please respond by ${data.deadlineDate}.</p>`
         : ""
     }
     <p style="margin:24px 0 0;">
       <a href="${data.returnUrl}" style="display:inline-block;background:${BASE_COLOR};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;">Confirm Your Return →</a>
     </p>`
  );
  return { subject, html };
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic queue-item sender (for AquaticproEmailQueue rows)
// ─────────────────────────────────────────────────────────────────────────────

export function genericQueueEmail(
  subject: string,
  bodyHtml: string
): { subject: string; html: string } {
  return { subject, html: wrap(subject, bodyHtml) };
}
