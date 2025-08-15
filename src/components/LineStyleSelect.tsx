import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import type { LineStyle } from '../store/store';

interface LineStyleSelectProps {
    lineStyle: LineStyle;
    onLineStyleChange: (style: LineStyle) => void;
}

const lineStyles: { style: LineStyle; label: string }[] = [
    { style: 'Solid', label: 'Solid' },
    { style: 'Dashed', label: 'Dashed' },
    { style: 'Dotted', label: 'Dotted' },
];

const LinePreview = ({ style }: { style: LineStyle }) => {
    const getStrokeDasharray = () => {
        switch (style) {
            case 'Dashed': return '4, 4';
            case 'Dotted': return '1, 3';
            case 'Solid':
            default: return 'none';
        }
    };

    return (
        <svg width="100%" height="2" className="my-1">
            <line
                x1="0"
                y1="1"
                x2="100%"
                y2="1"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray={getStrokeDasharray()}
                strokeLinecap="round"
            />
        </svg>
    );
};

export const LineStyleSelect = ({ lineStyle, onLineStyleChange }: LineStyleSelectProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const handleSelect = (style: LineStyle) => {
        onLineStyleChange(style);
        setIsOpen(false);
    };

    const handleClickOutside = useCallback((event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
            setIsOpen(false);
        }
    }, []);

    useEffect(() => {
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [handleClickOutside]);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-24 h-7 flex items-center justify-between px-2 bg-gray-800 hover:bg-gray-700 rounded-md text-gray-300"
            >
                <div className="w-16">
                    <LinePreview style={lineStyle} />
                </div>
                <ChevronDown size={14} />
            </button>

            {isOpen && (
                <div className="absolute top-full mt-1 w-28 bg-[#0e0e0e] border border-[#2D2D2D] rounded-md shadow-lg z-40">
                    <div className="p-1">
                        {lineStyles.map(({ style, label }) => (
                            <button
                                key={style}
                                onClick={() => handleSelect(style)}
                                className={`w-full text-left px-2 py-1.5 text-sm rounded-md flex items-center gap-2 ${
                                    lineStyle === style
                                        ? 'bg-blue-600 text-white'
                                        : 'text-gray-300 hover:bg-gray-700'
                                }`}
                            >
                                <div className="w-12">
                                    <LinePreview style={style} />
                                </div>
                                <span>{label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
