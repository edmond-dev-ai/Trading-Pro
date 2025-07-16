import { useState } from 'react';
import { X, Search } from 'lucide-react';
import { useTradingProStore } from '../store/store';
import { webSocketService } from '../hooks/useWebSocketService';

interface IndicatorsPanelProps {
    onClose: () => void;
}

const IndicatorItem = ({ name, description, onClick }: { name: string, description: string, onClick: () => void }) => (
    <button onClick={onClick} className="w-full text-left py-2 px-3 hover:bg-gray-700 cursor-pointer rounded-md transition-colors duration-150">
        <h4 className="font-medium text-sm text-gray-100">{name}</h4>
        <p className="text-xs text-gray-400">{description}</p>
    </button>
);

const ComingSoon = () => (
    <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
        <h3 className="text-lg font-semibold">Coming Soon!</h3>
        <p className="text-sm">This section is currently under development.</p>
    </div>
);

export const IndicatorsPanel = ({ onClose }: IndicatorsPanelProps) => {
    const [activeTab, setActiveTab] = useState('Technicals');
    const { addIndicator } = useTradingProStore();

    const handleAddSma = () => {
        const newIndicator = {
            id: 'SMA_20',
            name: 'Moving Average',
            options: { length: 20 },
        };
        
        // Add to state
        addIndicator(newIndicator);

        // Send request to backend
        webSocketService.sendMessage({
            action: 'add_indicator',
            params: {
                name: 'sma',
                length: 20
            }
        });
        
        onClose(); // Close panel after adding
    };

    const indicators = [
        { name: 'Moving Average', description: 'A standard moving average', action: handleAddSma },
        { name: 'Exponential Moving Average', description: 'An exponential moving average', action: () => {} },
        { name: 'RSI', description: 'Relative Strength Index', action: () => {} },
        { name: 'MACD', description: 'Moving Average Convergence Divergence', action: () => {} },
        { name: 'Bollinger Bands', description: 'Volatility bands placing two standard deviations away.', action: () => {} },
        { name: 'Volume', description: 'The amount of an asset or security that changed hands over some period of time.', action: () => {} }
    ];

    const tabs = ['Technicals', 'Community', 'Personal'];

    const renderContent = () => {
        switch (activeTab) {
            case 'Technicals':
                return (
                    <div className="space-y-1">
                        {indicators.map(indicator => (
                            <IndicatorItem 
                                key={indicator.name} 
                                name={indicator.name}
                                description={indicator.description}
                                onClick={indicator.action} 
                            />
                        ))}
                    </div>
                );
            case 'Community':
            case 'Personal':
                return <ComingSoon />;
            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center z-50 pt-20">
            <div className="bg-[#1e222d] text-white w-full max-w-4xl mx-auto rounded-lg shadow-2xl flex flex-col max-h-[75vh]">
                <div className="flex-shrink-0 flex items-center justify-between p-3 border-b border-gray-700">
                    <div className="relative w-full max-w-xs">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search indicators..."
                            className="bg-gray-800 border border-gray-600 rounded-md w-full pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    <div className="w-48 bg-gray-900/30 border-r border-gray-700 overflow-y-auto">
                        <div className="p-2 space-y-1">
                            {tabs.map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                        activeTab === tab
                                            ? 'bg-blue-600 text-white'
                                            : 'text-gray-300 hover:bg-gray-700/50'
                                    }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 p-2 overflow-y-auto">
                        {renderContent()}
                    </div>
                </div>
            </div>
        </div>
    );
};
