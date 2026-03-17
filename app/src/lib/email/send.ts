import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

/**
 * Send an email via Resend.
 * Replaces `wp_mail()` from WordPress.
 */
export async function sendEmail({
  to,
  subject,
  html,
  from,
  replyTo,
}: SendEmailOptions) {
  const { data, error } = await resend.emails.send({
    from: from ?? process.env.RESEND_FROM_EMAIL ?? "AquaticPro <noreply@aquaticpro.app>",
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    replyTo,
  });

  if (error) {
    console.error("[Email] Failed to send:", error);
    throw new Error(`Failed to send email: ${error.message}`);
  }

  return data;
}
