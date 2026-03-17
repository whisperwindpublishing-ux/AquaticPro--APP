/**
 * WordPress dependencies
 */
import { useEffect } from 'react';

const Modal = ({ isOpen, onClose, title, children }) => {
    useEffect(() => {
        const handleEsc = (event) => {
            if (event.keyCode === 27) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEsc);

        return () => {
            window.removeEventListener('keydown', handleEsc);
        };
    }, [onClose]);

    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex justify-center items-center p-2 sm:p-4" onClick={onClose} aria-modal="true" role="dialog">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-3xl max-h-[95vh] sm:max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 sm:p-6 border-b sticky top-0 bg-white z-10 flex justify-between items-center flex-shrink-0">
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900 pr-4">{title}</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-3xl leading-none">&times;</button>
                </div>
                <div className="p-4 sm:p-6 overflow-y-auto flex-1">{children}</div>
            </div>
        </div>
    );
};

export default Modal;