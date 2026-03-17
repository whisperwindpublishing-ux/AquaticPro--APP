import React, { useState } from 'react';
import { HiOutlinePlus, HiOutlineTrash, HiOutlinePhotograph, HiOutlineCheck } from 'react-icons/hi';
import { HiOutlineXMark } from 'react-icons/hi2';
import { Button } from '../ui';

export interface QuizAnswer {
    id: string;
    text: string;
    imageUrl?: string;
    isCorrect: boolean;
}

export interface QuizQuestion {
    id: string;
    type: 'single' | 'multiple';
    text: string;
    imageUrl?: string;
    answers: QuizAnswer[];
}

interface QuizEditorProps {
    value: string; // JSON string of QuizQuestion[]
    onChange: (value: string) => void;
}

const QuizEditor: React.FC<QuizEditorProps> = ({ value, onChange }) => {
    // Parse initial state
    const [questions, setQuestions] = useState<QuizQuestion[]>(() => {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    });

    // Update parent whenever state changes
    const updateQuestions = (newQuestions: QuizQuestion[]) => {
        setQuestions(newQuestions);
        onChange(JSON.stringify(newQuestions));
    };

    const addQuestion = () => {
        const newQuestion: QuizQuestion = {
            id: crypto.randomUUID(),
            type: 'single',
            text: '',
            answers: [
                { id: crypto.randomUUID(), text: '', isCorrect: false },
                { id: crypto.randomUUID(), text: '', isCorrect: false }
            ]
        };
        updateQuestions([...questions, newQuestion]);
    };

    const updateQuestion = (index: number, updates: Partial<QuizQuestion>) => {
        const newQuestions = [...questions];
        newQuestions[index] = { ...newQuestions[index], ...updates };
        updateQuestions(newQuestions);
    };

    const removeQuestion = (index: number) => {
        const newQuestions = [...questions];
        newQuestions.splice(index, 1);
        updateQuestions(newQuestions);
    };

    const addAnswer = (qIndex: number) => {
        const newQuestions = [...questions];
        newQuestions[qIndex].answers.push({
            id: crypto.randomUUID(),
            text: '',
            isCorrect: false
        });
        updateQuestions(newQuestions);
    };

    const updateAnswer = (qIndex: number, aIndex: number, updates: Partial<QuizAnswer>) => {
        const newQuestions = [...questions];
        const question = newQuestions[qIndex];
        const answer = question.answers[aIndex];

        // If setting correct and single choice, uncheck others
        if (updates.isCorrect && question.type === 'single') {
            question.answers.forEach(a => a.isCorrect = false);
        }

        question.answers[aIndex] = { ...answer, ...updates };
        updateQuestions(newQuestions);
    };

    const removeAnswer = (qIndex: number, aIndex: number) => {
        const newQuestions = [...questions];
        newQuestions[qIndex].answers.splice(aIndex, 1);
        updateQuestions(newQuestions);
    };

    // Helper to open media library
    const openMediaLibrary = (callback: (url: string) => void) => {
        // @ts-ignore
        if (typeof wp !== 'undefined' && wp.media) {
            // @ts-ignore
            const frame = wp.media({
                title: 'Select Image',
                button: { text: 'Use Image' },
                multiple: false
            });

            frame.on('select', () => {
                const attachment = frame.state().get('selection').first().toJSON();
                callback(attachment.url);
            });

            frame.open();
        } else {
            alert("Media Library not available in this context.");
        }
    };

    return (
        <div className="ap-space-y-8 ap-p-4 ap-bg-gray-50 ap-rounded-lg">
            {questions.map((question, qIndex) => (
                <div key={question.id} className="ap-bg-white ap-p-6 ap-rounded-lg ap-shadow-sm ap-border ap-border-gray-200">
                    <div className="ap-flex ap-justify-between ap-items-start ap-mb-4">
                        <div className="ap-flex-1 ap-mr-4">
                            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">Question {qIndex + 1}</label>
                            <input
                                type="text"
                                value={question.text}
                                onChange={(e) => updateQuestion(qIndex, { text: e.target.value })}
                                placeholder="Enter your question text..."
                                className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-md focus:ap-ring-blue-500 focus:ap-border-blue-500"
                            />
                            
                            {/* Question Image */}
                            <div className="ap-mt-2">
                                {question.imageUrl ? (
                                    <div className="ap-relative ap-inline-block">
                                        <img src={question.imageUrl} alt="Question" className="ap-h-24 ap-w-auto ap-rounded ap-border" />
                                        <Button 
                                            variant="ghost"
                                            size="xs"
                                            onClick={() => updateQuestion(qIndex, { imageUrl: undefined })}
                                            className="ap-absolute -ap-top-2 -ap-right-2 !ap-bg-red-100 !ap-text-red-600 !ap-rounded-full !ap-p-1 !ap-min-h-0 ap-border ap-border-red-200"
                                        >
                                            <HiOutlineXMark className="ap-w-3 ap-h-3" />
                                        </Button>
                                    </div>
                                ) : (
                                    <Button
                                        variant="link"
                                        size="sm"
                                        onClick={() => openMediaLibrary(url => updateQuestion(qIndex, { imageUrl: url }))}
                                        className="!ap-p-0 !ap-min-h-0 ap-flex ap-items-center ap-gap-1"
                                    >
                                        <HiOutlinePhotograph className="ap-w-4 ap-h-4" /> Add Image
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="ap-flex ap-flex-col ap-gap-2 ap-items-end">
                            <select
                                value={question.type}
                                onChange={(e) => updateQuestion(qIndex, { type: e.target.value as 'single' | 'multiple' })}
                                className="ap-text-sm ap-border-gray-300 ap-rounded-md focus:ap-ring-blue-500 focus:ap-border-blue-500"
                            >
                                <option value="single">Single Choice</option>
                                <option value="multiple">Multiple Choice</option>
                            </select>
                            <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => removeQuestion(qIndex)}
                                className="!ap-text-red-600 hover:!ap-bg-red-50 !ap-p-2 !ap-min-h-0"
                                title="Delete Question"
                            >
                                <HiOutlineTrash className="ap-w-5 ap-h-5" />
                            </Button>
                        </div>
                    </div>

                    {/* Answers */}
                    <div className="ap-space-y-3 ap-pl-4 ap-border-l-2 ap-border-gray-100">
                        {question.answers.map((answer, aIndex) => (
                            <div key={answer.id} className="ap-flex ap-items-start ap-gap-3">
                                {/* Correct Toggle */}
                                <Button
                                    variant="ghost"
                                    size="xs"
                                    onClick={() => updateAnswer(qIndex, aIndex, { isCorrect: !answer.isCorrect })}
                                    className={`ap-mt-2 ap-flex-shrink-0 !ap-w-6 !ap-h-6 !ap-min-h-0 !ap-p-0 !ap-rounded-full ap-border ap-flex ap-items-center ap-justify-center ap-transition-colors ${
                                        answer.isCorrect 
                                            ? '!ap-bg-green-500 !ap-border-green-500 !ap-text-white' : 'ap-border-gray-300 !ap-text-transparent hover:ap-border-green-400'
                                    }`}
                                    title={answer.isCorrect ? "Correct Answer" : "Mark as Correct"}
                                >
                                    <HiOutlineCheck className="ap-w-4 ap-h-4" />
                                </Button>

                                <div className="ap-flex-1">
                                    <div className="ap-flex ap-gap-2">
                                        <input
                                            type="text"
                                            value={answer.text}
                                            onChange={(e) => updateAnswer(qIndex, aIndex, { text: e.target.value })}
                                            placeholder={`Answer option ${aIndex + 1}`}
                                            className="ap-flex-1 ap-px-3 ap-py-1.5 ap-text-sm ap-border ap-border-gray-300 ap-rounded-md focus:ap-ring-blue-500 focus:ap-border-blue-500"
                                        />
                                        <Button
                                            variant="ghost"
                                            size="xs"
                                            onClick={() => removeAnswer(qIndex, aIndex)}
                                            className="!ap-text-gray-400 hover:!ap-text-red-500 !ap-p-1.5 !ap-min-h-0"
                                        >
                                            <HiOutlineTrash className="ap-w-4 ap-h-4" />
                                        </Button>
                                    </div>

                                    {/* Answer Image */}
                                    <div className="ap-mt-1">
                                        {answer.imageUrl ? (
                                            <div className="ap-relative ap-inline-block">
                                                <img src={answer.imageUrl} alt="Answer" className="ap-h-16 ap-w-auto ap-rounded ap-border" />
                                                <Button 
                                                    variant="ghost"
                                                    size="xs"
                                                    onClick={() => updateAnswer(qIndex, aIndex, { imageUrl: undefined })}
                                                    className="ap-absolute -ap-top-1.5 -ap-right-1.5 !ap-bg-red-100 !ap-text-red-600 !ap-rounded-full !ap-p-0.5 !ap-min-h-0 ap-border ap-border-red-200"
                                                >
                                                    <HiOutlineXMark className="ap-w-3 ap-h-3" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <Button
                                                variant="link"
                                                size="xs"
                                                onClick={() => openMediaLibrary(url => updateAnswer(qIndex, aIndex, { imageUrl: url }))}
                                                className="!ap-p-0 !ap-min-h-0 !ap-text-xs ap-flex ap-items-center ap-gap-1"
                                            >
                                                <HiOutlinePhotograph className="ap-w-3 ap-h-3" /> Add Image
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                        
                        <Button
                            variant="link"
                            size="sm"
                            onClick={() => addAnswer(qIndex)}
                            className="!ap-p-0 !ap-min-h-0 ap-flex ap-items-center ap-gap-1 ap-mt-2 ap-pl-9"
                        >
                            <HiOutlinePlus className="ap-w-4 ap-h-4" /> Add Answer Option
                        </Button>
                    </div>
                </div>
            ))}

            <div className="ap-flex ap-justify-center ap-pt-4">
                <Button
                    variant="outline"
                    onClick={addQuestion}
                    className="ap-flex ap-items-center ap-gap-2 !ap-px-6 !ap-py-3 !ap-border-2 !ap-border-dashed !ap-border-gray-300 !ap-rounded-lg !ap-text-gray-600 hover:!ap-border-blue-500 hover:!ap-text-blue-600 ap-transition-colors"
                >
                    <HiOutlinePlus className="ap-w-5 ap-h-5" />
                    Add Question
                </Button>
            </div>
        </div>
    );
};

export default QuizEditor;
