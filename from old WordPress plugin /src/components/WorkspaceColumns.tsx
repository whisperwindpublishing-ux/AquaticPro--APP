import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    HiOutlineBars2 as Bars2Icon,
    HiOutlineCalendarDays as CalendarDaysIcon,
    HiOutlineChatBubbleOvalLeftEllipsis as ChatBubbleIcon,
    HiOutlineViewColumns as ColumnsIcon,
    HiOutlineRectangleStack as TabsIcon,
} from 'react-icons/hi2';

type ViewMode = 'columns' | 'tabs';
type TabName = 'tasks' | 'meetings' | 'updates';

interface WorkspaceColumnsProps {
    /** Left column — Tasks */
    tasksSlot: React.ReactNode;
    /** Center column — Meetings */
    meetingsSlot: React.ReactNode;
    /** Right column — Updates feed */
    updatesSlot: React.ReactNode;
    /** Counts for tab badges */
    taskCount: number;
    meetingCount: number;
    updateCount: number;
}

/**
 * Hybrid layout: 3-column resizable (default) or tabbed single-panel.
 *
 * - Columns mode: 3 resizable columns with drag dividers
 * - Tabs mode: Tab bar at top, one panel visible at a time
 * - Toggle button switches between modes
 */
const WorkspaceColumns: React.FC<WorkspaceColumnsProps> = ({
    tasksSlot,
    meetingsSlot,
    updatesSlot,
    taskCount,
    meetingCount,
    updateCount,
}) => {
    const [viewMode, setViewMode] = useState<ViewMode>('columns');
    const [activeTab, setActiveTab] = useState<TabName>('tasks');

    // ── Column resize state ─────────────────────────────────────────────────
    const [colWidths, setColWidths] = useState<[number, number, number]>([33, 34, 33]);
    const containerRef = useRef<HTMLDivElement>(null);
    const draggingRef = useRef<{ divider: 0 | 1; startX: number; startWidths: [number, number, number] } | null>(null);

    const MIN_PCT = 15;

    const handleMouseDown = useCallback((divider: 0 | 1, e: React.MouseEvent) => {
        e.preventDefault();
        draggingRef.current = { divider, startX: e.clientX, startWidths: [...colWidths] };
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, [colWidths]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!draggingRef.current || !containerRef.current) return;
            const { divider, startX, startWidths } = draggingRef.current;
            const containerWidth = containerRef.current.offsetWidth;
            const deltaPct = ((e.clientX - startX) / containerWidth) * 100;
            const newWidths: [number, number, number] = [...startWidths];

            if (divider === 0) {
                newWidths[0] = Math.max(MIN_PCT, Math.min(startWidths[0] + deltaPct, 100 - startWidths[2] - MIN_PCT));
                newWidths[1] = 100 - newWidths[0] - startWidths[2];
                if (newWidths[1] < MIN_PCT) { newWidths[1] = MIN_PCT; newWidths[0] = 100 - MIN_PCT - startWidths[2]; }
            } else {
                newWidths[1] = Math.max(MIN_PCT, Math.min(startWidths[1] + deltaPct, 100 - startWidths[0] - MIN_PCT));
                newWidths[2] = 100 - startWidths[0] - newWidths[1];
                if (newWidths[2] < MIN_PCT) { newWidths[2] = MIN_PCT; newWidths[1] = 100 - startWidths[0] - MIN_PCT; }
            }
            setColWidths(newWidths);
        };

        const handleMouseUp = () => {
            if (draggingRef.current) {
                draggingRef.current = null;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    // ── Tab definitions ─────────────────────────────────────────────────────
    const tabs: { key: TabName; label: string; icon: React.ReactNode; count: number; color: string; bgActive: string; bgHover: string }[] = [
        { key: 'tasks', label: 'Tasks', icon: <Bars2Icon className="ap-h-4 ap-w-4" />, count: taskCount, color: 'ap-text-blue-600', bgActive: 'ap-bg-blue-50 ap-border-blue-500', bgHover: 'hover:ap-bg-blue-50' },
        { key: 'meetings', label: 'Meetings', icon: <CalendarDaysIcon className="ap-h-4 ap-w-4" />, count: meetingCount, color: 'ap-text-green-600', bgActive: 'ap-bg-green-50 ap-border-green-500', bgHover: 'hover:ap-bg-green-50' },
        { key: 'updates', label: 'Updates', icon: <ChatBubbleIcon className="ap-h-4 ap-w-4" />, count: updateCount, color: 'ap-text-orange-500', bgActive: 'ap-bg-orange-50 ap-border-orange-500', bgHover: 'hover:ap-bg-orange-50' },
    ];

    // ── Render ──────────────────────────────────────────────────────────────
    return (
        <div ref={containerRef} className="ap-hidden lg:ap-block">
            {/* ── Mode toggle + tab bar ── */}
            <div className="ap-flex ap-items-center ap-justify-between ap-mb-2">
                {/* Tab bar (only interactive in tab mode, but always shows labels) */}
                <div className="ap-flex ap-items-center ap-gap-1">
                    {viewMode === 'tabs' && tabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`ap-inline-flex ap-items-center ap-gap-1.5 ap-px-3 ap-py-1.5 ap-rounded-t-lg ap-text-sm ap-font-medium ap-transition-all ap-border-b-2 ${
                                activeTab === tab.key
                                    ? `${tab.bgActive} ${tab.color} ap-shadow-sm`
                                    : `ap-border-transparent ap-text-gray-500 ${tab.bgHover} hover:ap-text-gray-700`
                            }`}
                        >
                            <span className={activeTab === tab.key ? tab.color : ''}>{tab.icon}</span>
                            {tab.label}
                            <span className={`ap-text-xs ap-px-1.5 ap-py-0.5 ap-rounded-full ap-font-semibold ${
                                activeTab === tab.key ? 'ap-bg-white/70' : 'ap-bg-gray-100 ap-text-gray-500'
                            }`}>
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Mode toggle button */}
                <button
                    onClick={() => setViewMode(prev => prev === 'columns' ? 'tabs' : 'columns')}
                    className="ap-inline-flex ap-items-center ap-gap-1.5 ap-px-3 ap-py-1.5 ap-rounded-lg ap-text-xs ap-font-semibold ap-text-white ap-bg-purple-600 hover:ap-bg-purple-700 ap-shadow-sm ap-transition-colors"
                    title={viewMode === 'columns' ? 'Switch to tabs' : 'Switch to columns'}
                >
                    {viewMode === 'columns' ? (
                        <><TabsIcon className="ap-h-4 ap-w-4" /> Tabs</>
                    ) : (
                        <><ColumnsIcon className="ap-h-4 ap-w-4" /> Columns</>
                    )}
                </button>
            </div>

            {/* ── Columns mode ── */}
            {viewMode === 'columns' && (
                <div className="ap-flex ap-gap-0">
                    {/* Tasks */}
                    <div
                        className="ap-flex ap-flex-col ap-min-w-0 ap-overflow-hidden ap-bg-white ap-rounded-l-lg ap-shadow-sm ap-border ap-border-gray-200"
                        style={{ width: `${colWidths[0]}%` }}
                    >
                        {tasksSlot}
                    </div>

                    {/* Divider 1 */}
                    <div
                        className="ap-w-1.5 ap-flex-shrink-0 ap-cursor-col-resize ap-bg-gray-200 hover:ap-bg-purple-400 ap-transition-colors ap-relative ap-group"
                        onMouseDown={(e) => handleMouseDown(0, e)}
                        role="separator"
                        aria-orientation="vertical"
                    >
                        <div className="ap-absolute ap-inset-y-0 -ap-left-1 -ap-right-1 ap-z-10" />
                        <div className="ap-absolute ap-top-1/2 ap-left-1/2 -ap-translate-x-1/2 -ap-translate-y-1/2 ap-opacity-0 group-hover:ap-opacity-100 ap-transition-opacity">
                            <div className="ap-w-1 ap-h-8 ap-bg-purple-500 ap-rounded-full" />
                        </div>
                    </div>

                    {/* Meetings */}
                    <div
                        className="ap-flex ap-flex-col ap-min-w-0 ap-overflow-hidden ap-bg-white ap-shadow-sm ap-border-y ap-border-gray-200"
                        style={{ width: `${colWidths[1]}%` }}
                    >
                        {meetingsSlot}
                    </div>

                    {/* Divider 2 */}
                    <div
                        className="ap-w-1.5 ap-flex-shrink-0 ap-cursor-col-resize ap-bg-gray-200 hover:ap-bg-purple-400 ap-transition-colors ap-relative ap-group"
                        onMouseDown={(e) => handleMouseDown(1, e)}
                        role="separator"
                        aria-orientation="vertical"
                    >
                        <div className="ap-absolute ap-inset-y-0 -ap-left-1 -ap-right-1 ap-z-10" />
                        <div className="ap-absolute ap-top-1/2 ap-left-1/2 -ap-translate-x-1/2 -ap-translate-y-1/2 ap-opacity-0 group-hover:ap-opacity-100 ap-transition-opacity">
                            <div className="ap-w-1 ap-h-8 ap-bg-purple-500 ap-rounded-full" />
                        </div>
                    </div>

                    {/* Updates */}
                    <div
                        className="ap-flex ap-flex-col ap-min-w-0 ap-overflow-hidden ap-bg-white ap-rounded-r-lg ap-shadow-sm ap-border ap-border-gray-200"
                        style={{ width: `${colWidths[2]}%` }}
                    >
                        {updatesSlot}
                    </div>
                </div>
            )}

            {/* ── Tabs mode ── */}
            {viewMode === 'tabs' && (
                <div className="ap-bg-white ap-rounded-lg ap-shadow-sm ap-border ap-border-gray-200">
                    {activeTab === 'tasks' && tasksSlot}
                    {activeTab === 'meetings' && meetingsSlot}
                    {activeTab === 'updates' && updatesSlot}
                </div>
            )}
        </div>
    );
};

export default WorkspaceColumns;
