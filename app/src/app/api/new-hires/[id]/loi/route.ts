import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { resolvePermissions } from "@/lib/auth/permissions";
import { forbidden, notFound, serverError } from "@/lib/utils/api-helpers";

/**
 * GET /api/new-hires/[id]/loi
 *
 * Generates a printable Letter of Intent HTML document for a new hire.
 * Marks loiSent = true on first generation.
 * Returns text/html — open in a new tab and use browser Print → Save as PDF.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms = await resolvePermissions(user.id);
    if (!perms.modules.newHires) return forbidden("New Hires access required.");

    const { id } = await params;
    const hireId = parseInt(id, 10);
    if (isNaN(hireId)) return new NextResponse("Invalid ID.", { status: 400 });

    const hire = await prisma.aquaticproNewHire.findUnique({ where: { id: hireId } });
    if (!hire) return notFound("New hire not found.");

    // Mark LOI as sent
    if (!hire.loiSent) {
      await prisma.aquaticproNewHire.update({
        where: { id: hireId },
        data: { loiSent: true, loiSentDate: new Date() },
      });
    }

    const today = new Date().toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

    const fullName = `${hire.firstName} ${hire.lastName}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Letter of Intent — ${fullName}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      line-height: 1.65;
      color: #111;
      background: #fff;
      padding: 0;
    }
    .page {
      width: 8.5in;
      min-height: 11in;
      padding: 1.25in 1.25in 1in;
      margin: 0 auto;
    }
    .letterhead {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 36px;
      padding-bottom: 18px;
      border-bottom: 3px solid #465fff;
    }
    .logo-box {
      width: 42px;
      height: 42px;
      border-radius: 8px;
      background: linear-gradient(135deg, #0004ff, #12a4ff, #9f0fff, #f538f2);
      flex-shrink: 0;
    }
    .org-name { font-size: 20pt; font-weight: bold; letter-spacing: -0.5px; }
    .org-sub  { font-size: 9pt; color: #555; margin-top: 1px; }
    .date-line {
      font-size: 11pt;
      color: #444;
      margin-bottom: 28px;
    }
    h1 {
      font-size: 14pt;
      font-weight: bold;
      text-align: center;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 28px;
    }
    .salutation { margin-bottom: 14px; }
    p { margin-bottom: 14px; }
    .terms-box {
      border: 1px solid #ccc;
      border-radius: 4px;
      padding: 14px 18px;
      background: #f9f9f9;
      margin: 20px 0;
    }
    .terms-box table { width: 100%; border-collapse: collapse; }
    .terms-box td { padding: 4px 0; vertical-align: top; }
    .terms-box td:first-child { width: 180px; font-weight: bold; color: #333; }
    .signature-section {
      margin-top: 40px;
    }
    .sig-line {
      display: flex;
      gap: 40px;
      margin-top: 30px;
    }
    .sig-block { flex: 1; }
    .sig-block .line {
      border-bottom: 1px solid #333;
      margin-bottom: 4px;
      min-height: 32px;
    }
    .sig-block .label { font-size: 9pt; color: #555; }
    .footer {
      margin-top: 48px;
      padding-top: 12px;
      border-top: 1px solid #ddd;
      font-size: 8pt;
      color: #888;
      text-align: center;
    }
    @media print {
      body { padding: 0; }
      .page { padding: 0.75in 0.75in 0.5in; box-shadow: none; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="background:#f0f4ff;text-align:center;padding:12px 20px;font-family:sans-serif;font-size:13px;border-bottom:1px solid #c7d8ff;">
    <strong>Preview Mode</strong> — Use your browser&apos;s <strong>Print</strong> function (Ctrl+P / ⌘+P) and select &quot;Save as PDF&quot; to download.
    <button onclick="window.print()" style="margin-left:14px;padding:5px 14px;background:#465fff;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;">Print / Save PDF</button>
  </div>

  <div class="page">
    <div class="letterhead">
      <div class="logo-box"></div>
      <div>
        <div class="org-name">AquaticPro</div>
        <div class="org-sub">Staff Management & Aquatics Administration Platform</div>
      </div>
    </div>

    <p class="date-line">${today}</p>

    <h1>Letter of Intent — Employment Offer</h1>

    <p class="salutation">Dear ${fullName},</p>

    <p>
      We are pleased to extend this Letter of Intent to offer you a position with AquaticPro for the upcoming season.
      This letter outlines our intent to hire you and the terms we hope to finalize upon your acceptance.
    </p>

    <div class="terms-box">
      <table>
        <tr>
          <td>Full Name:</td>
          <td>${fullName}</td>
        </tr>
        <tr>
          <td>Email:</td>
          <td>${hire.email}</td>
        </tr>
        ${hire.phone ? `<tr><td>Phone:</td><td>${hire.phone}</td></tr>` : ""}
        <tr>
          <td>Position:</td>
          <td>${hire.position}</td>
        </tr>
        ${hire.needsWorkPermit ? `<tr><td>Work Permit:</td><td>Required — please bring completed permit on first day</td></tr>` : ""}
        <tr>
          <td>Status:</td>
          <td>Pending hire confirmation</td>
        </tr>
        <tr>
          <td>Date Issued:</td>
          <td>${today}</td>
        </tr>
      </table>
    </div>

    <p>
      This letter is contingent upon successful completion of any remaining onboarding requirements, including
      background checks, certification verification, and submission of required documentation. Final employment
      terms including compensation details will be provided upon formal contract execution.
    </p>

    <p>
      Please review this letter carefully. By signing below, you acknowledge receipt of this Letter of Intent and
      confirm your intention to accept the offered position under the terms described.
    </p>

    <div class="signature-section">
      <p style="font-weight:bold;">Acknowledgement &amp; Acceptance:</p>
      <div class="sig-line">
        <div class="sig-block">
          <div class="line"></div>
          <div class="label">Applicant Signature</div>
        </div>
        <div class="sig-block">
          <div class="line"></div>
          <div class="label">Printed Name</div>
        </div>
        <div class="sig-block" style="flex:0.6">
          <div class="line"></div>
          <div class="label">Date</div>
        </div>
      </div>

      <div class="sig-line" style="margin-top:28px;">
        <div class="sig-block">
          <div class="line"></div>
          <div class="label">Authorized Signatory — AquaticPro</div>
        </div>
        <div class="sig-block" style="flex:0.6">
          <div class="line"></div>
          <div class="label">Date</div>
        </div>
      </div>
    </div>

    <div class="footer">
      This document was generated by AquaticPro Staff Management Platform.
      Generated: ${new Date().toISOString()} &nbsp;|&nbsp; New Hire ID: ${hire.id}
    </div>
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (e) {
    return serverError(e);
  }
}
