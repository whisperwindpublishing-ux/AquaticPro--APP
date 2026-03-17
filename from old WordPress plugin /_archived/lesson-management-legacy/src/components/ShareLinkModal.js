import React, { useState, useRef } from 'react';

const ShareLinkModal = ({ link, onClose }) => {
    const [copyButtonText, setCopyButtonText] = useState('Copy');
    const inputRef = useRef(null);

    const handleCopy = () => {
        if (inputRef.current) {
            inputRef.current.select();
            navigator.clipboard.writeText(link)
                .then(() => {
                    setCopyButtonText('✓ Copied!');
                    setTimeout(() => setCopyButtonText('Copy'), 2000);
                })
                .catch(err => console.error('Failed to copy text: ', err));
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-lg w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b">
                    <h3 className="text-xl font-bold text-slate-900">Share Evaluation Link</h3>
                </div>
                <div className="p-6 space-y-4">
                    <p className="text-sm text-slate-600">Anyone with this link can view the swimmer's evaluation history. The link will expire in 30 days.</p>
                    <div className="flex rounded-md shadow-sm">
                    <input
                        ref={inputRef}
                        type="text"
                        value={link}
                        readOnly
                        onClick={() => inputRef.current.select()}
                        className="block w-full flex-1 rounded-none rounded-l-md border-slate-300 focus:border-sky-500 focus:ring-sky-500 sm:text-sm"
                    />
                        <button type="button" onClick={handleCopy} className="relative -ml-px inline-flex items-center space-x-2 rounded-r-md border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500">{copyButtonText}</button>
                    </div>
                </div>
                <div className="p-4 bg-slate-50 rounded-b-xl flex justify-end">
                    <button type="button" className="text-sm font-semibold text-slate-600 hover:text-slate-800" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

export default ShareLinkModal;