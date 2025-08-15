import { useTradingProStore, type Drawing, type LineStyle, type BaseDrawing, type DrawingTool } from '../store/store';
import { X, Minus } from 'lucide-react';
import { CustomColorPicker } from './CustomColorPicker';
import { LineStyleSelect } from './LineStyleSelect';

// Helper to get a user-friendly name for the drawing type
const getDrawingDisplayName = (drawing: Drawing | undefined) => {
    if (!drawing) return 'Drawing Settings';
    switch (drawing.type) {
        case 'trendline': return 'Trend Line';
        case 'vertical': return 'Vertical Line';
        case 'horizontalRay': return 'Horizontal Ray';
        case 'fib-retracement': return 'Fib Retracement';
        default: return 'Settings';
    }
};

export const DrawingSettingsModal = () => {
    const {
        isDrawingSettingsModalOpen,
        setDrawingSettingsModalOpen,
        selectedDrawingId,
        drawings,
        updateDrawing,
        setDrawingDefaults, // MODIFIED: Get the action to save defaults
    } = useTradingProStore();

    const selectedDrawing = drawings.find(d => d.id === selectedDrawingId);

    const handleClose = () => {
        setDrawingSettingsModalOpen(false);
    };

    // MODIFIED: This function now also saves the changed property as a default for the tool.
    const handleUpdate = (data: Partial<BaseDrawing>) => {
        if (!selectedDrawingId || !selectedDrawing) return;
        
        // 1. Update the specific drawing instance
        updateDrawing(selectedDrawingId, data);

        // 2. Save the new property as the default for this tool type
        setDrawingDefaults(selectedDrawing.type as DrawingTool, data);
    };

    if (!isDrawingSettingsModalOpen || !selectedDrawing) {
        return null;
    }

    const renderStyleContent = () => {
        const hasLineStyle = 'lineStyle' in selectedDrawing;

        return (
            <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                    <label className="text-sm text-gray-300">Color</label>
                    <CustomColorPicker
                        color={selectedDrawing.color || '#2563eb'}
                        onChange={(color) => handleUpdate({ color })}
                    />
                </div>
                {hasLineStyle && (
                    <>
                        <div className="flex items-center justify-between">
                            <label className="text-sm text-gray-300">Line Style</label>
                            <LineStyleSelect
                                lineStyle={selectedDrawing.lineStyle || 'Solid'}
                                onLineStyleChange={(style: LineStyle) => handleUpdate({ lineStyle: style })}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <label className="text-sm text-gray-300">Line Width</label>
                            <div className="flex items-center space-x-1 bg-gray-900 rounded-md p-0.5">
                                {[1, 2, 3, 4].map(width => (
                                    <button
                                        key={width}
                                        onClick={() => handleUpdate({ width })}
                                        className={`w-8 h-7 flex items-center justify-center rounded-md transition-colors ${
                                            selectedDrawing.width === width ? 'bg-blue-600' : 'hover:bg-gray-700'
                                        }`}
                                    >
                                        <div className="flex items-center justify-center w-full h-full">
                                            <Minus style={{ strokeWidth: width + 1 }} size={16} />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
            <div className="bg-gray-800 text-white w-full max-w-sm mx-auto rounded-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex-shrink-0 flex items-center justify-between p-3 border-b border-gray-700">
                    <h2 className="text-base font-medium">{getDrawingDisplayName(selectedDrawing)}</h2>
                    <button onClick={handleClose} className="p-1 hover:bg-gray-700 rounded">
                        <X size={18} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex-shrink-0 flex border-b border-gray-700">
                    <button className="px-4 py-2 text-sm font-medium border-b-2 border-blue-500 text-white">
                        Style
                    </button>
                    <button className="px-4 py-2 text-sm font-medium text-gray-400 hover:bg-gray-700 hover:text-white">
                        Coordinates
                    </button>
                     <button className="px-4 py-2 text-sm font-medium text-gray-400 hover:bg-gray-700 hover:text-white">
                        Visibility
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {renderStyleContent()}
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 flex items-center justify-end p-3 border-t border-gray-700 bg-gray-900 space-x-2">
                    <button onClick={handleClose} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm font-semibold">
                        Ok
                    </button>
                </div>
            </div>
        </div>
    );
};