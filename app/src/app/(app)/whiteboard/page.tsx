"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { FullPageSpinner, EmptyState, PageHeader, Badge } from "@/components/ui";

interface Section {
  id: number;
  title: string;
  sectionType: string;
  textContent: string | null;
  videoUrl: string | null;
  displayOrder: number;
}

interface LessonData {
  lesson: { id: number; title: string; description: string | null; lessonType: string; excalidrawJson: string | null; courseId: number };
  sections: Section[];
  progress: { status: string } | null;
}

function VideoSection({ url }: { url: string }) {
  return (
    <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
      <iframe src={url} className="h-full w-full" allowFullScreen title="Lesson video" />
    </div>
  );
}

export default function WhiteboardPage() {
  const sp = useSearchParams();
  const lessonId = sp.get("lessonId");
  const { data, loading, error } = useApi<LessonData>(
    lessonId ? `/api/lessons?id=${lessonId}` : null
  );

  if (!lessonId) return (
    <div className="mx-auto max-w-4xl">
      <EmptyState title="No lesson selected" description={<Link href="/courses" className="text-brand-600 hover:underline">← Back to Courses</Link>} />
    </div>
  );
  if (loading) return <FullPageSpinner />;
  if (error || !data) return <EmptyState title="Could not load lesson" description="Please refresh." />;

  const { lesson, sections } = data;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={lesson.title}
        description={
          <Link href={`/lessons?courseId=${lesson.courseId}`} className="text-xs text-brand-600 hover:underline">
            ← Back to Lessons
          </Link>
        }
      />
      {lesson.description && <p className="text-sm text-gray-600">{lesson.description}</p>}
      {sections.length > 0 && (
        <div className="space-y-6">
          {sections.map((s) => (
            <div key={s.id} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold text-gray-900">{s.title}</h2>
                <Badge variant="default">{s.sectionType}</Badge>
              </div>
              {s.sectionType === "video" && s.videoUrl && <VideoSection url={s.videoUrl} />}
              {s.sectionType === "text" && s.textContent && (
                <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: s.textContent }} />
              )}
              {s.sectionType === "whiteboard" && (
                <div className="flex items-center justify-center h-32 rounded-lg bg-gray-50 text-sm text-gray-400">
                  Interactive whiteboard — opens in Excalidraw
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
