import React, { useState, useEffect, useMemo } from 'react';
import { Button } from './ui';
import {
    HiOutlinePlus as PlusIcon,
    HiOutlineCheckCircle as CheckIcon,
    HiOutlineMagnifyingGlass as SearchIcon,
    HiOutlinePencil as EditIcon,
    HiOutlineCalendar as CalendarIcon,
} from 'react-icons/hi2';
import { HiDownload as DownloadIcon } from 'react-icons/hi';
import InstructorEvaluationForm from './InstructorEvaluationForm';
import LoadingSpinner from './LoadingSpinner';
import { getInstructorEvaluations, type InstructorEvaluationLog } from '@/services/api-professional-growth';
import { useInstructorEvaluationPermissions } from '@/hooks/useInstructorEvaluationPermissions';
import { downloadCSV, formatDateForCSV, formatBooleanForCSV } from '../utils/csvExport';

interface InstructorEvaluationsViewProps {
    currentUser: {
        id: number;
        name: string;
        isAdmin: boolean;
    };
}

type SortField = 'evaluation_date' | 'evaluated_user_name';

const InstructorEvaluationsView: React.FC<InstructorEvaluationsViewProps> = ({ currentUser }) => {
    const [showForm, setShowForm] = useState(false);
    const [editingEvaluation, setEditingEvaluation] = useState<InstructorEvaluationLog | null>(null);
    const [evaluations, setEvaluations] = useState<InstructorEvaluationLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortField, setSortField] = useState<SortField>('evaluation_date');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [showArchived, setShowArchived] = useState(false);
    const [selectedEvaluations, setSelectedEvaluations] = useState<number[]>([]);
    
    // Get permissions for current user
    const permissions = useInstructorEvaluationPermissions(currentUser.id);

    useEffect(() => {
        loadEvaluations();
    }, [showArchived]);

    const loadEvaluations = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const data = await getInstructorEvaluations({ include_archived: showArchived });
            setEvaluations(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load instructor evaluations');
        } finally {
            setLoading(false);
        }
    };

    const handleFormSuccess = () => {
        setShowForm(false);
        setEditingEvaluation(null);
        loadEvaluations();
    };

    const handleOpenForm = (evaluation?: InstructorEvaluationLog) => {
        if (evaluation) {
            setEditingEvaluation(evaluation);
        } else {
            setEditingEvaluation(null);
        }
        setShowForm(true);
    };

    const handleCloseForm = () => {
        setShowForm(false);
        setEditingEvaluation(null);
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    // Filter and sort evaluations
    const filteredAndSortedEvaluations = useMemo(() => {
        let filtered = evaluations;

        // Apply search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = evaluations.filter(evaluation =>
                evaluation.evaluated_user_name?.toLowerCase().includes(query) ||
                evaluation.evaluator_name?.toLowerCase().includes(query) ||
                evaluation.comments?.toLowerCase().includes(query)
            );
        }

        // Sort
        const sorted = [...filtered].sort((a, b) => {
            let aVal: any = a[sortField];
            let bVal: any = b[sortField];

            // Handle null/undefined values
            if (aVal === null || aVal === undefined) aVal = '';
            if (bVal === null || bVal === undefined) bVal = '';

            // Compare values
            if (typeof aVal === 'string') {
                return sortDirection === 'asc' 
                    ? aVal.localeCompare(bVal)
                    : bVal.localeCompare(aVal);
            } else {
                return sortDirection === 'asc'
                    ? aVal - bVal
                    : bVal - aVal;
            }
        });

        return sorted;
    }, [evaluations, searchQuery, sortField, sortDirection]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const getSortIcon = (field: SortField) => {
        if (sortField !== field) return null;
        return sortDirection === 'asc' ? ' ↑' : ' ↓';
    };

    const handleToggleSelect = (evalId: number) => {
        setSelectedEvaluations(prev => 
            prev.includes(evalId) 
                ? prev.filter(id => id !== evalId)
                : [...prev, evalId]
        );
    };

    const handleToggleSelectAll = () => {
        if (selectedEvaluations.length === filteredAndSortedEvaluations.length) {
            setSelectedEvaluations([]);
        } else {
            setSelectedEvaluations(filteredAndSortedEvaluations.map(evaluation => evaluation.id));
        }
    };

    const handleBulkArchive = async () => {
        const nonArchivedSelected = selectedEvaluations.filter(id => 
            !evaluations.find(evaluation => evaluation.id === id)?.archived
        );

        if (nonArchivedSelected.length === 0) {
            alert('No non-archived evaluations selected');
            return;
        }

        if (!confirm(`Are you sure you want to archive ${nonArchivedSelected.length} evaluation(s)?`)) {
            return;
        }

        try {
            const { bulkArchiveInstructorEvaluations } = await import('../services/api-professional-growth');
            await bulkArchiveInstructorEvaluations(nonArchivedSelected);
            setSelectedEvaluations([]);
            loadEvaluations();
        } catch (error) {
            console.error('Error bulk archiving instructor evaluations:', error);
            alert('Failed to archive instructor evaluations');
        }
    };

    const handleBulkRestore = async () => {
        const archivedSelected = selectedEvaluations.filter(id => 
            evaluations.find(evaluation => evaluation.id === id)?.archived
        );

        if (archivedSelected.length === 0) {
            alert('No archived evaluations selected');
            return;
        }

        if (!confirm(`Are you sure you want to restore ${archivedSelected.length} evaluation(s)?`)) {
            return;
        }

        try {
            const { bulkRestoreInstructorEvaluations } = await import('../services/api-professional-growth');
            await bulkRestoreInstructorEvaluations(archivedSelected);
            setSelectedEvaluations([]);
            loadEvaluations();
        } catch (error) {
            console.error('Error bulk restoring instructor evaluations:', error);
            alert('Failed to restore instructor evaluations');
        }
    };

    const handleDownloadCSV = async () => {
        try {
            // Fetch all evaluations including archived
            const allEvaluations = await getInstructorEvaluations({ include_archived: true });
            
            if (allEvaluations.length === 0) {
                alert('No instructor evaluations to export');
                return;
            }

            // Prepare data for CSV
            const csvData = allEvaluations.map(evaluation => ({
                'Date': formatDateForCSV(evaluation.evaluation_date),
                'Instructor': evaluation.evaluated_user_name || '',
                'Evaluator': evaluation.evaluator_name || '',
                'Command Language': formatBooleanForCSV(evaluation.command_language),
                'Minimizing Downtime': formatBooleanForCSV(evaluation.minimizing_downtime),
                'Periodic Challenges': formatBooleanForCSV(evaluation.periodic_challenges),
                'Provides Feedback': formatBooleanForCSV(evaluation.provides_feedback),
                'Rules & Expectations': formatBooleanForCSV(evaluation.rules_expectations),
                'Learning Environment': formatBooleanForCSV(evaluation.learning_environment),
                'Comments': evaluation.comments || '',
                'Archived': evaluation.archived ? 'Yes' : 'No',
                'Created At': formatDateForCSV(evaluation.created_at),
            }));

            downloadCSV(csvData, 'instructor_evaluations');
        } catch (error) {
            console.error('Error downloading CSV:', error);
            alert('Failed to generate CSV export');
        }
    };

    // Count how many criteria are met
    const countCriteriaMet = (evaluation: InstructorEvaluationLog) => {
        const criteria = [
            evaluation.command_language,
            evaluation.minimizing_downtime,
            evaluation.periodic_challenges,
            evaluation.provides_feedback,
            evaluation.rules_expectations,
            evaluation.learning_environment
        ];
        return criteria.filter(Boolean).length;
    };

    // Get list of criteria that got "No" (needs improvement)
    const getNeedsImprovement = (evaluation: InstructorEvaluationLog): string[] => {
        const criteriaLabels: [keyof InstructorEvaluationLog, string][] = [
            ['command_language', 'Command Language'],
            ['minimizing_downtime', 'Minimizing Downtime'],
            ['periodic_challenges', 'Periodic Challenges'],
            ['provides_feedback', 'Provides Feedback'],
            ['rules_expectations', 'Rules & Expectations'],
            ['learning_environment', 'Learning Environment']
        ];
        
        return criteriaLabels
            .filter(([key]) => !evaluation[key])
            .map(([, label]) => label);
    };

    if (showForm) {
        return (
            <div className="ap-bg-white ap-rounded-lg ap-shadow ap-p-6">
                <div className="ap-mb-6">
                    <h2 className="ap-text-2xl ap-font-bold ap-text-gray-900">
                        {editingEvaluation ? 'Edit Instructor Evaluation' : 'New Instructor Evaluation'}
                    </h2>
                    <p className="ap-text-sm ap-text-gray-600 ap-mt-1">
                        {editingEvaluation 
                            ? 'Update the instructor evaluation details' : 'Record observations ap-from a swim instructor evaluation'
                        }
                    </p>
                </div>
                <InstructorEvaluationForm
                    editingEvaluation={editingEvaluation}
                    onSuccess={handleFormSuccess}
                    onCancel={handleCloseForm}
                />
            </div>
        );
    }

    return (
        <div className="ap-bg-white ap-rounded-lg ap-shadow">
            {/* Header */}
            <div className="ap-p-6 ap-border-b ap-border-gray-200">
                <div className="ap-flex ap-items-center ap-justify-between ap-mb-4">
                    <div>
                        <h2 className="ap-text-2xl ap-font-bold ap-text-gray-900">Instructor Evaluations</h2>
                        <p className="ap-text-sm ap-text-gray-600 ap-mt-1">
                            Track swim instructor performance evaluations
                        </p>
                    </div>
                    {(permissions.canCreate || currentUser.isAdmin) && (
                        <Button
                            variant="primary"
                            onClick={() => handleOpenForm()}
                        >
                            <PlusIcon className="ap-h-5 ap-w-5 ap-mr-2" />
                            New Evaluation
                        </Button>
                    )}
                </div>

                {/* Search and Filter Controls */}
                <div className="ap-flex ap-flex-col sm:ap-flex-row ap-gap-3 ap-items-start sm:ap-items-center ap-justify-between">
                    <div className="ap-relative ap-flex-1 ap-max-w-md">
                        <div className="ap-absolute ap-inset-y-0 ap-left-0 ap-pl-3 ap-flex ap-items-center ap-pointer-events-none">
                            <SearchIcon className="ap-h-5 ap-w-5 ap-text-gray-400" />
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search evaluations..."
                            className="ap-block ap-w-full ap-pl-10 ap-pr-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-md ap-leading-5 ap-bg-white ap-placeholder-gray-500 focus:ap-outline-none focus:ap-placeholder-gray-400 focus:ap-ring-1 focus:ap-ring-blue-500 focus:ap-border-blue-500 sm:ap-text-sm"
                        />
                    </div>
                    <div className="ap-flex ap-items-center ap-gap-2">
                        <Button
                            variant="outline"
                            onClick={handleDownloadCSV}
                            title="Download all records as CSV"
                        >
                            <DownloadIcon className="ap-h-4 ap-w-4 ap-mr-2" />
                            Export CSV
                        </Button>
                        <label className="ap-inline-flex ap-items-center ap-cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showArchived}
                                onChange={(e) => setShowArchived(e.target.checked)}
                                className="ap-h-4 ap-w-4 ap-text-blue-600 focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded"
                            />
                            <span className="ap-ml-2 ap-text-sm ap-text-gray-700">Show Archived</span>
                        </label>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="ap-p-6">
                {loading ? (
                    <div className="ap-text-center ap-py-8">
                        <LoadingSpinner />
                        <span className="ap-ml-3 ap-text-gray-600">Loading evaluations...</span>
                    </div>
                ) : error ? (
                    <div className="ap-text-center ap-py-12">
                        <p className="ap-text-red-600">{error}</p>
                        <Button
                            variant="link"
                            onClick={loadEvaluations}
                            className="!ap-mt-4"
                        >
                            Try again
                        </Button>
                    </div>
                ) : filteredAndSortedEvaluations.length === 0 ? (
                    <div className="ap-text-center ap-py-8 ap-text-gray-500">
                        {evaluations.length === 0 
                            ? 'No instructor evaluations yet. Click "New Evaluation" ap-to create one.' : 'No instructor evaluations match your search criteria.'}
                    </div>
                ) : (
                    <>
                        {/* Bulk Actions */}
                        {selectedEvaluations.length > 0 && (
                            <div className="ap-mb-4 ap-flex ap-items-center ap-gap-3 ap-bg-blue-50 ap-border ap-border-blue-200 ap-rounded-lg ap-p-3">
                                <span className="ap-text-sm ap-font-medium ap-text-blue-900">
                                    {selectedEvaluations.length} item{selectedEvaluations.length !== 1 ? 's' : ''} selected
                                </span>
                                {selectedEvaluations.some(id => !evaluations.find(evaluation => evaluation.id === id)?.archived) && (
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={handleBulkArchive}
                                        className="!ap-bg-orange-600 hover:!ap-bg-orange-700 !ap-text-white"
                                    >
                                        Archive Selected
                                    </Button>
                                )}
                                {selectedEvaluations.some(id => evaluations.find(evaluation => evaluation.id === id)?.archived) && (
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={handleBulkRestore}
                                        className="!ap-bg-green-600 hover:!ap-bg-green-700 !ap-text-white"
                                    >
                                        Restore Selected
                                    </Button>
                                )}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedEvaluations([])}
                                    className="!ap-ml-auto"
                                >
                                    Clear Selection
                                </Button>
                            </div>
                        )}
                        <div className="ap-overflow-x-auto">
                        <table className="ap-min-w-full ap-divide-y ap-divide-gray-200">
                            <thead className="ap-bg-gray-50">
                                <tr>
                                    <th className="ap-px-6 ap-py-3 ap-text-left">
                                        <input
                                            type="checkbox"
                                            checked={selectedEvaluations.length === filteredAndSortedEvaluations.length && filteredAndSortedEvaluations.length > 0}
                                            onChange={handleToggleSelectAll}
                                            className="ap-h-4 ap-w-4 ap-text-blue-600 focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded ap-cursor-pointer"
                                            title="Select all"
                                        />
                                    </th>
                                    <th 
                                        onClick={() => handleSort('evaluation_date')}
                                        className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100"
                                    >
                                        Date{getSortIcon('evaluation_date')}
                                    </th>
                                    <th 
                                        onClick={() => handleSort('evaluated_user_name')}
                                        className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100"
                                    >
                                        Instructor{getSortIcon('evaluated_user_name')}
                                    </th>
                                    <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                        Evaluator
                                    </th>
                                    <th className="ap-px-6 ap-py-3 ap-text-center ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                        Score
                                    </th>
                                    <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                        Needs Improvement
                                    </th>
                                    <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-min-w-[400px]">
                                        Notes
                                    </th>
                                    <th className="ap-sticky ap-right-0 ap-bg-gray-50 ap-px-6 ap-py-3 ap-text-right ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)]">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="ap-bg-white ap-divide-y ap-divide-gray-200">
                                {filteredAndSortedEvaluations.map((evaluation) => {
                                    const criteriaMet = countCriteriaMet(evaluation);
                                    return (
                                        <tr key={evaluation.id} className={`hover:ap-bg-gray-50 ${evaluation.archived ? 'ap-bg-gray-100 ap-opacity-75' : ''}`}>
                                            <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedEvaluations.includes(evaluation.id)}
                                                    onChange={() => handleToggleSelect(evaluation.id)}
                                                    className="ap-h-4 ap-w-4 ap-text-blue-600 focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded ap-cursor-pointer"
                                                />
                                            </td>
                                            <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap">
                                                <div className="ap-flex ap-items-center ap-text-sm ap-text-gray-900">
                                                    {evaluation.archived && <span className="ap-text-xs ap-text-gray-500 ap-mr-2">[ARCHIVED]</span>}
                                                    <CalendarIcon className="ap-w-4 ap-h-4 ap-mr-2 ap-text-gray-400" />
                                                    {evaluation.evaluation_date && formatDate(evaluation.evaluation_date)}
                                                </div>
                                            </td>
                                            <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap">
                                                <div className="ap-text-sm ap-font-medium ap-text-gray-900">
                                                    {evaluation.evaluated_user_name || `User #${evaluation.evaluated_user_id}`}
                                                </div>
                                            </td>
                                            <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap">
                                                <div className="ap-text-sm ap-text-gray-500">
                                                    {evaluation.evaluator_name || '-'}
                                                </div>
                                            </td>
                                            <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-center">
                                                <span className={`ap-inline-flex ap-items-center ap-px-2.5 ap-py-0.5 ap-rounded-full ap-text-xs ap-font-medium ${
                                                    criteriaMet === 6 ? 'ap-bg-green-100 ap-text-green-800' :
                                                    criteriaMet >= 4 ? 'ap-bg-yellow-100 ap-text-yellow-800' : 'ap-bg-red-100 ap-text-red-800'
                                                }`}>
                                                    {criteriaMet}/6
                                                </span>
                                            </td>
                                            <td className="ap-px-6 ap-py-4">
                                                {(() => {
                                                    const needsImprovement = getNeedsImprovement(evaluation);
                                                    return needsImprovement.length > 0 ? (
                                                        <div className="ap-flex ap-flex-wrap ap-gap-1">
                                                            {needsImprovement.map((item) => (
                                                                <span 
                                                                    key={item} 
                                                                    className="ap-inline-flex ap-items-center ap-px-2 ap-py-0.5 ap-rounded ap-text-xs ap-font-medium ap-bg-red-100 ap-text-red-800"
                                                                >
                                                                    {item}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="ap-text-green-600 ap-text-sm ap-flex ap-items-center">
                                                            <CheckIcon className="ap-w-4 ap-h-4 ap-mr-1" />
                                                            All criteria met
                                                        </span>
                                                    );
                                                })()}
                                            </td>
                                            <td className="ap-px-6 ap-py-3 ap-min-w-[400px]">
                                                <div className="ap-text-sm ap-text-gray-700 ap-whitespace-pre-wrap">
                                                    {(evaluation.comments || '-')
                                                        .replace(/<p>/g, '')
                                                        .replace(/<\/p>/g, '\n')
                                                        .replace(/<br\s*\/?>/g, '\n')
                                                        .replace(/<[^>]+>/g, '') // Strip any other HTML tags
                                                        .trim()
                                                    }
                                                </div>
                                            </td>
                                            <td className="ap-sticky ap-right-0 ap-bg-white ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-right ap-text-sm ap-font-medium ap-shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)]">
                                                {(() => {
                                                    const isOwner = Number(evaluation.evaluator_id) === currentUser.id;
                                                    const canEditThis = (isOwner && permissions.canEdit) || permissions.canModerateAll || currentUser.isAdmin;
                                                    
                                                    return canEditThis ? (
                                                        <Button
                                                            variant="ghost"
                                                            size="xs"
                                                            onClick={() => handleOpenForm(evaluation)}
                                                            className="!ap-p-1.5 !ap-min-h-0 !ap-text-blue-600 hover:!ap-text-blue-900"
                                                            title="Edit evaluation"
                                                        >
                                                            <EditIcon className="ap-w-5 ap-h-5" />
                                                        </Button>
                                                    ) : null;
                                                })()}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default InstructorEvaluationsView;
