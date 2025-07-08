import { useEffect, useRef, useState } from 'react';

interface FastTimeframeInputProps {
    inputValue: string;
    onInputChange: (value: string) => void;
    onConfirm: (timeframe: string) => void;
    onClose: () => void;
}

export const FastTimeframeInput = ({ inputValue, onInputChange, onConfirm, onClose }: FastTimeframeInputProps) => {
    const [unit, setUnit] = useState<'m' | 'H' | 'D' | 'W' | 'Mo'>('m');
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus the input field when the component mounts
    useEffect(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, []);

    // Handle key presses for confirming or closing
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                handleConfirm();
            } else if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [inputValue, unit]); // Re-bind when state changes

    const handleConfirm = () => {
        if (inputValue && parseInt(inputValue) > 0) {
            onConfirm(`${inputValue}${unit}`);
        } else {
            onClose();
        }
    };

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-60 flex items-start justify-center pt-20 z-50"
            onClick={onClose} // Close when clicking the overlay
        >
            <div 
                className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-4 flex items-center space-x-2"
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the box
            >
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => onInputChange(e.target.value.replace(/[^0-9]/g, ''))}
                    className="bg-gray-900 text-white text-lg font-mono w-24 p-2 rounded-md text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as any)}
                    className="bg-gray-700 text-white text-lg font-mono p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="m">Minutes</option>
                    <option value="H">Hours</option>
                    <option value="D">Days</option>
                    <option value="W">Weeks</option>
                    <option value="Mo">Months</option>
                </select>
                <button
                    onClick={handleConfirm}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
                >
                    Go
                </button>
            </div>
        </div>
    );
};
