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
    <div className="ap-aspect-video ap-w-full ap-overflow-hidden ap-rounded-xl ap-bg-black">
      <iframe src={url} className="ap-h-full ap-w-full" allowFullScreen title="Lesson video" />
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
    <div className="ap-mx-auto ap-max-w-4xl">
      <EmptyState title="No lesson selected" description={<Link href="/courses" className="ap-text-brand-600 hover:ap-underline">← Back to Courses</Link>} />
    </div>
  );
  if (loading) return <FullPageSpinner />;
  if (error || !data) return <EmptyState title="Could not load lesson" description="Please refresh." />;

  const { lesson, sections } = data;

  return (
    <div className="ap-mx-auto ap-max-w-4xl ap-space-y-6">
      <PageHeader
        title={lesson.title}
        description={
          <Link href={`/lessons?courseId=${lesson.courseId}`} className="ap-text-xs ap-text-brand-600 hover:ap-underline">
            ← Back to Lessons
          </Link>
        }
      />
      {lesson.description && <p className="ap-text-sm ap-text-gray-600">{lesson.description}</p>}
      {sections.length > 0 && (
        <div className="ap-space-y-6">
          {sections.map((s) => (
            <div key={s.id} className="ap-rounded-xl ap-border ap-border-gray-100 ap-bg-white ap-p-5 ap-shadow-sm">
              <div className="ap-flex ap-items-center ap-gap-2 ap-mb-3">
                <h2 className="ap-text-sm ap-font-semibold ap-text-gray-900">{s.title}</h2>
                <Badge variant="default">{s.sectionType}</Badge>
              </div>
              {s.sectionType === "video" && s.videoUrl && <VideoSection url={s.videoUrl} />}
              {s.sectionType === "text" && s.textContent && (
                <div className="ap-prose ap-prose-sm ap-max-w-none ap-text-gray-700" dangerouslySetInnerHTML={{ __html: s.textContent }} />
              )}
              {s.sectionType === "whiteboard" && (
                <div className="ap-flex ap-items-center ap-justify-center ap-h-32 ap-rounded-lg ap-bg-gray-50 ap-text-sm ap-text-gray-400">
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
