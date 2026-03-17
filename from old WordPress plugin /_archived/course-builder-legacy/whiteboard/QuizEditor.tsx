/**
 * Quiz Editor Component
 * 
 * Admin interface for creating and editing quizzes with multiple question types.
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    HiOutlinePlus,
    HiOutlineTrash,
    HiOutlinePencil,
    HiOutlineChevronDown,
    HiOutlineChevronUp,
    HiOutlineCheckCircle,
    HiOutlineXCircle,
    HiOutlineBars3,
    HiOutlinePhoto,
    HiOutlineCog6Tooth,
} from 'react-icons/hi2';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Quiz, Question, QuestionType, QuestionOption, MultipleChoiceQuestion, MultipleSelectQuestion, TrueFalseQuestion, ShortAnswerQuestion } from './types';
import * as api from './api';

// ============================================================================
// QUESTION TYPE CONFIG
// ============================================================================

const questionTypeConfig: Record<QuestionType, { label: string; description: string }> = {
    'multiple-choice': { label: 'Multiple Choice', description: 'Single correct answer' },
    'multiple-select': { label: 'Multiple Select', description: 'Multiple correct answers' },
    'true-false': { label: 'True/False', description: 'Boolean answer' },
    'short-answer': { label: 'Short Answer', description: 'Text input with keyword matching' },
    'ordering': { label: 'Ordering', description: 'Arrange items in sequence' },
    'matching': { label: 'Matching', description: 'Match pairs of items' },
    'hotspot': { label: 'Hotspot', description: 'Click correct area on image' },
};

// ============================================================================
// SORTABLE QUESTION ITEM
// ============================================================================

interface SortableQuestionProps {
    question: Question;
    index: number;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onEdit: () => void;
    onDelete: () => void;
}

const SortableQuestion: React.FC<SortableQuestionProps> = ({
    question,
    index,
    isExpanded,
    onToggleExpand,
    onEdit,
    onDelete,
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: question.id });
    
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };
    
    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`bg-white rounded-lg border ${isDragging ? 'border-blue-300 shadow-lg' : 'border-gray-200'}`}
        >
            {/* Question header */}
            <div className="flex items-center gap-3 p-4">
                {/* Drag handle */}
                <button
                    {...attributes}
                    {...listeners}
                    className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
                >
                    <HiOutlineBars3 className="w-5 h-5" />
                </button>
                
                {/* Question number */}
                <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">
                    {index + 1}
                </span>
                
                {/* Question info */}
                <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                        {question.question_text}
                    </p>
                    <p className="text-sm text-gray-500">
                        {questionTypeConfig[question.question_type]?.label} • {question.points} {question.points === 1 ? 'point' : 'points'}
                    </p>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={onEdit}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                        <HiOutlinePencil className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onDelete}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                        <HiOutlineTrash className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onToggleExpand}
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        {isExpanded ? <HiOutlineChevronUp className="w-4 h-4" /> : <HiOutlineChevronDown className="w-4 h-4" />}
                    </button>
                </div>
            </div>
            
            {/* Expanded content preview */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-gray-100 px-4 pb-4"
                    >
                        <div className="pt-4">
                            {question.question_image_url && (
                                <img
                                    src={question.question_image_url}
                                    alt="Question"
                                    className="mb-4 rounded-lg max-h-32 object-contain"
                                />
                            )}
                            
                            {/* Show options for multiple choice */}
                            {(question.question_type === 'multiple-choice' || question.question_type === 'multiple-select') && (
                                <div className="space-y-2">
                                    {((question as MultipleChoiceQuestion | MultipleSelectQuestion).options || []).map((opt) => {
                                        const isCorrect = question.question_type === 'multiple-choice'
                                            ? (question as MultipleChoiceQuestion).correct_option_id === opt.id
                                            : (question as MultipleSelectQuestion).correct_option_ids?.includes(opt.id);
                                        
                                        return (
                                            <div
                                                key={opt.id}
                                                className={`flex items-center gap-2 p-2 rounded ${
                                                    isCorrect ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-600'
                                                }`}
                                            >
                                                {isCorrect ? (
                                                    <HiOutlineCheckCircle className="w-4 h-4 text-green-500" />
                                                ) : (
                                                    <HiOutlineXCircle className="w-4 h-4 text-gray-400" />
                                                )}
                                                <span className="text-sm">{opt.text}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            
                            {/* True/False */}
                            {question.question_type === 'true-false' && (
                                <p className="text-sm text-green-600">
                                    Correct answer: {(question as TrueFalseQuestion).correct_answer ? 'True' : 'False'}
                                </p>
                            )}
                            
                            {/* Short answer */}
                            {question.question_type === 'short-answer' && (
                                <div className="text-sm text-gray-600">
                                    <span className="font-medium">Accepted answers: </span>
                                    {(question as ShortAnswerQuestion).accepted_answers?.join(', ')}
                                </div>
                            )}
                            
                            {/* Explanation */}
                            {question.explanation && (
                                <div className="mt-3 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                                    <span className="font-medium">Explanation: </span>
                                    {question.explanation}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ============================================================================
// QUESTION EDITOR MODAL
// ============================================================================

interface QuestionEditorProps {
    question?: Question;
    quizId: number;
    onSave: (question: Question) => void;
    onClose: () => void;
}

const QuestionEditor: React.FC<QuestionEditorProps> = ({
    question,
    quizId,
    onSave,
    onClose,
}) => {
    const [questionType, setQuestionType] = useState<QuestionType>(
        question?.question_type || 'multiple-choice'
    );
    const [questionText, setQuestionText] = useState(question?.question_text || '');
    const [questionImageUrl, setQuestionImageUrl] = useState(question?.question_image_url || '');
    const [explanation, setExplanation] = useState(question?.explanation || '');
    const [points, setPoints] = useState(question?.points || 1);
    const [isSaving, setIsSaving] = useState(false);
    
    // Multiple choice options
    const [options, setOptions] = useState<QuestionOption[]>(() => {
        if (question?.question_type === 'multiple-choice' || question?.question_type === 'multiple-select') {
            return (question as MultipleChoiceQuestion | MultipleSelectQuestion).options || [
                { id: 1, text: '' },
                { id: 2, text: '' },
                { id: 3, text: '' },
                { id: 4, text: '' },
            ];
        }
        return [
            { id: 1, text: '' },
            { id: 2, text: '' },
            { id: 3, text: '' },
            { id: 4, text: '' },
        ];
    });
    const [correctOptionId, setCorrectOptionId] = useState<number>(() => {
        if (question?.question_type === 'multiple-choice') {
            return (question as MultipleChoiceQuestion).correct_option_id || 1;
        }
        return 1;
    });
    const [correctOptionIds, setCorrectOptionIds] = useState<number[]>(() => {
        if (question?.question_type === 'multiple-select') {
            return (question as MultipleSelectQuestion).correct_option_ids || [];
        }
        return [];
    });
    
    // True/False
    const [trueFalseAnswer, setTrueFalseAnswer] = useState<boolean>(() => {
        if (question?.question_type === 'true-false') {
            return (question as TrueFalseQuestion).correct_answer ?? true;
        }
        return true;
    });
    
    // Short answer
    const [acceptedAnswers, setAcceptedAnswers] = useState<string>(() => {
        if (question?.question_type === 'short-answer') {
            return ((question as ShortAnswerQuestion).accepted_answers || []).join('\n');
        }
        return '';
    });
    
    // Add new option
    const addOption = () => {
        const newId = Math.max(...options.map(o => o.id)) + 1;
        setOptions([...options, { id: newId, text: '' }]);
    };
    
    // Remove option
    const removeOption = (id: number) => {
        if (options.length <= 2) return;
        setOptions(options.filter(o => o.id !== id));
    };
    
    // Update option text
    const updateOption = (id: number, text: string) => {
        setOptions(options.map(o => o.id === id ? { ...o, text } : o));
    };
    
    // Toggle correct option for multiple select
    const toggleCorrectOption = (id: number) => {
        if (correctOptionIds.includes(id)) {
            setCorrectOptionIds(correctOptionIds.filter(i => i !== id));
        } else {
            setCorrectOptionIds([...correctOptionIds, id]);
        }
    };
    
    // Build question data based on type
    const buildQuestionData = () => {
        switch (questionType) {
            case 'multiple-choice':
                return { options, correct_option_id: correctOptionId };
            case 'multiple-select':
                return { options, correct_option_ids: correctOptionIds };
            case 'true-false':
                return { correct_answer: trueFalseAnswer };
            case 'short-answer':
                return { 
                    accepted_answers: acceptedAnswers.split('\n').filter(a => a.trim()),
                    case_sensitive: false,
                };
            default:
                return {};
        }
    };
    
    // Save question
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const questionData = buildQuestionData();
            
            if (question?.id) {
                // Update existing
                const response = await api.updateQuestion(question.id, {
                    question_type: questionType,
                    question_text: questionText,
                    question_image_url: questionImageUrl || undefined,
                    question_data: questionData,
                    explanation: explanation || undefined,
                    points,
                });
                if (response.success && response.data) {
                    onSave(response.data);
                }
            } else {
                // Create new
                const response = await api.createQuestion({
                    quiz_id: quizId,
                    question_type: questionType,
                    question_text: questionText,
                    question_image_url: questionImageUrl || undefined,
                    question_data: questionData,
                    explanation: explanation || undefined,
                    points,
                });
                if (response.success && response.data) {
                    onSave(response.data);
                }
            }
        } catch (error) {
            console.error('Failed to save question:', error);
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
                {/* Header */}
                <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
                    <h2 className="text-xl font-semibold">
                        {question ? 'Edit Question' : 'Add Question'}
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <HiOutlineXCircle className="w-6 h-6" />
                    </button>
                </div>
                
                <div className="p-6 space-y-6">
                    {/* Question Type */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Question Type
                        </label>
                        <select
                            value={questionType}
                            onChange={(e) => setQuestionType(e.target.value as QuestionType)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            {Object.entries(questionTypeConfig).map(([type, config]) => (
                                <option key={type} value={type}>
                                    {config.label} - {config.description}
                                </option>
                            ))}
                        </select>
                    </div>
                    
                    {/* Question Text */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Question
                        </label>
                        <textarea
                            value={questionText}
                            onChange={(e) => setQuestionText(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter your question..."
                        />
                    </div>
                    
                    {/* Question Image */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Image URL (optional)
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="url"
                                value={questionImageUrl}
                                onChange={(e) => setQuestionImageUrl(e.target.value)}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="https://..."
                            />
                            <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                                <HiOutlinePhoto className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                    
                    {/* Answer Options - Multiple Choice */}
                    {(questionType === 'multiple-choice' || questionType === 'multiple-select') && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Answer Options
                            </label>
                            <div className="space-y-3">
                                {options.map((option, index) => (
                                    <div key={option.id} className="flex items-center gap-3">
                                        {/* Correct indicator */}
                                        {questionType === 'multiple-choice' ? (
                                            <button
                                                onClick={() => setCorrectOptionId(option.id)}
                                                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                                                    correctOptionId === option.id
                                                        ? 'border-green-500 bg-green-500'
                                                        : 'border-gray-300 hover:border-green-400'
                                                }`}
                                            >
                                                {correctOptionId === option.id && (
                                                    <HiOutlineCheckCircle className="w-4 h-4 text-white" />
                                                )}
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => toggleCorrectOption(option.id)}
                                                className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                                                    correctOptionIds.includes(option.id)
                                                        ? 'border-green-500 bg-green-500'
                                                        : 'border-gray-300 hover:border-green-400'
                                                }`}
                                            >
                                                {correctOptionIds.includes(option.id) && (
                                                    <HiOutlineCheckCircle className="w-4 h-4 text-white" />
                                                )}
                                            </button>
                                        )}
                                        
                                        <input
                                            type="text"
                                            value={option.text}
                                            onChange={(e) => updateOption(option.id, e.target.value)}
                                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder={`Option ${index + 1}`}
                                        />
                                        
                                        <button
                                            onClick={() => removeOption(option.id)}
                                            disabled={options.length <= 2}
                                            className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-50"
                                        >
                                            <HiOutlineTrash className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={addOption}
                                className="mt-3 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                            >
                                <HiOutlinePlus className="w-4 h-4" />
                                Add Option
                            </button>
                        </div>
                    )}
                    
                    {/* True/False */}
                    {questionType === 'true-false' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Correct Answer
                            </label>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setTrueFalseAnswer(true)}
                                    className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
                                        trueFalseAnswer
                                            ? 'bg-green-500 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    True
                                </button>
                                <button
                                    onClick={() => setTrueFalseAnswer(false)}
                                    className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
                                        !trueFalseAnswer
                                            ? 'bg-red-500 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    False
                                </button>
                            </div>
                        </div>
                    )}
                    
                    {/* Short Answer */}
                    {questionType === 'short-answer' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Accepted Answers (one per line)
                            </label>
                            <textarea
                                value={acceptedAnswers}
                                onChange={(e) => setAcceptedAnswers(e.target.value)}
                                rows={4}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Enter accepted answers, one per line..."
                            />
                        </div>
                    )}
                    
                    {/* Explanation */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Explanation (shown after answering)
                        </label>
                        <textarea
                            value={explanation}
                            onChange={(e) => setExplanation(e.target.value)}
                            rows={2}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Optional explanation..."
                        />
                    </div>
                    
                    {/* Points */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Points
                        </label>
                        <input
                            type="number"
                            value={points}
                            onChange={(e) => setPoints(parseInt(e.target.value) || 1)}
                            min={1}
                            className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                </div>
                
                {/* Footer */}
                <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || !questionText.trim()}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors"
                    >
                        {isSaving ? 'Saving...' : 'Save Question'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

// ============================================================================
// MAIN QUIZ EDITOR COMPONENT
// ============================================================================

interface QuizEditorProps {
    quiz: Quiz;
    sectionId: number;
    onClose: () => void;
    onSave: (quiz: Quiz) => void;
}

const QuizEditor: React.FC<QuizEditorProps> = ({
    quiz: initialQuiz,
    sectionId,
    onClose,
    onSave,
}) => {
    const [quiz, setQuiz] = useState<Quiz>(initialQuiz);
    const [questions, setQuestions] = useState<Question[]>(initialQuiz.questions || []);
    const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());
    const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
    const [isCreatingQuestion, setIsCreatingQuestion] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );
    
    // Toggle question expansion
    const toggleExpand = (questionId: number) => {
        const newExpanded = new Set(expandedQuestions);
        if (newExpanded.has(questionId)) {
            newExpanded.delete(questionId);
        } else {
            newExpanded.add(questionId);
        }
        setExpandedQuestions(newExpanded);
    };
    
    // Handle drag end
    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        
        if (over && active.id !== over.id) {
            const oldIndex = questions.findIndex(q => q.id === Number(active.id));
            const newIndex = questions.findIndex(q => q.id === Number(over.id));
            
            const newQuestions = arrayMove(questions, oldIndex, newIndex);
            setQuestions(newQuestions);
            
            // Save new order
            await api.reorderQuestions(quiz.id, newQuestions.map(q => q.id));
        }
    };
    
    // Delete question
    const handleDeleteQuestion = async (questionId: number) => {
        if (!confirm('Are you sure you want to delete this question?')) return;
        
        await api.deleteQuestion(questionId);
        setQuestions(questions.filter(q => q.id !== questionId));
    };
    
    // Save question (from editor)
    const handleSaveQuestion = (savedQuestion: Question) => {
        if (editingQuestion) {
            setQuestions(questions.map(q => q.id === savedQuestion.id ? savedQuestion : q));
        } else {
            setQuestions([...questions, savedQuestion]);
        }
        setEditingQuestion(null);
        setIsCreatingQuestion(false);
    };
    
    // Save quiz settings
    const handleSaveSettings = async () => {
        setIsSaving(true);
        try {
            await api.saveQuiz(sectionId, {
                title: quiz.title,
                description: quiz.description,
                time_limit_minutes: quiz.time_limit_minutes,
                passing_score: quiz.passing_score,
                max_attempts: quiz.max_attempts,
                shuffle_questions: quiz.shuffle_questions,
                shuffle_options: quiz.shuffle_options,
                show_correct_answers: quiz.show_correct_answers,
                allow_review: quiz.allow_review,
            });
            onSave({ ...quiz, questions });
        } catch (error) {
            console.error('Failed to save quiz:', error);
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-gray-100 z-50 overflow-hidden flex flex-col">
            {/* Header */}
            <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <HiOutlineXCircle className="w-6 h-6" />
                    </button>
                    <div>
                        <h1 className="text-xl font-semibold">Edit Quiz: {quiz.title}</h1>
                        <p className="text-sm text-gray-500">
                            {questions.length} questions • {quiz.passing_score}% to pass
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowSettings(true)}
                        className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <HiOutlineCog6Tooth className="w-5 h-5" />
                        Settings
                    </button>
                    <button
                        onClick={handleSaveSettings}
                        disabled={isSaving}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors"
                    >
                        {isSaving ? 'Saving...' : 'Save Quiz'}
                    </button>
                </div>
            </header>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-3xl mx-auto">
                    {/* Questions list */}
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={questions.map(q => q.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="space-y-3">
                                {questions.map((question, index) => (
                                    <SortableQuestion
                                        key={question.id}
                                        question={question}
                                        index={index}
                                        isExpanded={expandedQuestions.has(question.id)}
                                        onToggleExpand={() => toggleExpand(question.id)}
                                        onEdit={() => setEditingQuestion(question)}
                                        onDelete={() => handleDeleteQuestion(question.id)}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                    
                    {/* Empty state */}
                    {questions.length === 0 && (
                        <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed border-gray-200">
                            <p className="text-gray-500 mb-4">No questions yet</p>
                            <button
                                onClick={() => setIsCreatingQuestion(true)}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                            >
                                Add First Question
                            </button>
                        </div>
                    )}
                    
                    {/* Add question button */}
                    {questions.length > 0 && (
                        <button
                            onClick={() => setIsCreatingQuestion(true)}
                            className="w-full mt-4 py-4 border-2 border-dashed border-gray-200 hover:border-blue-300 rounded-xl text-gray-500 hover:text-blue-600 font-medium flex items-center justify-center gap-2 transition-colors"
                        >
                            <HiOutlinePlus className="w-5 h-5" />
                            Add Question
                        </button>
                    )}
                </div>
            </div>
            
            {/* Question editor modal */}
            {(editingQuestion || isCreatingQuestion) && (
                <QuestionEditor
                    question={editingQuestion || undefined}
                    quizId={quiz.id}
                    onSave={handleSaveQuestion}
                    onClose={() => {
                        setEditingQuestion(null);
                        setIsCreatingQuestion(false);
                    }}
                />
            )}
            
            {/* Settings modal */}
            {showSettings && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-xl shadow-xl max-w-md w-full"
                    >
                        <div className="border-b px-6 py-4 flex items-center justify-between">
                            <h2 className="text-xl font-semibold">Quiz Settings</h2>
                            <button onClick={() => setShowSettings(false)}>
                                <HiOutlineXCircle className="w-6 h-6 text-gray-500" />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Quiz Title
                                </label>
                                <input
                                    type="text"
                                    value={quiz.title}
                                    onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Passing Score (%)
                                </label>
                                <input
                                    type="number"
                                    value={quiz.passing_score}
                                    onChange={(e) => setQuiz({ ...quiz, passing_score: parseInt(e.target.value) })}
                                    min={0}
                                    max={100}
                                    className="w-24 px-4 py-2 border border-gray-300 rounded-lg"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Time Limit (minutes, 0 = unlimited)
                                </label>
                                <input
                                    type="number"
                                    value={quiz.time_limit_minutes || 0}
                                    onChange={(e) => setQuiz({ ...quiz, time_limit_minutes: parseInt(e.target.value) || undefined })}
                                    min={0}
                                    className="w-24 px-4 py-2 border border-gray-300 rounded-lg"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Max Attempts (0 = unlimited)
                                </label>
                                <input
                                    type="number"
                                    value={quiz.max_attempts || 0}
                                    onChange={(e) => setQuiz({ ...quiz, max_attempts: parseInt(e.target.value) || undefined })}
                                    min={0}
                                    className="w-24 px-4 py-2 border border-gray-300 rounded-lg"
                                />
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="shuffle_questions"
                                    checked={quiz.shuffle_questions || false}
                                    onChange={(e) => setQuiz({ ...quiz, shuffle_questions: e.target.checked })}
                                    className="w-4 h-4 rounded"
                                />
                                <label htmlFor="shuffle_questions" className="text-sm text-gray-700">
                                    Shuffle questions
                                </label>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="shuffle_options"
                                    checked={quiz.shuffle_options || false}
                                    onChange={(e) => setQuiz({ ...quiz, shuffle_options: e.target.checked })}
                                    className="w-4 h-4 rounded"
                                />
                                <label htmlFor="shuffle_options" className="text-sm text-gray-700">
                                    Shuffle answer options
                                </label>
                            </div>
                        </div>
                        
                        <div className="border-t px-6 py-4 flex justify-end">
                            <button
                                onClick={() => setShowSettings(false)}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                            >
                                Done
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default QuizEditor;
