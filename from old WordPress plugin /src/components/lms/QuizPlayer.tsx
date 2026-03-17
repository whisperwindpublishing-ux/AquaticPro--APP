import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { HiOutlineCheck, HiOutlineXMark, HiOutlineChevronRight, HiOutlineArrowPath } from 'react-icons/hi2';
import { QuizQuestion } from './QuizEditor';

interface QuizPlayerProps {
    data: string; // JSON string of QuizQuestion[]
    onComplete: (score: number, passed: boolean) => void;
    passThreshold?: number; // default 0.8
}

const QuizPlayer: React.FC<QuizPlayerProps> = ({ data, onComplete, passThreshold = 0.8 }) => {
    let questions: QuizQuestion[] = [];
    try {
        questions = JSON.parse(data);
        if (!Array.isArray(questions)) questions = [];
    } catch {
        questions = [];
    }

    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selections, setSelections] = useState<Record<string, string[]>>({});
    const [_showResults, _setShowResults] = useState(false);
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const [_feedback, _setFeedback] = useState<Record<string, 'correct' | 'incorrect'>>({});

    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return <div className="ap-p-8 ap-text-center">No questions available.</div>;

    const handleSelect = (answerId: string) => {
        if (hasSubmitted) return;

        const currentSelections = selections[currentQuestion.id] || [];
        
        if (currentQuestion.type === 'single') {
            setSelections({
                ...selections,
                [currentQuestion.id]: [answerId]
            });
        } else {
            // Toggle
            const newSelections = currentSelections.includes(answerId)
                ? currentSelections.filter(id => id !== answerId)
                : [...currentSelections, answerId];
            
            setSelections({
                ...selections,
                [currentQuestion.id]: newSelections
            });
        }
    };

    const calculateScore = () => {
        let correctCount = 0;

        questions.forEach(q => {
            const userAnswers = selections[q.id] || [];
            if (userAnswers.length === 0) return; // Incorrect if nothing selected

            if (q.type === 'single') {
                const selectedAns = q.answers.find(a => a.id === userAnswers[0]);
                if (selectedAns?.isCorrect) correctCount++;
            } else {
                // Multiple: Must select ALL correct answers and NO incorrect answers
                const correctIds = q.answers.filter(a => a.isCorrect).map(a => a.id);
                
                // Check if same sets
                const isCorrect = correctIds.length === userAnswers.length && 
                                 correctIds.every(id => userAnswers.includes(id));
                
                if (isCorrect) correctCount++;
            }
        });

        return correctCount;
    };

    const handleSubmit = () => {
        // Calculate feedback
        const correctCount = calculateScore();
        const score = correctCount / questions.length;
        const passed = score >= passThreshold;
        
        setHasSubmitted(true);
        onComplete(Math.round(score * 100), passed);
    };

    const handleRetry = () => {
        setSelections({});
        setHasSubmitted(false);
        setCurrentQuestionIndex(0);
    };

    const isLastQuestion = currentQuestionIndex === questions.length - 1;
    const canAdvance = (selections[currentQuestion.id] || []).length > 0;

    // Results View
    if (hasSubmitted) {
        const score = calculateScore();
        const percentage = Math.round((score / questions.length) * 100);
        const passed = (score / questions.length) >= passThreshold;

        return (
            <div className="ap-max-w-2xl ap-mx-auto ap-p-8 ap-text-center ap-bg-white ap-rounded-lg ap-shadow-sm">
                <div className={`ap-w-20 ap-h-20 ap-mx-auto ap-rounded-full ap-flex ap-items-center ap-justify-center ap-mb-4 ${passed ? 'ap-bg-green-100 ap-text-green-600' : 'ap-bg-red-100 ap-text-red-600'}`}>
                    {passed ? <HiOutlineCheck className="ap-w-10 ap-h-10" /> : <HiOutlineXMark className="ap-w-10 ap-h-10" />}
                </div>
                
                <h2 className="ap-text-3xl ap-font-bold ap-mb-2">
                    {passed ? 'Quiz Passed!' : 'Quiz Failed'}
                </h2>
                
                <div className="ap-text-5xl ap-font-black ap-text-gray-800 ap-mb-6 ap-font-mono">
                    {percentage}%
                </div>

                <p className="ap-text-gray-600 ap-mb-8">
                    You answered {score} out of {questions.length} questions correctly.
                    <br />
                    Required to pass: {Math.round(passThreshold * 100)}%
                </p>

                {!passed && (
                    <Button
                        onClick={handleRetry}
                        variant="primary"
                        className="!ap-inline-flex !ap-items-center !ap-gap-2 !ap-px-6 !ap-py-3 !ap-font-medium"
                    >
                        <HiOutlineArrowPath className="ap-w-5 ap-h-5" />
                        Retry Quiz
                    </Button>
                )}
            </div>
        );
    }

    // Question View
    return (
        <div className="ap-max-w-3xl ap-mx-auto ap-p-4 md:ap-p-8">
            {/* Progress Bar */}
            <div className="ap-mb-6">
                <div className="ap-flex ap-justify-between ap-text-xs ap-text-gray-500 ap-mb-1">
                    <span>Question {currentQuestionIndex + 1} of {questions.length}</span>
                    <span>{Math.round((currentQuestionIndex / questions.length) * 100)}% Complete</span>
                </div>
                <div className="ap-h-2 ap-bg-gray-100 ap-rounded-full ap-overflow-hidden">
                    <div 
                        className="ap-h-full ap-bg-blue-600 ap-transition-all ap-duration-300"
                        style={{ width: `${(currentQuestionIndex / questions.length) * 100}%` }}
                    />
                </div>
            </div>

            <div className="ap-bg-white ap-rounded-xl ap-shadow-sm ap-border ap-border-gray-200 ap-overflow-hidden">
                <div className="ap-p-6 md:ap-p-8">
                    <h3 className="ap-text-xl ap-font-semibold ap-text-gray-900 ap-mb-6">
                        {currentQuestion.text}
                    </h3>

                    {currentQuestion.imageUrl && (
                        <div className="ap-mb-6">
                            <img 
                                src={currentQuestion.imageUrl} 
                                alt="Question diagram" 
                                className="ap-max-h-64 ap-rounded-lg ap-border ap-border-gray-100"
                            />
                        </div>
                    )}

                    <div className="ap-space-y-3">
                        {currentQuestion.answers.map(answer => {
                            const isSelected = (selections[currentQuestion.id] || []).includes(answer.id);
                            
                            return (
                                <div 
                                    key={answer.id}
                                    onClick={() => handleSelect(answer.id)}
                                    className={`ap-relative ap-flex ap-items-start ap-gap-4 ap-p-4 ap-rounded-lg ap-border-2 ap-cursor-pointer ap-transition-all ${
                                        isSelected 
                                            ? 'ap-border-blue-600 ap-bg-blue-50' : 'ap-border-gray-100 hover:ap-border-blue-200 hover:ap-bg-gray-50'
                                    }`}
                                >
                                    <div className={`ap-flex-shrink-0 ap-w-6 ap-h-6 ap-rounded-full ap-border-2 ap-flex ap-items-center ap-justify-center ap-mt-0.5 ${
                                        isSelected 
                                            ? 'ap-border-blue-600 ap-bg-blue-600 ap-text-white' : 'ap-border-gray-300'
                                    }`}>
                                        {isSelected && <HiOutlineCheck className="ap-w-3.5 ap-h-3.5" />}
                                    </div>
                                    
                                    <div className="ap-flex-1">
                                        {answer.text && <div className="ap-font-medium ap-text-gray-800">{answer.text}</div>}
                                        {answer.imageUrl && (
                                            <div className="ap-mt-2">
                                                <img 
                                                    src={answer.imageUrl} 
                                                    alt="Answer choice" 
                                                    className="ap-h-32 ap-object-contain ap-rounded ap-border ap-border-gray-200 ap-bg-white" 
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="ap-bg-gray-50 ap-px-6 ap-py-4 ap-border-t ap-border-gray-200 ap-flex ap-justify-between ap-items-center">
                    <div className="ap-text-sm ap-text-gray-500">
                        {currentQuestion.type === 'multiple' ? 'Select all that apply' : 'Select one answer'}
                    </div>
                    
                    {isLastQuestion ? (
                        <Button
                            onClick={handleSubmit}
                            disabled={!canAdvance}
                            variant="primary"
                            className="!ap-px-6 !ap-py-2 !ap-bg-green-600 hover:!ap-bg-green-700 !ap-font-medium"
                        >
                            Submit Quiz
                        </Button>
                    ) : (
                        <Button
                            onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                            disabled={!canAdvance}
                            variant="primary"
                            className="!ap-flex !ap-items-center !ap-gap-2 !ap-px-6 !ap-py-2 !ap-font-medium"
                        >
                            Next Question
                            <HiOutlineChevronRight className="ap-w-4 ap-h-4" />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default QuizPlayer;
