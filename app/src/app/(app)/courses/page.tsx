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
  if (!status || status === "not-started") return <span className="text-xs text-gray-400">Not started</span>;
  if (status === "completed") return <Badge variant="success">Completed</Badge>;
  return <Badge variant="info">In progress</Badge>;
}

export default function CoursesPage() {
  const { data, loading, error } = useApi<{ courses: Course[] }>("/api/courses");

  if (loading) return <FullPageSpinner />;
  if (error || !data) return <EmptyState title="Could not load courses" description="Please refresh." />;

  const courses = data.courses ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <PageHeader title="Courses" description="Your assigned learning modules." />

      {courses.length === 0 ? (
        <EmptyState title="No courses available" description="Check back later or contact your admin." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <Link
              key={c.id}
              href={`/lessons?courseId=${c.id}`}
              className="flex flex-col rounded-xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md overflow-hidden"
            >
              {c.thumbnailUrl ? (
                <img src={c.thumbnailUrl} alt={c.title} className="h-36 w-full object-cover" />
              ) : (
                <div className="h-36 w-full bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center">
                  <span className="text-4xl font-bold text-brand-400">{c.title.charAt(0)}</span>
                </div>
              )}
              <div className="flex flex-1 flex-col gap-2 p-4">
                <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">{c.title}</h3>
                {c.description && <p className="text-xs text-gray-500 line-clamp-2">{c.description}</p>}
                <div className="mt-auto flex items-center justify-between">
                  <ProgressPill status={c.progress?.status} />
                  {c.lessonCount != null && (
                    <span className="text-xs text-gray-400">{c.lessonCount} lesson{c.lessonCount !== 1 ? "s" : ""}</span>
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
