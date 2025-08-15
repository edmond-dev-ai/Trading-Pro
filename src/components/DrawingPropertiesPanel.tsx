import { useState, useRef, useEffect, useCallback } from 'react';
import { useTradingProStore, type Drawing, type DrawingTool, type LineStyle, type BaseDrawing } from '../store/store';
import { CustomColorPicker } from './CustomColorPicker';
import { Trash2, Settings, Minus, GripVertical, Waves, TrendingUp, MoveRight, MoveVertical } from 'lucide-react';
import { LineStyleSelect } from './LineStyleSelect';

// Helper to get the correct icon for a drawing tool
const getToolIcon = (tool: DrawingTool | null) => {
    if (!tool) return Settings;
    const iconMap: Record<string, React.ElementType> = {
        'trendline': TrendingUp,
        'fib-retracement': Waves,
        'horizontalRay': MoveRight,
        'vertical': MoveVertical,
    };
    if (iconMap[tool]) {
        return iconMap[tool];
    }
    return Settings;
};

export const DrawingPropertiesPanel = () => {
    const { 
        selectedDrawingId, 
        drawings, 
        updateDrawing, 
        removeDrawing, 
        setSelectedDrawingId,
        setDrawingSettingsModalOpen,
        setDrawingDefaults,
    } = useTradingProStore();
    
    const [position, setPosition] = useState({ x: 400, y: 50 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartPos = useRef({ x: 0, y: 0 });
    const panelRef = useRef<HTMLDivElement>(null);

    const selectedDrawing = drawings.find(d => d.id === selectedDrawingId);

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        setIsDragging(true);
        dragStartPos.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y,
        };
        e.preventDefault();
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging) return;
        setPosition({
            x: e.clientX - dragStartPos.current.x,
            y: e.clientY - dragStartPos.current.y,
        });
    }, [isDragging]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.userSelect = 'none';
        } else {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.userSelect = '';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.userSelect = '';
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    const handleUpdate = (data: Partial<BaseDrawing>) => {
        if (!selectedDrawingId || !selectedDrawing) return;
        updateDrawing(selectedDrawingId, data);
        setDrawingDefaults(selectedDrawing.type as DrawingTool, data);
    };

    const handleDelete = () => {
        if (!selectedDrawingId) return;
        removeDrawing(selectedDrawingId);
        setSelectedDrawingId(null);
    };

    if (!selectedDrawing) {
        return null;
    }

    const DrawingIcon = getToolIcon(selectedDrawing.type as DrawingTool);
    const hasLineStyle = 'lineStyle' in selectedDrawing;

    return (
        <div
            ref={panelRef}
            className="absolute z-30 flex items-center p-1 space-x-1 bg-[#0e0e0e] border border-[#2D2D2D] rounded-md shadow-2xl"
            style={{ top: `${position.y}px`, left: `${position.x}px` }}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <div
                className="p-1 cursor-move text-gray-500 hover:text-white"
                onMouseDown={handleMouseDown}
            >
                <GripVertical size={16} />
            </div>

            <div className="p-1 text-gray-400">
                <DrawingIcon size={16} />
            </div>

            <CustomColorPicker
                color={selectedDrawing.color || '#2563eb'}
                onChange={(color) => handleUpdate({ color })}
            />
            
            {hasLineStyle && (
                <>
                    <LineStyleSelect
                        lineStyle={selectedDrawing.lineStyle || 'Solid'}
                        onLineStyleChange={(style: LineStyle) => handleUpdate({ lineStyle: style })}
                    />

                    <div className="flex items-center space-x-1 bg-gray-800 rounded-md p-0.5">
                        {[1, 2, 3, 4].map(width => (
                            <button
                                key={width}
                                onClick={() => handleUpdate({ width })}
                                className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${selectedDrawing.width === width ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
                            >
                                <div className="flex items-center justify-center w-full h-full">
                                   <Minus style={{ strokeWidth: width + 1 }} size={16} />
                                </div>
                            </button>
                        ))}
                    </div>
                </>
            )}

            <button 
                onClick={() => setDrawingSettingsModalOpen(true)}
                className="p-2 text-gray-400 hover:bg-gray-700 hover:text-white rounded-md"
            >
                <Settings size={16} />
            </button>

            <button onClick={handleDelete} className="p-2 text-gray-400 hover:bg-gray-700 hover:text-red-500 rounded-md">
                <Trash2 size={16} />
            </button>
        </div>
    );
};
