import { useState, useRef, useEffect, useMemo } from 'react';
import { useTradingProStore } from '../store/store';

const standardTimeframesData = {
    'Minutes': ['1m', '3m', '5m', '15m', '30m', '45m'],
    'Hours': ['1H', '2H', '3H', '4H'],
    'Days': ['1D', '1W', '1Mo'],
};

const timeframeToMinutes = (tf: string): number => {
    const unitMatch = tf.match(/[a-zA-Z]+$/);
    const valueMatch = tf.match(/^\d+/);
    if (!unitMatch || !valueMatch) return Infinity;
    const unit = unitMatch[0];
    const value = parseInt(valueMatch[0], 10);
    switch (unit) {
        case 'm': return value;
        case 'H': return value * 60;
        case 'D': return value * 1440;
        case 'W': return value * 10080;
        case 'Mo': return value * 43200;
        default: return Infinity;
    }
}

export const TimeframeSelect = () => {
    const selectedTimeframe = useTradingProStore((state) => state.timeframe);
    const onSelect = useTradingProStore((state) => state.setTimeframe);
    const favoriteTimeframes = useTradingProStore((state) => state.favoriteTimeframes);
    const customTimeframes = useTradingProStore((state) => state.customTimeframes);
    const toggleFavorite = useTradingProStore((state) => state.toggleFavorite);
    const addCustomTimeframe = useTradingProStore((state) => state.addCustomTimeframe);
    const removeCustomTimeframe = useTradingProStore((state) => state.removeCustomTimeframe);

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [customInputValue, setCustomInputValue] = useState('1');
    const [customUnit, setCustomUnit] = useState('m');
    const dropdownRef = useRef<HTMLDivElement>(null);

    const displayTimeframes = useMemo(() => {
        if (favoriteTimeframes.includes(selectedTimeframe)) {
            return favoriteTimeframes;
        }
        return [...favoriteTimeframes, selectedTimeframe].sort((a, b) => timeframeToMinutes(a) - timeframeToMinutes(b));
    }, [selectedTimeframe, favoriteTimeframes]);

    const allTimeframes = useMemo(() => ({
        'Minutes': [...standardTimeframesData.Minutes, ...customTimeframes.filter(tf => tf.endsWith('m'))].sort((a, b) => timeframeToMinutes(a) - timeframeToMinutes(b)),
        'Hours': [...standardTimeframesData.Hours, ...customTimeframes.filter(tf => tf.endsWith('H'))].sort((a, b) => timeframeToMinutes(a) - timeframeToMinutes(b)),
        'Days': [...standardTimeframesData.Days, ...customTimeframes.filter(tf => tf.endsWith('D') || tf.endsWith('W') || tf.endsWith('Mo'))].sort((a, b) => timeframeToMinutes(a) - timeframeToMinutes(b)),
    }), [customTimeframes]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (tf: string) => {
        onSelect(tf);
        setIsDropdownOpen(false);
    };

    const handleCustomApply = () => {
        const number = parseInt(customInputValue, 10);
        if (isNaN(number) || number < 1) return;
        const customTf = `${number}${customUnit}`;
        addCustomTimeframe(customTf);
        onSelect(customTf);
        setIsModalOpen(false);
        setIsDropdownOpen(false);
    }

    const formatLabel = (tf: string) => {
        const valueMatch = tf.match(/^\d+/);
        if (!valueMatch) return tf;
        const value = parseInt(valueMatch[0], 10);
        const unit = tf.slice(valueMatch[0].length);
        switch (unit) {
            case 'm': return `${value} Minute${value > 1 ? 's' : ''}`;
            case 'H': return `${value} Hour${value > 1 ? 's' : ''}`;
            case 'D': return `${value} Day${value > 1 ? 's' : ''}`;
            case 'W': return `${value} Week${value > 1 ? 's' : ''}`;
            case 'Mo': return `${value} Month${value > 1 ? 's' : ''}`;
            default: return tf;
        }
    }
    
    const displayTfLabel = (tf: string) => tf.endsWith('Mo') ? tf.replace('Mo', 'M') : tf;

    return (
        <>
            <div className="flex items-center bg-gray-900 bg-opacity-50 rounded-md" ref={dropdownRef}>
                <div className="flex items-center border-r border-gray-700">
                    {displayTimeframes.map(tf => (
                        <button key={tf} onClick={() => handleSelect(tf)} className={`px-2 py-1 text-xs transition-colors duration-200 ${selectedTimeframe === tf ? 'text-blue-400 font-semibold' : 'text-gray-400 hover:text-white'}`}>
                            {displayTfLabel(tf)}
                        </button>
                    ))}
                </div>
                <div className="relative">
                    <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="px-2 py-2 text-sm text-gray-400 hover:text-white">
                        <svg className={`w-4 h-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"></path></svg>
                    </button>
                    {isDropdownOpen && (
                        <div className="absolute top-full mt-2 -ml-40 w-64 bg-gray-800 rounded-md shadow-lg z-30 p-2">
                            <div className="max-h-80 overflow-y-auto">
                                {Object.entries(allTimeframes).map(([category, timeframes]) => (
                                    timeframes.length > 0 && <div key={category} className="mb-2">
                                        <p className="text-xs text-gray-500 uppercase px-2 mb-1">{category}</p>
                                        <div className="flex flex-col space-y-1">
                                            {timeframes.map((tf: string) => ( // Explicitly type tf
                                                <div key={tf} className="flex items-center w-full group">
                                                    <button onClick={() => handleSelect(tf)} className={`flex-grow text-left py-1 px-3 text-sm rounded-l-md ${selectedTimeframe === tf ? 'bg-blue-600 text-white' : 'text-gray-300 group-hover:bg-gray-700'}`}>
                                                        {formatLabel(tf)}
                                                    </button>
                                                    {customTimeframes.includes(tf) ? (
                                                        <button onClick={() => removeCustomTimeframe(tf)} className="px-2 py-1 text-gray-500 hover:text-red-500 bg-gray-700 group-hover:bg-gray-600">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                        </button>
                                                    ) : <div className="w-8 bg-gray-700 group-hover:bg-gray-600"></div>}
                                                    <button onClick={() => toggleFavorite(tf)} className="px-2 py-1 bg-gray-700 group-hover:bg-gray-600 rounded-r-md">
                                                        <svg className={`w-4 h-4 ${favoriteTimeframes.includes(tf) ? 'text-yellow-400' : 'text-gray-500'}`} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <hr className="border-gray-700 my-2" />
                            <button onClick={() => { setIsModalOpen(true); setIsDropdownOpen(false); }} className="w-full text-left py-1 px-3 text-sm text-blue-400 hover:bg-gray-700 rounded-md">
                                + Add custom interval
                            </button>
                        </div>
                    )}
                </div>
            </div>
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-white">Add custom interval</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Type</label>
                                <select value={customUnit} onChange={(e) => setCustomUnit(e.target.value)} className="w-full bg-gray-700 text-white rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    <option value="m">Minutes</option>
                                    <option value="H">Hours</option>
                                    <option value="D">Days</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Interval</label>
                                <input type="text" value={customInputValue} onChange={(e) => setCustomInputValue(e.target.value.replace(/[^0-9]/g, ''))} className="w-full bg-gray-700 text-white rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end space-x-3">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600">Cancel</button>
                            <button onClick={handleCustomApply} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Add</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
