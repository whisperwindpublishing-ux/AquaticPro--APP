import React from 'react';
import { formatLocalDate } from '@/utils/dateUtils';
import { Goal, Task, Meeting, Update, Initiative } from '@/types';

interface GoalPrintViewProps {
    goal: Goal;
}

/**
 * Print-optimized linearized view of all goal content.
 * Hidden on screen (`ap-hidden`), shown only when printing (`print-only`).
 * Renders: Header → Initiatives → Tasks → Meetings (fully expanded) → Updates → Timeline.
 */
const GoalPrintView: React.FC<GoalPrintViewProps> = ({ goal }) => {
    const completedTasks = goal.tasks.filter(t => t.isCompleted);
    const pendingTasks = goal.tasks.filter(t => !t.isCompleted);
    const sortedMeetings = [...goal.meetings].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const sortedUpdates = [...goal.updates].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return (
        <div className="ap-hidden print-only" style={{ display: 'none' }}>
            {/* ── Header ───────────────────────────────────────────────── */}
            <div className="print-section" style={{ marginBottom: '16pt' }}>
                <h2 style={{ fontSize: '20pt', fontWeight: 700, color: '#1e293b', borderBottom: '2pt solid #7c3aed', paddingBottom: '6pt' }}>
                    {goal.title}
                </h2>

                {/* Mentor / Mentee */}
                {(goal.mentor || goal.mentee) && (
                    <div style={{ display: 'flex', gap: '24pt', marginTop: '8pt', fontSize: '10pt', color: '#475569' }}>
                        {goal.mentee && (
                            <span>
                                <strong>Goal Owner:</strong> {goal.mentee.firstName} {goal.mentee.lastName}
                            </span>
                        )}
                        {goal.mentor && (
                            <span>
                                <strong>Mentor:</strong> {goal.mentor.firstName} {goal.mentor.lastName}
                            </span>
                        )}
                    </div>
                )}

                {/* Status */}
                <div style={{ marginTop: '6pt', fontSize: '10pt' }}>
                    <strong>Status:</strong>{' '}
                    <span style={{
                        padding: '2pt 8pt',
                        borderRadius: '4pt',
                        fontSize: '9pt',
                        fontWeight: 600,
                        backgroundColor: goal.status === 'Completed' ? '#dcfce7' : goal.status === 'In Progress' ? '#fef9c3' : '#f1f5f9',
                        color: goal.status === 'Completed' ? '#166534' : goal.status === 'In Progress' ? '#854d0e' : '#475569',
                    }}>
                        {goal.status}
                    </span>
                    {goal.isPortfolio && (
                        <span style={{ marginLeft: '8pt', fontSize: '9pt', color: '#6366f1' }}>
                            ★ Public Portfolio
                        </span>
                    )}
                </div>

                {/* Description */}
                {goal.description && (
                    <div
                        style={{ marginTop: '10pt', fontSize: '10pt', color: '#334155', lineHeight: 1.5 }}
                        dangerouslySetInnerHTML={{ __html: goal.description }}
                    />
                )}
            </div>

            {/* ── Initiatives ──────────────────────────────────────────── */}
            {goal.initiatives.length > 0 && (
                <div className="print-section" style={{ marginBottom: '16pt' }}>
                    <h3 style={{ fontSize: '14pt', fontWeight: 600, color: '#1e293b', borderBottom: '1pt solid #e2e8f0', paddingBottom: '4pt' }}>
                        Initiatives
                    </h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt', marginTop: '6pt' }}>
                        <thead>
                            <tr style={{ borderBottom: '1pt solid #cbd5e1' }}>
                                <th style={{ textAlign: 'left', padding: '4pt 8pt', fontWeight: 600, color: '#475569' }}>#</th>
                                <th style={{ textAlign: 'left', padding: '4pt 8pt', fontWeight: 600, color: '#475569' }}>Initiative</th>
                                <th style={{ textAlign: 'left', padding: '4pt 8pt', fontWeight: 600, color: '#475569' }}>Status</th>
                                <th style={{ textAlign: 'left', padding: '4pt 8pt', fontWeight: 600, color: '#475569' }}>Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            {goal.initiatives.map((init: Initiative, idx: number) => (
                                <tr key={init.id} style={{ borderBottom: '0.5pt solid #e2e8f0' }}>
                                    <td style={{ padding: '4pt 8pt', color: '#64748b' }}>{idx + 1}</td>
                                    <td style={{ padding: '4pt 8pt', fontWeight: 500 }}>{init.title}</td>
                                    <td style={{ padding: '4pt 8pt' }}>
                                        <InitiativeStatusBadge status={init.status} />
                                    </td>
                                    <td style={{ padding: '4pt 8pt', color: '#64748b', maxWidth: '300pt' }}>
                                        {init.description || '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Tasks ────────────────────────────────────────────────── */}
            <div className="print-section" style={{ marginBottom: '16pt' }}>
                <h3 style={{ fontSize: '14pt', fontWeight: 600, color: '#1e293b', borderBottom: '1pt solid #e2e8f0', paddingBottom: '4pt' }}>
                    Tasks ({completedTasks.length}/{goal.tasks.length} completed)
                </h3>

                {pendingTasks.length > 0 && (
                    <div style={{ marginTop: '6pt' }}>
                        <h4 style={{ fontSize: '10pt', fontWeight: 600, color: '#ef4444', marginBottom: '4pt' }}>Pending</h4>
                        {pendingTasks.map((task: Task) => (
                            <PrintTask key={task.id} task={task} initiatives={goal.initiatives} />
                        ))}
                    </div>
                )}

                {completedTasks.length > 0 && (
                    <div style={{ marginTop: '8pt' }}>
                        <h4 style={{ fontSize: '10pt', fontWeight: 600, color: '#16a34a', marginBottom: '4pt' }}>Completed</h4>
                        {completedTasks.map((task: Task) => (
                            <PrintTask key={task.id} task={task} initiatives={goal.initiatives} />
                        ))}
                    </div>
                )}

                {goal.tasks.length === 0 && (
                    <p style={{ fontSize: '10pt', color: '#94a3b8', marginTop: '6pt', fontStyle: 'italic' }}>No tasks</p>
                )}
            </div>

            {/* ── Meetings (fully expanded) ────────────────────────────── */}
            <div className="print-section print-page-break" style={{ marginBottom: '16pt' }}>
                <h3 style={{ fontSize: '14pt', fontWeight: 600, color: '#1e293b', borderBottom: '1pt solid #e2e8f0', paddingBottom: '4pt' }}>
                    Meetings ({goal.meetings.length})
                </h3>

                {sortedMeetings.map((meeting: Meeting) => (
                    <PrintMeeting key={meeting.id} meeting={meeting} initiatives={goal.initiatives} />
                ))}

                {goal.meetings.length === 0 && (
                    <p style={{ fontSize: '10pt', color: '#94a3b8', marginTop: '6pt', fontStyle: 'italic' }}>No meetings recorded</p>
                )}
            </div>

            {/* ── Updates ──────────────────────────────────────────────── */}
            <div className="print-section print-page-break" style={{ marginBottom: '16pt' }}>
                <h3 style={{ fontSize: '14pt', fontWeight: 600, color: '#1e293b', borderBottom: '1pt solid #e2e8f0', paddingBottom: '4pt' }}>
                    Updates ({goal.updates.length})
                </h3>

                {sortedUpdates.map((update: Update) => (
                    <PrintUpdate key={update.id} update={update} />
                ))}

                {goal.updates.length === 0 && (
                    <p style={{ fontSize: '10pt', color: '#94a3b8', marginTop: '6pt', fontStyle: 'italic' }}>No updates</p>
                )}
            </div>

            {/* ── Print Footer ─────────────────────────────────────────── */}
            <div style={{ marginTop: '24pt', paddingTop: '8pt', borderTop: '1pt solid #cbd5e1', fontSize: '8pt', color: '#94a3b8', textAlign: 'center' }}>
                Exported from AquaticPro Mentorship Platform • {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
        </div>
    );
};

// ── Sub-components ────────────────────────────────────────────────────────────

const InitiativeStatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const colors: Record<string, { bg: string; text: string }> = {
        'Not Started': { bg: '#f1f5f9', text: '#475569' },
        'In Progress': { bg: '#fef9c3', text: '#854d0e' },
        'Completed': { bg: '#dcfce7', text: '#166534' },
    };
    const c = colors[status] || colors['Not Started'];
    return (
        <span style={{ padding: '1pt 6pt', borderRadius: '3pt', fontSize: '8pt', fontWeight: 600, backgroundColor: c.bg, color: c.text }}>
            {status}
        </span>
    );
};

const PrintTask: React.FC<{ task: Task; initiatives: Initiative[] }> = ({ task, initiatives }) => {
    const initiative = task.initiativeId ? initiatives.find(i => i.id === task.initiativeId) : null;

    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6pt', padding: '3pt 0', fontSize: '10pt', breakInside: 'avoid' }}>
            <span style={{ fontSize: '10pt', flexShrink: 0 }}>
                {task.isCompleted ? '☑' : '☐'}
            </span>
            <div style={{ flex: 1 }}>
                <span style={{ textDecoration: task.isCompleted ? 'line-through' : 'none', color: task.isCompleted ? '#94a3b8' : '#1e293b' }}>
                    {task.text}
                </span>
                {(task.dueDate || task.assignedToName || initiative) && (
                    <span style={{ marginLeft: '6pt', fontSize: '8pt', color: '#94a3b8' }}>
                        {task.dueDate && `Due: ${formatLocalDate(task.dueDate)}`}
                        {task.assignedToName && ` · ${task.assignedToName}`}
                        {initiative && ` · ${initiative.title}`}
                    </span>
                )}
            </div>
        </div>
    );
};

const PrintMeeting: React.FC<{ meeting: Meeting; initiatives: Initiative[] }> = ({ meeting, initiatives }) => {
    const initiative = meeting.initiativeId ? initiatives.find(i => i.id === meeting.initiativeId) : null;

    return (
        <div style={{ marginTop: '10pt', padding: '8pt', border: '0.5pt solid #e2e8f0', borderRadius: '4pt', breakInside: 'avoid', pageBreakInside: 'avoid' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h4 style={{ fontSize: '11pt', fontWeight: 600, color: '#1e293b', margin: 0 }}>
                    {meeting.topic}
                </h4>
                <span style={{ fontSize: '9pt', color: '#64748b' }}>
                    {formatLocalDate(meeting.date, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
            </div>

            {initiative && (
                <div style={{ fontSize: '8pt', color: '#7c3aed', marginTop: '2pt' }}>
                    Initiative: {initiative.title}
                </div>
            )}

            {/* Agenda / Talking Points */}
            {meeting.agenda && meeting.agenda.length > 0 && (
                <div style={{ marginTop: '6pt' }}>
                    <strong style={{ fontSize: '9pt', color: '#475569' }}>Agenda:</strong>
                    <ul style={{ margin: '2pt 0 0 16pt', padding: 0, fontSize: '9pt', color: '#334155' }}>
                        {meeting.agenda.map((item, idx) => (
                            <li key={idx} style={{ marginBottom: '2pt' }}>
                                {item.text}
                                {item.isDiscussed && <span style={{ color: '#16a34a', marginLeft: '4pt' }}>✓</span>}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Notes */}
            {meeting.notes && (
                <div style={{ marginTop: '6pt' }}>
                    <strong style={{ fontSize: '9pt', color: '#475569' }}>Notes:</strong>
                    <div
                        style={{ marginTop: '2pt', fontSize: '9pt', color: '#334155', lineHeight: 1.4 }}
                        dangerouslySetInnerHTML={{ __html: meeting.notes }}
                    />
                </div>
            )}

            {/* Decisions */}
            {meeting.decisions && meeting.decisions.length > 0 && (
                <div style={{ marginTop: '6pt' }}>
                    <strong style={{ fontSize: '9pt', color: '#475569' }}>Decisions:</strong>
                    <ul style={{ margin: '2pt 0 0 16pt', padding: 0, fontSize: '9pt', color: '#334155' }}>
                        {meeting.decisions.map((d, idx) => (
                            <li key={idx} style={{ marginBottom: '2pt' }}>{d.text}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Author */}
            <div style={{ marginTop: '4pt', fontSize: '8pt', color: '#94a3b8' }}>
                Recorded by: {meeting.author.firstName} {meeting.author.lastName}
            </div>
        </div>
    );
};

const PrintUpdate: React.FC<{ update: Update }> = ({ update }) => {
    return (
        <div style={{ marginTop: '8pt', padding: '6pt 8pt', borderLeft: '3pt solid #7c3aed', breakInside: 'avoid', pageBreakInside: 'avoid' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4pt' }}>
                <strong style={{ fontSize: '10pt', color: '#1e293b' }}>
                    {update.author.firstName} {update.author.lastName}
                </strong>
                <span style={{ fontSize: '8pt', color: '#94a3b8' }}>
                    {formatLocalDate(update.date, { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
            </div>
            <div
                style={{ fontSize: '9pt', color: '#334155', lineHeight: 1.4 }}
                dangerouslySetInnerHTML={{ __html: update.text }}
            />
            {update.attachments && update.attachments.length > 0 && (
                <div style={{ marginTop: '3pt', fontSize: '8pt', color: '#64748b' }}>
                    📎 {update.attachments.length} attachment{update.attachments.length !== 1 ? 's' : ''}
                </div>
            )}
        </div>
    );
};

export default GoalPrintView;
