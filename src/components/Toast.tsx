import React, { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

const Toast = () => {
    const { toast, clearToast } = useGameStore();

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => {
                clearToast();
            }, 5000); // Auto-dismiss after 5 seconds

            return () => clearTimeout(timer);
        }
    }, [toast, clearToast]);

    if (!toast) return null;

    const bgColor = toast.type === 'error' ? 'bg-red-600' : 
                    toast.type === 'success' ? 'bg-green-600' : 
                    'bg-blue-600';

    return (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-slide-down">
            <div className={`${bgColor} text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] max-w-[500px]`}>
                <span className="text-lg">
                    {toast.type === 'error' ? '⚠️' : toast.type === 'success' ? '✓' : 'ℹ️'}
                </span>
                <span className="flex-1">{toast.message}</span>
                <button 
                    onClick={clearToast}
                    className="text-white/80 hover:text-white text-xl leading-none"
                    aria-label="Close notification"
                >
                    ×
                </button>
            </div>
        </div>
    );
};

export default Toast;
