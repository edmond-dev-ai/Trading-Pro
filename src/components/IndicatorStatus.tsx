import { Eye, Settings, Trash2 } from 'lucide-react';
import { useTradingProStore } from '../store/store';
import type { Indicator } from '../store/store';

const groupIndicators = (indicators: Indicator[]): Map<string, Indicator[]> => {
    const groups = new Map<string, Indicator[]>();
    indicators.forEach(indicator => {
        const multiLineMatch = indicator.id.match(/(.+)_\d+$/);
        const baseId = multiLineMatch ? multiLineMatch[1] : indicator.id;

        if (!groups.has(baseId)) {
            groups.set(baseId, []);
        }
        groups.get(baseId)!.push(indicator);
    });
    return groups;
};

export const IndicatorStatus = () => {
    const { activeIndicators, removeIndicator, setIndicatorToEdit, toggleIndicatorVisibility } = useTradingProStore();
    const grouped = groupIndicators(activeIndicators);

    if (activeIndicators.length === 0) return null;

    const handleRemoveGroup = (group: Indicator[]) => {
        group.forEach(indicator => {
            removeIndicator(indicator.id);
        });
    };

    const getDisplayName = (group: Indicator[]) => {
        if (!group[0]) return "Indicator";
        const { name, options } = group[0];
        const optionString = Object.values(options).filter(v => !isNaN(Number(v))).join(', ');
        return `${name.split('_')[0]} (${optionString})`;
    };

    return (
        <div className="absolute top-2 left-14 z-20 text-white text-xs space-y-1">
            {Array.from(grouped.entries()).map(([baseId, group]) => (
                <div key={baseId} className="flex items-center space-x-2 p-1 rounded-md bg-[#0e0e0e] bg-opacity-50 hover:bg-opacity-75 transition-colors">
                    <span className="font-mono pl-1">{getDisplayName(group)}</span>
                    <button 
                        onClick={() => toggleIndicatorVisibility(group.map(ind => ind.id))}
                        className={`hover:text-blue-400 ${group[0]?.isVisible === false ? 'opacity-40' : ''}`} 
                        title="Toggle Visibility"
                    >
                        <Eye size={14} />
                    </button>
                    <button onClick={() => setIndicatorToEdit(group)} className="hover:text-blue-400" title="Settings"><Settings size={14} /></button>
                    <button onClick={() => handleRemoveGroup(group)} className="hover:text-red-500" title="Remove"><Trash2 size={14} /></button>
                </div>
            ))}
        </div>
    );
};
