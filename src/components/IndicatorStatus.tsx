import { Eye, Settings, Trash2 } from 'lucide-react';
import { useTradingProStore } from '../store/store';
import type { Indicator } from '../store/store';

// This helper function groups related indicator lines (e.g., BBL, BBM, BBU)
// under a single UI element by looking at their base ID.
const groupIndicators = (indicators: Indicator[]): Map<string, Indicator[]> => {
    const groups = new Map<string, Indicator[]>();
    indicators.forEach(indicator => {
        // This regex checks if an ID ends with an underscore and a number (e.g., '_0').
        // If it does, it captures the base part of the ID (e.g., 'BBANDS_20_2').
        const multiLineMatch = indicator.id.match(/(.+)_\d+$/);

        // Use the captured base part for multi-line indicators, or the full ID for single-line ones.
        const baseId = multiLineMatch ? multiLineMatch[1] : indicator.id;

        if (!groups.has(baseId)) {
            groups.set(baseId, []);
        }
        groups.get(baseId)!.push(indicator);
    });
    return groups;
};

export const IndicatorStatus = () => {
    const { activeIndicators, removeIndicator } = useTradingProStore();
    const grouped = groupIndicators(activeIndicators);

    if (activeIndicators.length === 0) return null;

    // When the trash icon is clicked, remove all indicators in that group
    const handleRemoveGroup = (group: Indicator[]) => {
        group.forEach(indicator => {
            removeIndicator(indicator.id);
        });
    };

    // Creates a clean display name, e.g., "SMA (20)" or "BBANDS (20, 2)"
    const getDisplayName = (group: Indicator[]) => {
        if (!group[0]) return "Indicator";
        const { name, options } = group[0];
        const optionString = Object.values(options).filter(v => !isNaN(Number(v))).join(', ');
        return `${name.split('_')[0]} (${optionString})`;
    };

    return (
        <div className="absolute top-2 left-14 z-20 text-white text-xs space-y-1">
            {Array.from(grouped.entries()).map(([baseId, group]) => (
                <div key={baseId} className="flex items-center space-x-2 p-1 rounded-md bg-gray-900 bg-opacity-50 hover:bg-opacity-75 transition-colors">
                    <span className="font-mono pl-1">{getDisplayName(group)}</span>
                    <button className="hover:text-blue-400" title="Toggle Visibility"><Eye size={14} /></button>
                    <button className="hover:text-blue-400" title="Settings"><Settings size={14} /></button>
                    <button onClick={() => handleRemoveGroup(group)} className="hover:text-red-500" title="Remove"><Trash2 size={14} /></button>
                </div>
            ))}
        </div>
    );
};

