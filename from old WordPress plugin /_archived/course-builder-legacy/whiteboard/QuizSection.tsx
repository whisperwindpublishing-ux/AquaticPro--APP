/**
 * Quiz Section Component
 * 
 * A comprehensive quiz component supporting multiple question types:
 * - Multiple choice (single answer)
 * - Multiple select (multiple answers)
 * - True/False
 * - Short answer
 * - Ordering (sequence)
 * - Matching
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, Reorder } from 'framer-motion';
import {
    HiOutlineCheck,
    HiOutlineClock,
    HiOutlineArrowPath,
    HiOutlineCheckCircle,
    HiOutlineXCircle,
    HiOutlineQuestionMarkCircle,
    HiOutlineArrowRight,
    HiOutlineTrophy,
} from 'react-icons/hi2';
import type {
    QuizAnswers,
    QuizResult,
    QuizSectionProps,
    QuestionCardProps,
    Question,
    MultipleChoiceQuestion,
    MultipleSelectQuestion,
    TrueFalseQuestion,
    ShortAnswerQuestion,
    OrderingQuestion,
    MatchingQuestion,
    QuestionOption,
    OrderingItem,
    MatchingItem,
    MatchingPair,
} from './types';

// ============================================================================
// QUESTION CARD COMPONENTS
// ============================================================================

/**
 * Multiple Choice Question
 */
const MultipleChoiceCard: React.FC<QuestionCardProps> = ({
    question,
    answer,
    onChange,
    showResult,
    isCorrect,
    disabled,
}) => {
    const q = question as MultipleChoiceQuestion;
    const options: QuestionOption[] = q.options || [];
    
    return (
        <div className="space-y-3">
            {options.map((option: QuestionOption) => {
                const isSelected = answer === option.id;
                const isCorrectOption = showResult && q.correct_option_id === option.id;
                
                let optionClass = 'border-gray-200 hover:border-blue-300 hover:bg-blue-50';
                if (isSelected && !showResult) {
                    optionClass = 'border-blue-500 bg-blue-50';
                } else if (showResult) {
                    if (isCorrectOption) {
                        optionClass = 'border-green-500 bg-green-50';
                    } else if (isSelected && !isCorrect) {
                        optionClass = 'border-red-500 bg-red-50';
                    }
                }
                
                return (
                    <button
                        key={option.id}
                        onClick={() => !disabled && onChange(option.id)}
                        disabled={disabled}
                        className={`w-full p-4 rounded-xl border-2 text-left transition-all ${optionClass} ${
                            disabled ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                            }`}>
                                {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                            </div>
                            <span className="flex-1">{option.text}</span>
                            {showResult && isCorrectOption && (
                                <HiOutlineCheckCircle className="w-5 h-5 text-green-600" />
                            )}
                            {showResult && isSelected && !isCorrect && (
                                <HiOutlineXCircle className="w-5 h-5 text-red-600" />
                            )}
                        </div>
                    </button>
                );
            })}
        </div>
    );
};

/**
 * Multiple Select Question
 */
const MultipleSelectCard: React.FC<QuestionCardProps> = ({
    question,
    answer,
    onChange,
    showResult,
    disabled,
}) => {
    const q = question as MultipleSelectQuestion;
    const options: QuestionOption[] = q.options || [];
    const correctIds: number[] = q.correct_option_ids || [];
    const selectedIds = (answer as number[]) || [];
    
    const toggleOption = (optionId: number) => {
        if (disabled) return;
        const newSelected = selectedIds.includes(optionId)
            ? selectedIds.filter(id => id !== optionId)
            : [...selectedIds, optionId];
        onChange(newSelected);
    };
    
    return (
        <div className="space-y-3">
            <p className="text-sm text-gray-500 mb-2">Select all that apply</p>
            {options.map((option: QuestionOption) => {
                const isSelected = selectedIds.includes(option.id);
                const isCorrectOption = correctIds.includes(option.id);
                
                let optionClass = 'border-gray-200 hover:border-blue-300 hover:bg-blue-50';
                if (isSelected && !showResult) {
                    optionClass = 'border-blue-500 bg-blue-50';
                } else if (showResult) {
                    if (isCorrectOption && isSelected) {
                        optionClass = 'border-green-500 bg-green-50';
                    } else if (isCorrectOption && !isSelected) {
                        optionClass = 'border-amber-500 bg-amber-50'; // Missed correct answer
                    } else if (!isCorrectOption && isSelected) {
                        optionClass = 'border-red-500 bg-red-50';
                    }
                }
                
                return (
                    <button
                        key={option.id}
                        onClick={() => toggleOption(option.id)}
                        disabled={disabled}
                        className={`w-full p-4 rounded-xl border-2 text-left transition-all ${optionClass} ${
                            disabled ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                            }`}>
                                {isSelected && <HiOutlineCheck className="w-3 h-3 text-white" />}
                            </div>
                            <span className="flex-1">{option.text}</span>
                        </div>
                    </button>
                );
            })}
        </div>
    );
};

/**
 * True/False Question
 */
const TrueFalseCard: React.FC<QuestionCardProps> = ({
    question,
    answer,
    onChange,
    showResult,
    isCorrect,
    disabled,
}) => {
    const q = question as TrueFalseQuestion;
    const correctAnswer = q.correct_answer;
    
    const options = [
        { value: true, label: 'True' },
        { value: false, label: 'False' },
    ];
    
    return (
        <div className="flex gap-4">
            {options.map((option) => {
                const isSelected = answer === option.value;
                const isCorrectOption = showResult && correctAnswer === option.value;
                
                let optionClass = 'border-gray-200 hover:border-blue-300 hover:bg-blue-50';
                if (isSelected && !showResult) {
                    optionClass = 'border-blue-500 bg-blue-50';
                } else if (showResult) {
                    if (isCorrectOption) {
                        optionClass = 'border-green-500 bg-green-50';
                    } else if (isSelected && !isCorrect) {
                        optionClass = 'border-red-500 bg-red-50';
                    }
                }
                
                return (
                    <button
                        key={String(option.value)}
                        onClick={() => !disabled && onChange(option.value)}
                        disabled={disabled}
                        className={`flex-1 p-6 rounded-xl border-2 text-center font-semibold text-lg transition-all ${optionClass} ${
                            disabled ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                        }`}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
};

/**
 * Short Answer Question
 */
const ShortAnswerCard: React.FC<QuestionCardProps> = ({
    question,
    answer,
    onChange,
    showResult,
    isCorrect,
    disabled,
}) => {
    const q = question as ShortAnswerQuestion;
    
    return (
        <div className="space-y-4">
            <input
                type="text"
                value={(answer as string) || ''}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                placeholder="Type your answer..."
                className={`w-full px-4 py-3 rounded-xl border-2 text-lg transition-all ${
                    showResult
                        ? isCorrect
                            ? 'border-green-500 bg-green-50'
                            : 'border-red-500 bg-red-50'
                        : 'border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
                } ${disabled ? 'cursor-not-allowed opacity-75' : ''}`}
            />
            {showResult && !isCorrect && q.accepted_answers && (
                <div className="p-4 bg-amber-50 rounded-lg">
                    <p className="text-sm text-amber-800">
                        Accepted answers: {q.accepted_answers.join(', ')}
                    </p>
                </div>
            )}
        </div>
    );
};

/**
 * Ordering Question
 */
const OrderingCard: React.FC<QuestionCardProps> = ({
    question,
    answer,
    onChange,
    showResult,
    disabled,
}) => {
    const q = question as OrderingQuestion;
    const items: OrderingItem[] = q.items || [];
    const correctOrder: number[] = q.correct_order || [];
    
    // Initialize with default order if no answer yet
    const currentOrder = (answer as number[]) || items.map((i: OrderingItem) => i.id);
    
    const handleReorder = (newOrder: number[]) => {
        if (!disabled) {
            onChange(newOrder);
        }
    };
    
    return (
        <div className="space-y-2">
            <p className="text-sm text-gray-500 mb-3">Drag to reorder:</p>
            <Reorder.Group axis="y" values={currentOrder} onReorder={handleReorder}>
                {currentOrder.map((itemId: number, index: number) => {
                    const item = items.find((i: OrderingItem) => i.id === itemId);
                    if (!item) return null;
                    
                    const isCorrectPosition = showResult && correctOrder[index] === itemId;
                    
                    return (
                        <Reorder.Item
                            key={itemId}
                            value={itemId}
                            className={`p-4 rounded-xl border-2 mb-2 ${
                                showResult
                                    ? isCorrectPosition
                                        ? 'border-green-500 bg-green-50'
                                        : 'border-red-500 bg-red-50'
                                    : 'border-gray-200 bg-white hover:bg-gray-50'
                            } ${disabled ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}
                        >
                            <div className="flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-medium">
                                    {index + 1}
                                </span>
                                <span className="flex-1">{item.text}</span>
                            </div>
                        </Reorder.Item>
                    );
                })}
            </Reorder.Group>
        </div>
    );
};

/**
 * Matching Question
 */
const MatchingCard: React.FC<QuestionCardProps> = ({
    question,
    answer,
    onChange,
    showResult,
    disabled,
}) => {
    const q = question as MatchingQuestion;
    const leftItems: MatchingItem[] = q.left_items || [];
    const rightItems: MatchingItem[] = q.right_items || [];
    const correctPairs: MatchingPair[] = q.correct_pairs || [];
    
    // Answer is { [leftId]: rightId }
    const matches = (answer as Record<number, number>) || {};
    
    const handleMatch = (leftId: number, rightId: number) => {
        if (disabled) return;
        onChange({ ...matches, [leftId]: rightId });
    };
    
    const isMatchCorrect = (leftId: number, rightId: number) => {
        return correctPairs.some((p: MatchingPair) => p.left_id === leftId && p.right_id === rightId);
    };
    
    return (
        <div className="space-y-4">
            <p className="text-sm text-gray-500 mb-3">Match items from left to right:</p>
            <div className="grid grid-cols-2 gap-4">
                {/* Left column */}
                <div className="space-y-3">
                    {leftItems.map((item: MatchingItem) => {
                        const matchedRightId = matches[item.id];
                        const isCorrect = showResult && matchedRightId && isMatchCorrect(item.id, matchedRightId);
                        
                        return (
                            <div
                                key={item.id}
                                className={`p-4 rounded-xl border-2 ${
                                    showResult
                                        ? isCorrect
                                            ? 'border-green-500 bg-green-50'
                                            : matchedRightId
                                                ? 'border-red-500 bg-red-50'
                                                : 'border-gray-200'
                                        : 'border-gray-200 bg-white'
                                }`}
                            >
                                {item.text}
                            </div>
                        );
                    })}
                </div>
                
                {/* Right column with dropdowns */}
                <div className="space-y-3">
                    {rightItems.map((item: MatchingItem) => (
                        <div key={item.id} className="p-4 rounded-xl border-2 border-gray-200 bg-gray-50">
                            <p className="font-medium mb-2">{item.text}</p>
                            <select
                                value={Object.keys(matches).find(k => matches[Number(k)] === item.id) || ''}
                                onChange={(e) => {
                                    const leftId = Number(e.target.value);
                                    if (leftId) handleMatch(leftId, item.id);
                                }}
                                disabled={disabled}
                                className="w-full p-2 rounded border text-sm"
                            >
                                <option value="">Select match...</option>
                                {leftItems.map((leftItem: MatchingItem) => (
                                    <option key={leftItem.id} value={leftItem.id}>
                                        {leftItem.text}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// QUESTION CARD WRAPPER
// ============================================================================

export const QuestionCard: React.FC<QuestionCardProps> = (props) => {
    const { question, showResult, isCorrect } = props;
    
    // Get the appropriate component based on question type
    const getQuestionComponent = () => {
        switch (question.question_type) {
            case 'multiple-choice':
                return <MultipleChoiceCard {...props} />;
            case 'multiple-select':
                return <MultipleSelectCard {...props} />;
            case 'true-false':
                return <TrueFalseCard {...props} />;
            case 'short-answer':
                return <ShortAnswerCard {...props} />;
            case 'ordering':
                return <OrderingCard {...props} />;
            case 'matching':
                return <MatchingCard {...props} />;
            default:
                return <div>Unknown question type</div>;
        }
    };
    
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg p-6 mb-6"
        >
            {/* Question text */}
            <div className="mb-6">
                <div className="flex items-start gap-3 mb-2">
                    <HiOutlineQuestionMarkCircle className="w-6 h-6 text-blue-500 flex-shrink-0 mt-0.5" />
                    <p className="text-lg font-medium">{question.question_text}</p>
                </div>
                {question.question_image_url && (
                    <img
                        src={question.question_image_url}
                        alt="Question"
                        className="mt-4 rounded-lg max-h-64 object-contain"
                    />
                )}
            </div>
            
            {/* Question content */}
            {getQuestionComponent()}
            
            {/* Explanation (shown after answering) */}
            {showResult && question.explanation && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-4 p-4 bg-blue-50 rounded-lg"
                >
                    <p className="text-sm text-blue-800">
                        <strong>Explanation:</strong> {question.explanation}
                    </p>
                </motion.div>
            )}
            
            {/* Result indicator */}
            {showResult && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${
                        isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}
                >
                    {isCorrect ? (
                        <>
                            <HiOutlineCheckCircle className="w-5 h-5" />
                            <span>Correct! +{question.points} points</span>
                        </>
                    ) : (
                        <>
                            <HiOutlineXCircle className="w-5 h-5" />
                            <span>Incorrect</span>
                        </>
                    )}
                </motion.div>
            )}
        </motion.div>
    );
};

// ============================================================================
// QUIZ RESULTS COMPONENT
// ============================================================================

export const QuizResults: React.FC<{
    result: QuizResult;
    onRetry?: () => void;
    onContinue?: () => void;
}> = ({ result, onRetry, onContinue }) => {
    const passedClass = result.passed ? 'text-green-600' : 'text-red-600';
    
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md mx-auto"
        >
            {/* Trophy/Icon */}
            <div className={`w-20 h-20 rounded-full ${result.passed ? 'bg-green-100' : 'bg-red-100'} mx-auto mb-6 flex items-center justify-center`}>
                {result.passed ? (
                    <HiOutlineTrophy className="w-10 h-10 text-green-600" />
                ) : (
                    <HiOutlineXCircle className="w-10 h-10 text-red-600" />
                )}
            </div>
            
            {/* Result text */}
            <h2 className={`text-2xl font-bold mb-2 ${passedClass}`}>
                {result.passed ? 'Congratulations!' : 'Not Quite!'}
            </h2>
            <p className="text-gray-600 mb-6">
                {result.passed 
                    ? 'You passed the quiz!'
                    : 'You didn\'t reach the passing score. Try again!'}
            </p>
            
            {/* Score display */}
            <div className="bg-gray-50 rounded-xl p-6 mb-6">
                <div className="text-4xl font-bold mb-1" style={{ color: result.passed ? '#16a34a' : '#dc2626' }}>
                    {result.percentage}%
                </div>
                <p className="text-gray-500">
                    {result.score} / {result.total_points} points
                </p>
                <p className="text-sm text-gray-400 mt-2">
                    Passing score: {result.passing_score}%
                </p>
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-green-50 rounded-lg p-3">
                    <div className="text-2xl font-bold text-green-600">{result.correct_answers}</div>
                    <div className="text-sm text-green-700">Correct</div>
                </div>
                <div className="bg-red-50 rounded-lg p-3">
                    <div className="text-2xl font-bold text-red-600">
                        {result.total_questions - result.correct_answers}
                    </div>
                    <div className="text-sm text-red-700">Incorrect</div>
                </div>
            </div>
            
            {/* Actions */}
            <div className="flex gap-3">
                {onRetry && !result.passed && (
                    <button
                        onClick={onRetry}
                        className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium flex items-center justify-center gap-2"
                    >
                        <HiOutlineArrowPath className="w-5 h-5" />
                        Try Again
                    </button>
                )}
                {onContinue && (
                    <button
                        onClick={onContinue}
                        className={`flex-1 px-6 py-3 rounded-xl font-medium flex items-center justify-center gap-2 ${
                            result.passed
                                ? 'bg-green-600 hover:bg-green-700 text-white'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                    >
                        Continue
                        <HiOutlineArrowRight className="w-5 h-5" />
                    </button>
                )}
            </div>
        </motion.div>
    );
};

// ============================================================================
// MAIN QUIZ SECTION COMPONENT
// ============================================================================

const QuizSection: React.FC<QuizSectionProps> = ({
    quiz,
    onComplete,
    readOnly = false,
}) => {
    const [answers, setAnswers] = useState<QuizAnswers>({});
    const [showResults, setShowResults] = useState(false);
    const [result, setResult] = useState<QuizResult | null>(null);
    const [startTime] = useState(Date.now());
    const [timeRemaining, setTimeRemaining] = useState<number | null>(
        quiz.time_limit_minutes ? quiz.time_limit_minutes * 60 : null
    );
    
    const questions = useMemo(() => {
        const qs = quiz.questions || [];
        if (quiz.shuffle_questions) {
            return [...qs].sort(() => Math.random() - 0.5);
        }
        return qs;
    }, [quiz.questions, quiz.shuffle_questions]);
    
    // Timer
    useEffect(() => {
        if (timeRemaining === null || timeRemaining <= 0 || showResults) return;
        
        const interval = setInterval(() => {
            setTimeRemaining(prev => {
                if (prev === null || prev <= 1) {
                    handleSubmit();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        
        return () => clearInterval(interval);
    }, [timeRemaining, showResults]);
    
    // Handle answer change
    const handleAnswerChange = useCallback((questionId: number, value: unknown) => {
        setAnswers(prev => ({ ...prev, [questionId]: value }));
    }, []);
    
    // Check if answer is correct
    const checkAnswer = useCallback((question: Question | undefined, answer: unknown): boolean => {
        if (!question || answer === undefined || answer === null) return false;
        
        switch (question.question_type) {
            case 'multiple-choice': {
                const q = question as MultipleChoiceQuestion;
                return answer === q.correct_option_id;
            }
            case 'multiple-select': {
                const q = question as MultipleSelectQuestion;
                const selected = (answer as number[]) || [];
                const correct = q.correct_option_ids || [];
                return selected.length === correct.length && 
                    selected.every(id => correct.includes(id));
            }
            case 'true-false': {
                const q = question as TrueFalseQuestion;
                return answer === q.correct_answer;
            }
            case 'short-answer': {
                const q = question as ShortAnswerQuestion;
                const answerStr = String(answer).trim();
                const accepted = q.accepted_answers || [];
                return accepted.some(a => 
                    q.case_sensitive 
                        ? a === answerStr 
                        : a.toLowerCase() === answerStr.toLowerCase()
                );
            }
            case 'ordering': {
                const q = question as OrderingQuestion;
                const userOrder = (answer as number[]) || [];
                const correct = q.correct_order || [];
                return JSON.stringify(userOrder) === JSON.stringify(correct);
            }
            case 'matching': {
                const q = question as MatchingQuestion;
                const matches = (answer as Record<number, number>) || {};
                const correct = q.correct_pairs || [];
                return correct.every((pair: MatchingPair) => matches[pair.left_id] === pair.right_id);
            }
            default:
                return false;
        }
    }, []);
    
    // Handle submit
    const handleSubmit = useCallback(() => {
        let correctCount = 0;
        let totalPoints = 0;
        let earnedPoints = 0;
        
        questions.forEach(question => {
            totalPoints += question.points;
            const answer = answers[question.id];
            if (checkAnswer(question, answer)) {
                correctCount++;
                earnedPoints += question.points;
            }
        });
        
        const percentage = Math.round((earnedPoints / totalPoints) * 100);
        const passed = percentage >= (quiz.passing_score || 70);
        
        const quizResult: QuizResult = {
            quiz_id: quiz.id,
            passed,
            score: earnedPoints,
            total_points: totalPoints,
            percentage,
            correct_answers: correctCount,
            total_questions: questions.length,
            passing_score: quiz.passing_score || 70,
            time_taken_seconds: Math.floor((Date.now() - startTime) / 1000),
            answers,
        };
        
        setResult(quizResult);
        setShowResults(true);
        onComplete?.(quizResult);
    }, [questions, answers, quiz, checkAnswer, startTime, onComplete]);
    
    // Format time
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    
    // Progress calculation
    const answeredCount = Object.keys(answers).length;
    const progressPercentage = (answeredCount / questions.length) * 100;
    
    if (showResults && result) {
        return (
            <QuizResults
                result={result}
                onRetry={!result.passed && (quiz.max_attempts === undefined || quiz.max_attempts === null) ? () => {
                    setAnswers({});
                    setShowResults(false);
                    setResult(null);
                } : undefined}
                onContinue={() => {}}
            />
        );
    }
    
    return (
        <div className="max-w-3xl mx-auto p-6">
            {/* Header */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-bold">{quiz.title}</h2>
                        {quiz.description && (
                            <p className="text-gray-600 mt-1">{quiz.description}</p>
                        )}
                    </div>
                    {timeRemaining !== null && (
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
                            timeRemaining < 60 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                            <HiOutlineClock className="w-5 h-5" />
                            <span className="font-mono font-bold">{formatTime(timeRemaining)}</span>
                        </div>
                    )}
                </div>
                
                {/* Progress bar */}
                <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercentage}%` }}
                        className="h-full bg-blue-500"
                    />
                </div>
                <p className="text-sm text-gray-500 mt-2">
                    {answeredCount} of {questions.length} questions answered
                </p>
            </div>
            
            {/* Questions */}
            {questions.map((question, index) => (
                <QuestionCard
                    key={question.id}
                    question={question}
                    questionNumber={index + 1}
                    answer={answers[question.id]}
                    onChange={(value) => handleAnswerChange(question.id, value)}
                    showResult={false}
                    isCorrect={false}
                    disabled={readOnly}
                />
            ))}
            
            {/* Submit button */}
            {!readOnly && (
                <div className="flex justify-center mt-8">
                    <button
                        onClick={handleSubmit}
                        disabled={answeredCount === 0}
                        className="px-8 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-xl font-semibold text-lg flex items-center gap-2 transition-colors"
                    >
                        <HiOutlineCheck className="w-6 h-6" />
                        Submit Quiz
                    </button>
                </div>
            )}
        </div>
    );
};

export default QuizSection;
