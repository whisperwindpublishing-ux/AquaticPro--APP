import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import ReturnForm from "./ReturnForm";

export const metadata: Metadata = { title: "Seasonal Return | AquaticPro" };
export const dynamic = "force-dynamic";

function fmtDate(iso: string | Date) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function ErrorCard({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-10 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-error-100">
        <svg className="h-7 w-7 text-error-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h2 className="text-lg font-bold text-gray-900 mb-1">{title}</h2>
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}

interface Props {
  params: Promise<{ token: string }>;
}

export default async function ReturnPage({ params }: Props) {
  const { token } = await params;

  const es = await prisma.srmEmployeeSeason.findFirst({
    where: { returnToken: token },
  });

  if (!es) {
    return <ErrorCard title="Link Not Found" message="This invitation link is invalid or has already been used. Please contact your supervisor." />;
  }

  if (es.tokenExpiresAt && es.tokenExpiresAt < new Date()) {
    return (
      <ErrorCard
        title="Link Expired"
        message={`This invitation link expired on ${fmtDate(es.tokenExpiresAt)}. Please contact your supervisor for a new link.`}
      />
    );
  }

  const [user, season] = await Promise.all([
    prisma.user.findUnique({
      where: { id: es.userId },
      select: { displayName: true, email: true },
    }),
    prisma.srmSeason.findUnique({
      where: { id: es.seasonId },
      select: { name: true, year: true, startDate: true, endDate: true },
    }),
  ]);

  if (!user || !season) {
    return <ErrorCard title="Data Not Found" message="Your invitation record could not be loaded. Please contact your supervisor." />;
  }

  const data = {
    employeeSeasonId: es.id,
    status: es.status,
    alreadyResponded: !!es.responseDate,
    responseDate: es.responseDate?.toISOString() ?? null,
    longevityYears: es.longevityYears,
    employeeName: user.displayName,
    email: user.email,
    season: {
      name: season.name,
      year: season.year,
      startDate: season.startDate.toISOString(),
      endDate: season.endDate.toISOString(),
    },
  };

  return <ReturnForm data={data} token={token} />;
}
