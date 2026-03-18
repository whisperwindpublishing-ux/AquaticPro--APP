"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { FullPageSpinner, EmptyState, Badge, PageHeader } from "@/components/ui";

interface Lesson {
  id: number;
  title: string;
  description: string | null;
  lessonType: string;
  displayOrder: number;
  estimatedTime: string | null;
  progress: { status: string; completedAt: string | null } | null;
}

function StatusDot({ status }: { status?: string | null }) {
  if (status === "completed") return <span className="h-2.5 w-2.5 rounded-full bg-green-500 block" />;
  if (status === "in-progress") return <span className="h-2.5 w-2.5 rounded-full bg-brand-400 block" />;
  return <span className="h-2.5 w-2.5 rounded-full bg-gray-200 block" />;
}

export default function LessonsPage() {
  const sp = useSearchParams();
  const courseId = sp.get("courseId");
  const { data, loading, error } = useApi<{ course?: { title: string }; lessons: Lesson[] }>(
    courseId ? `/api/lessons?courseId=${courseId}` : null
  );

  if (!courseId) return (
    <div className="mx-auto max-w-4xl">
      <EmptyState title="No course selected" description={<Link href="/courses" className="text-brand-600 hover:underline">← Back to Courses</Link>} />
    </div>
  );
  if (loading) return <FullPageSpinner />;
  if (error || !data) return <EmptyState title="Could not load lessons" description="Please refresh." />;

  const lessons = data.lessons ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title={data.course?.title ?? "Lessons"}
        description={<Link href="/courses" className="text-xs text-brand-600 hover:underline">← Back to Courses</Link>}
      />
      {lessons.length === 0 ? (
        <EmptyState title="No lessons in this course" description="Content will appear here once available." />
      ) : (
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm divide-y divide-gray-50">
          {lessons.map((lesson, idx) => (
            <Link
              key={lesson.id}
              href={`/whiteboard?lessonId=${lesson.id}`}
              className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{lesson.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="default">{lesson.lessonType}</Badge>
                  {lesson.estimatedTime && <span className="text-xs text-gray-400">{lesson.estimatedTime}</span>}
                </div>
              </div>
              <StatusDot status={lesson.progress?.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
