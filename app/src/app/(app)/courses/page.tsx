"use client";

import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { FullPageSpinner, EmptyState, Badge, PageHeader } from "@/components/ui";

interface Course {
  id: number;
  title: string;
  description: string | null;
  status: string;
  lessonCount?: number;
  thumbnailUrl?: string | null;
  progress?: { status: string; completedAt: string | null } | null;
}

function ProgressPill({ status }: { status?: string }) {
  if (!status || status === "not-started") return <span className="ap-text-xs ap-text-gray-400">Not started</span>;
  if (status === "completed") return <Badge variant="success">Completed</Badge>;
  return <Badge variant="info">In progress</Badge>;
}

export default function CoursesPage() {
  const { data, loading, error } = useApi<{ courses: Course[] }>("/api/courses");

  if (loading) return <FullPageSpinner />;
  if (error || !data) return <EmptyState title="Could not load courses" description="Please refresh." />;

  const courses = data.courses ?? [];

  return (
    <div className="ap-mx-auto ap-max-w-5xl ap-space-y-4">
      <PageHeader title="Courses" description="Your assigned learning modules." />

      {courses.length === 0 ? (
        <EmptyState title="No courses available" description="Check back later or contact your admin." />
      ) : (
        <div className="ap-grid ap-gap-4 sm:ap-grid-cols-2 lg:ap-grid-cols-3">
          {courses.map((c) => (
            <Link
              key={c.id}
              href={`/lessons?courseId=${c.id}`}
              className="ap-flex ap-flex-col ap-rounded-xl ap-border ap-border-gray-100 ap-bg-white ap-shadow-sm ap-transition-shadow hover:ap-shadow-md ap-overflow-hidden"
            >
              {c.thumbnailUrl ? (
                <img src={c.thumbnailUrl} alt={c.title} className="ap-h-36 ap-w-full ap-object-cover" />
              ) : (
                <div className="ap-h-36 ap-w-full ap-bg-gradient-to-br ap-from-brand-100 ap-to-brand-200 ap-flex ap-items-center ap-justify-center">
                  <span className="ap-text-4xl ap-font-bold ap-text-brand-400">{c.title.charAt(0)}</span>
                </div>
              )}
              <div className="ap-flex ap-flex-1 ap-flex-col ap-gap-2 ap-p-4">
                <h3 className="ap-text-sm ap-font-semibold ap-text-gray-900 ap-line-clamp-2">{c.title}</h3>
                {c.description && <p className="ap-text-xs ap-text-gray-500 ap-line-clamp-2">{c.description}</p>}
                <div className="ap-mt-auto ap-flex ap-items-center ap-justify-between">
                  <ProgressPill status={c.progress?.status} />
                  {c.lessonCount != null && (
                    <span className="ap-text-xs ap-text-gray-400">{c.lessonCount} lesson{c.lessonCount !== 1 ? "s" : ""}</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
