import { useEffect, useRef, useState } from 'react';
import { parseTimeframeInput } from '../utils/timeframeParser';

interface FastTimeframeInputProps {
    inputValue: string;
    onInputChange: (value: string) => void;
    onConfirm: (timeframe: string) => void;
    onClose: () => void;
}

export const FastTimeframeInput = ({ inputValue, onInputChange, onConfirm, onClose }: FastTimeframeInputProps) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [parsedResult, setParsedResult] = useState<{ api: string, display: string } | null>(null);

    // Focus the input and move the cursor to the end
    useEffect(() => {
        const input = inputRef.current;
        if (input) {
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
        }
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
    }, [inputValue, parsedResult]);

    // Parse the input whenever it changes
    useEffect(() => {
        const result = parseTimeframeInput(inputValue);
        setParsedResult(result);
    }, [inputValue]);

    const handleConfirm = () => {
        if (parsedResult) {
            onConfirm(parsedResult.api);
        } else {
            onClose();
        }
    };

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
            onClick={onClose}
        >
            <div 
                className="bg-[#0e0e0e] rounded-md shadow-2xl p-4 w-60 text-center"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-gray-400 text-sm mb-4">Change interval</h3>
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => onInputChange(e.target.value)}
                    className="bg-transparent text-white text-1xl font-light w-40 text-center focus:outline-none px-2 py-2 border border-blue-500 rounded-md uppercase"
                />
                <div className="text-gray-500 text-sm h-5 mt-3">
                    {parsedResult ? parsedResult.display : (inputValue ? 'Invalid format' : ' ')}
                </div>
            </div>
        </div>
    );
};
