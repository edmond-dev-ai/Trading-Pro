import React, { useState } from 'react';
import { useTradingProStore } from '../store/store';
import { X, Settings, BarChart3, Calendar, AlertTriangle, TrendingUp, Palette } from 'lucide-react';
import { CustomColorPicker } from './CustomColorPicker';

interface SettingsPanelProps {
    onClose: () => void;
}

const SettingsRow = ({ label, children }: { label: string, children: React.ReactNode }) => (
    <div className="flex items-center justify-between py-1">
        <label className="text-sm text-gray-300">{label}</label>
        <div className="flex items-center space-x-2">{children}</div>
    </div>
);

const DisabledCheckbox = ({ checked = false }) => <input type="checkbox" checked={checked} disabled className="w-4 h-4 rounded border-gray-600 bg-gray-700 opacity-50" />;

const SymbolSection = () => {
    const { candlestickColors, setCandlestickColors } = useTradingProStore();
    return (
        <div>
            <h3 className="text-sm font-medium text-gray-400 mb-2 uppercase">Candles</h3>
            <div className="space-y-1">
                <SettingsRow label="Body">
                    <CustomColorPicker color={candlestickColors.upColor} onChange={color => setCandlestickColors({ upColor: color, borderUpColor: color })} />
                    <CustomColorPicker color={candlestickColors.downColor} onChange={color => setCandlestickColors({ downColor: color, borderDownColor: color })} />
                </SettingsRow>
                <SettingsRow label="Borders">
                    <CustomColorPicker color={candlestickColors.borderUpColor} onChange={color => setCandlestickColors({ borderUpColor: color })} />
                    <CustomColorPicker color={candlestickColors.borderDownColor} onChange={color => setCandlestickColors({ borderDownColor: color })} />
                </SettingsRow>
                <SettingsRow label="Wick">
                    <CustomColorPicker color={candlestickColors.wickUpColor} onChange={color => setCandlestickColors({ wickUpColor: color })} />
                    <CustomColorPicker color={candlestickColors.wickDownColor} onChange={color => setCandlestickColors({ wickDownColor: color })} />
                </SettingsRow>
            </div>
        </div>
    );
}

const CanvasSection = () => {
    const { chartAppearance, setChartAppearance } = useTradingProStore();
    return (
         <div>
            <h3 className="text-sm font-medium text-gray-400 mb-2 uppercase">Chart Basic Styles</h3>
            <div className="space-y-1">
                 <SettingsRow label="Background">
                    <CustomColorPicker color={chartAppearance.background} onChange={color => setChartAppearance({ background: color })} />
                </SettingsRow>
                <SettingsRow label="Grid Lines">
                     <CustomColorPicker color={chartAppearance.vertGridColor} onChange={color => setChartAppearance({ vertGridColor: color, horzGridColor: color })} />
                </SettingsRow>
            </div>
        </div>
    )
};
const StatusLineSection = () => <div><h3 className="text-sm font-medium text-gray-400 mb-2 uppercase">Status Line</h3><DisabledCheckbox checked /> Logo</div>;
const ScalesSection = () => <div><h3 className="text-sm font-medium text-gray-400 mb-2 uppercase">Scales</h3><DisabledCheckbox checked /> Labels</div>;
const TradingSection = () => <div><h3 className="text-sm font-medium text-gray-400 mb-2 uppercase">Trading</h3><DisabledCheckbox checked /> Buy/Sell Buttons</div>;
const AlertsSection = () => <div><h3 className="text-sm font-medium text-gray-400 mb-2 uppercase">Alerts</h3><DisabledCheckbox checked /> Alert Lines</div>;
const EventsSection = () => <div><h3 className="text-sm font-medium text-gray-400 mb-2 uppercase">Events</h3><DisabledCheckbox checked /> Economic Events</div>;


export const SettingsPanel = ({ onClose }: SettingsPanelProps) => {
    const [activeSection, setActiveSection] = useState('Symbol');
  
    const sections = [
        { id: 'Symbol', icon: BarChart3, label: 'Symbol', component: <SymbolSection /> },
        { id: 'Canvas', icon: Palette, label: 'Canvas', component: <CanvasSection /> },
        { id: 'StatusLine', icon: Settings, label: 'Status line', component: <StatusLineSection /> },
        { id: 'Scales', icon: TrendingUp, label: 'Scales and lines', component: <ScalesSection /> },
        { id: 'Trading', icon: TrendingUp, label: 'Trading', component: <TradingSection /> },
        { id: 'Alerts', icon: AlertTriangle, label: 'Alerts', component: <AlertsSection /> },
        { id: 'Events', icon: Calendar, label: 'Events', component: <EventsSection /> }
    ];

    const activeComponent = sections.find(s => s.id === activeSection)?.component;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
            <div className="bg-[#0e0e0e] text-white w-full max-w-3xl mx-auto rounded-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                <div className="flex-shrink-0 flex items-center justify-between p-3 border-b border-[#2D2D2D]">
                    <h2 className="text-base font-medium">Chart settings</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    <div className="w-48 bg-[#0e0e0e] border-r border-[#2D2D2D] overflow-y-auto">
                        <div className="p-2 space-y-1">
                            {sections.map((section) => {
                                const Icon = section.icon;
                                return (
                                    <button
                                        key={section.id}
                                        onClick={() => setActiveSection(section.id)}
                                        className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-left transition-colors ${
                                            activeSection === section.id
                                                ? 'bg-blue-600 text-white'
                                                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                        }`}
                                    >
                                        <Icon size={16} className="flex-shrink-0" />
                                        <span className="text-sm font-medium">{section.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex-1 p-4 overflow-y-auto">
                        {activeComponent}
                    </div>
                </div>

                <div className="flex-shrink-0 flex items-center justify-between p-3 border-t border-[#2D2D2D] bg-[#0e0e0e]">
                    <select disabled className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 opacity-50">
                        <option>Default template</option>
                    </select>
                    <div className="flex items-center space-x-2">
                        <button onClick={onClose} className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded text-sm font-semibold">
                            Cancel
                        </button>
                        <button onClick={onClose} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm font-semibold">
                            Ok
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
