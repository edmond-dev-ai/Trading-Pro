import React, { useState, useRef, useEffect } from 'react';
import { Clock, ChevronUp } from 'lucide-react';
import { useTradingProStore } from '../store/store';
import { getTimezoneOffset as getTzOffsetLib } from 'date-fns-tz';

interface TimezoneOption {
    name: string;
    value: string;
    utcOffset: number;
}

const TIMEZONE_OPTIONS: Omit<TimezoneOption, 'utcOffset'>[] = [
    { name: 'UTC', value: 'Etc/UTC' },
    { name: 'New York', value: 'America/New_York' },
    { name: 'Chicago', value: 'America/Chicago' },
    { name: 'Denver', value: 'America/Denver' },
    { name: 'Los Angeles', value: 'America/Los_Angeles' },
    { name: 'Vancouver', value: 'America/Vancouver' },
    { name: 'Phoenix', value: 'America/Phoenix' },
    { name: 'Anchorage', value: 'America/Anchorage' },
    { name: 'Honolulu', value: 'Pacific/Honolulu' },
    { name: 'Mexico City', value: 'America/Mexico_City' },
    { name: 'Sao Paulo', value: 'America/Sao_Paulo' },
    { name: 'Buenos Aires', value: 'America/Argentina/Buenos_Aires' },
    { name: 'Santiago', value: 'America/Santiago' },
    { name: 'Caracas', value: 'America/Caracas' },
    { name: 'Lima', value: 'America/Lima' },
    { name: 'Bogota', value: 'America/Bogota' },
    { name: 'Toronto', value: 'America/Toronto' },
    { name: 'London', value: 'Europe/London' },
    { name: 'Berlin', value: 'Europe/Berlin' },
    { name: 'Paris', value: 'Europe/Paris' },
    { name: 'Rome', value: 'Europe/Rome' },
    { name: 'Madrid', value: 'Europe/Madrid' },
    { name: 'Amsterdam', value: 'Europe/Amsterdam' },
    { name: 'Zurich', value: 'Europe/Zurich' },
    { name: 'Stockholm', value: 'Europe/Stockholm' },
    { name: 'Moscow', value: 'Europe/Moscow' },
    { name: 'Istanbul', value: 'Europe/Istanbul' },
    { name: 'Dubai', value: 'Asia/Dubai' },
    { name: 'Mumbai', value: 'Asia/Kolkata' },
    { name: 'Bangkok', value: 'Asia/Bangkok' },
    { name: 'Singapore', value: 'Asia/Singapore' },
    { name: 'Hong Kong', value: 'Asia/Hong_Kong' },
    { name: 'Shanghai', value: 'Asia/Shanghai' },
    { name: 'Tokyo', value: 'Asia/Tokyo' },
    { name: 'Seoul', value: 'Asia/Seoul' },
    { name: 'Sydney', value: 'Australia/Sydney' },
    { name: 'Melbourne', value: 'Australia/Melbourne' },
    { name: 'Auckland', value: 'Pacific/Auckland' },
];

const getOffsetInHours = (timezone: string): number => {
    try {
        const now = new Date();
        const offsetMilliseconds = getTzOffsetLib(timezone, now);
        return Math.round(offsetMilliseconds / (1000 * 60 * 60));
    } catch {
        return 0;
    }
};

const formatUTCOffset = (offset: number, isUTC: boolean = false): string => {
    if (isUTC) return 'UTC';
    if (offset === 0) return 'UTC+0';
    return offset > 0 ? `UTC+${offset}` : `UTC${offset}`;
};

export const TimezoneButton: React.FC = () => {
    const { timezone, setTimezone } = useTradingProStore();
    const [isOpen, setIsOpen] = useState(false);
    const [dropdownPosition, setDropdownPosition] = useState({
        top: 0,
        left: 0 as number | 'auto',
        right: 'auto' as number | 'auto',
        maxHeight: '20rem'
    });
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const currentOffset = getOffsetInHours(timezone);
    const isUTC = timezone === 'Etc/UTC';

    const timezoneOptionsWithOffsets: TimezoneOption[] = TIMEZONE_OPTIONS.map(tz => ({
        ...tz,
        utcOffset: getOffsetInHours(tz.value)
    }));

    const sortedTimezones = [...timezoneOptionsWithOffsets].sort((a, b) => {
        if (a.utcOffset !== b.utcOffset) {
            return a.utcOffset - b.utcOffset;
        }
        return a.name.localeCompare(b.name);
    });

    useEffect(() => {
        if (isOpen && buttonRef.current) {
            const buttonRect = buttonRef.current.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            
            const dropdownWidth = 256;
            const spacing = 8;
            
            const availableHeight = buttonRect.top - spacing;
            
            let top = spacing;
            let left: number | 'auto' = buttonRect.left;
            let right: number | 'auto' = 'auto';
            let maxHeight = `${availableHeight}px`;
            
            if (typeof left === 'number' && left + dropdownWidth > viewportWidth - spacing) {
                left = 'auto';
                right = viewportWidth - buttonRect.right;
            }
            
            if (typeof left === 'number' && left < spacing) {
                left = spacing;
                right = 'auto';
            }
            
            setDropdownPosition({ top, left, right, maxHeight });
        }
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
                buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    const handleTimezoneSelect = (timezoneValue: string) => {
        setTimezone(timezoneValue);
        setIsOpen(false);
    };

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-1 px-2 py-1 text-xs text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors duration-200"
                title="Change timezone"
            >
                <Clock size={12} />
                <span className="font-medium">
                    {formatUTCOffset(currentOffset, isUTC)}
                </span>
                <ChevronUp 
                    size={10} 
                    className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {isOpen && (
                <div 
                    ref={dropdownRef}
                    className="fixed w-64 overflow-y-auto bg-[#0e0e0e] border border-[#2D2D2D] rounded-lg shadow-xl z-50"
                    style={{
                        top: `${dropdownPosition.top}px`,
                        left: dropdownPosition.left !== 'auto' ? `${dropdownPosition.left}px` : undefined,
                        right: dropdownPosition.right !== 'auto' ? `${dropdownPosition.right}px` : undefined,
                        maxHeight: dropdownPosition.maxHeight
                    }}
                >
                    <div className="p-2">
                        <div className="text-xs text-gray-400 font-medium mb-2 px-2">
                            Select Timezone
                        </div>
                        
                        <div className="space-y-0.5">
                            {sortedTimezones.map((tz) => (
                                <button
                                    key={tz.value}
                                    onClick={() => handleTimezoneSelect(tz.value)}
                                    className={`w-full text-left px-3 py-2 text-xs rounded transition-colors duration-150 flex items-center justify-between ${
                                        timezone === tz.value
                                            ? 'bg-blue-600 text-white'
                                            : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                    }`}
                                >
                                    <span>
                                        {formatUTCOffset(tz.utcOffset, tz.value === 'Etc/UTC')} {tz.name}
                                    </span>
                                    {timezone === tz.value && (
                                        <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
