import React, { useState } from 'react';
import { useTradingProStore } from '../store/store';
import { webSocketService } from '../hooks/useWebSocketService';
import type { Indicator } from '../store/store';
import { X } from 'lucide-react';
import { CustomColorPicker } from './CustomColorPicker';

interface IndicatorSettingsModalProps {
    indicatorGroup: Indicator[];
    onClose: () => void;
}

// Helper to generate a display name for the indicator group
const getDisplayName = (group: Indicator[]) => {
    if (!group[0]) return "Indicator Settings";
    const { name, options } = group[0];
    const optionString = Object.values(options).filter(v => !isNaN(Number(v))).join(', ');
    return `${name.split('_')[0]} (${optionString})`;
};

// Helper to generate a simplified line name from an indicator ID
const getLineName = (id: string): string => {
    const parts = id.split('_');
    const namePart = parts.length > 2 ? parts[parts.length-2] : parts[parts.length-1];
    // Attempt to return just the letter part if it's like 'BBU_20_2'
    const match = namePart.match(/[a-zA-Z]+/);
    return match ? match[0] : namePart;
};

export const IndicatorSettingsModal = ({ indicatorGroup, onClose }: IndicatorSettingsModalProps) => {
    const tabs = ['Inputs', 'Style', 'Visibility'];
    const [options, setOptions] = useState(indicatorGroup[0].options);
    const [activeTab, setActiveTab] = useState('Inputs');
    const { liveData, updateIndicatorStyle, activeIndicators } = useTradingProStore();

    if (!indicatorGroup || indicatorGroup.length === 0) {
        return null;
    }

    const originalIds = new Set(indicatorGroup.map(ind => ind.id));
    const liveIndicatorGroup = activeIndicators.filter(ind => originalIds.has(ind.id));

    const handleOk = () => {
        const liveIndicator = liveIndicatorGroup[0];
        if (!liveIndicator) {
            onClose();
            return;
        }

        const { color, isVisible } = liveIndicator;
        const indicator = indicatorGroup[0];
        const newId = `${indicator.name.split('_')[0].toUpperCase()}_${Object.values(options).join('_')}`;

        webSocketService.sendMessage({
            action: 'get_indicator',
            params: {
                id: newId,
                name: indicator.name.split('_')[0].toLowerCase(),
                ...options,
                color,
                isVisible
            },
            data: liveData
        });

        onClose();
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'Inputs':
                return (
                    <div className="p-4 space-y-4">
                        {Object.entries(options).map(([key, value]) => (
                            <div key={key} className="flex items-center justify-between">
                                <label className="text-sm text-gray-300 w-1/3 capitalize">{key}</label>
                                <input
                                    type="number"
                                    value={value}
                                    onChange={(e) => setOptions(prev => ({
                                        ...prev,
                                        [key]: Number(e.target.value)
                                    }))}
                                    className="w-2/3 px-2 py-1 bg-gray-700 text-white rounded text-sm border border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                        ))}
                    </div>
                );
            case 'Style':
                return (
                    <div className="p-4 space-y-6">
                        {liveIndicatorGroup.map(indicator => (
                            <div key={indicator.id} className="flex items-center justify-between">
                                <label className="text-sm text-gray-300 w-1/3">
                                    {getLineName(indicator.name)}
                                </label>
                                <div className="w-2/3 flex items-center space-x-2">
                                    <CustomColorPicker
                                        color={indicator.color || '#2563eb'}
                                        onChange={(newColor) => updateIndicatorStyle(indicator.id, { color: newColor })}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                );
            case 'Visibility':
                return <div className="p-4 text-gray-400">Visibility placeholder content.</div>;
            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
            <div className="bg-[#0e0e0e] text-white w-full max-w-md mx-auto rounded-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex-shrink-0 flex items-center justify-between p-3 border-b border-[#2D2D2D]">
                    <h2 className="text-base font-medium">{getDisplayName(indicatorGroup)}</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded">
                        <X size={18} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex-shrink-0 flex border-b border-[#2D2D2D]">
                     {tabs.map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 text-sm font-medium transition-colors ${
                                activeTab === tab
                                    ? 'border-b-2 border-blue-500 text-white'
                                    : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {renderContent()}
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 flex items-center justify-end p-3 border-t border-[#2D2D2D] bg-[#0e0e0e] space-x-2">
                    <button onClick={onClose} className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded text-sm font-semibold">
                        Cancel
                    </button>
                    <button onClick={handleOk} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm font-semibold">
                        Ok
                    </button>
                </div>
            </div>
        </div>
    );
};
