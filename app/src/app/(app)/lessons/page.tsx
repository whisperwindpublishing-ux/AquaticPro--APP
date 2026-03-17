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
  if (status === "completed") return <span className="ap-h-2.5 ap-w-2.5 ap-rounded-full ap-bg-green-500 ap-block" />;
  if (status === "in-progress") return <span className="ap-h-2.5 ap-w-2.5 ap-rounded-full ap-bg-brand-400 ap-block" />;
  return <span className="ap-h-2.5 ap-w-2.5 ap-rounded-full ap-bg-gray-200 ap-block" />;
}

export default function LessonsPage() {
  const sp = useSearchParams();
  const courseId = sp.get("courseId");
  const { data, loading, error } = useApi<{ course?: { title: string }; lessons: Lesson[] }>(
    courseId ? `/api/lessons?courseId=${courseId}` : null
  );

  if (!courseId) return (
    <div className="ap-mx-auto ap-max-w-4xl">
      <EmptyState title="No course selected" description={<Link href="/courses" className="ap-text-brand-600 hover:ap-underline">← Back to Courses</Link>} />
    </div>
  );
  if (loading) return <FullPageSpinner />;
  if (error || !data) return <EmptyState title="Could not load lessons" description="Please refresh." />;

  const lessons = data.lessons ?? [];

  return (
    <div className="ap-mx-auto ap-max-w-3xl ap-space-y-4">
      <PageHeader
        title={data.course?.title ?? "Lessons"}
        description={<Link href="/courses" className="ap-text-xs ap-text-brand-600 hover:ap-underline">← Back to Courses</Link>}
      />
      {lessons.length === 0 ? (
        <EmptyState title="No lessons in this course" description="Content will appear here once available." />
      ) : (
        <div className="ap-rounded-xl ap-border ap-border-gray-100 ap-bg-white ap-shadow-sm ap-divide-y ap-divide-gray-50">
          {lessons.map((lesson, idx) => (
            <Link
              key={lesson.id}
              href={`/whiteboard?lessonId=${lesson.id}`}
              className="ap-flex ap-items-center ap-gap-4 ap-px-5 ap-py-4 hover:ap-bg-gray-50 ap-transition-colors"
            >
              <span className="ap-flex ap-h-8 ap-w-8 ap-shrink-0 ap-items-center ap-justify-center ap-rounded-full ap-bg-gray-100 ap-text-xs ap-font-semibold ap-text-gray-500">
                {idx + 1}
              </span>
              <div className="ap-flex-1 ap-min-w-0">
                <p className="ap-text-sm ap-font-medium ap-text-gray-900 ap-truncate">{lesson.title}</p>
                <div className="ap-flex ap-items-center ap-gap-2 ap-mt-0.5">
                  <Badge variant="default">{lesson.lessonType}</Badge>
                  {lesson.estimatedTime && <span className="ap-text-xs ap-text-gray-400">{lesson.estimatedTime}</span>}
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
