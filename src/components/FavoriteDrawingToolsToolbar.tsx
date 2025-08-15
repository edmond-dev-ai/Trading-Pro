import { useState, useRef, useEffect, useCallback } from 'react';
import { useTradingProStore, type DrawingTool } from '../store/store';
import { GripVertical, X, TrendingUp, MoveRight, MoveVertical, Waves } from 'lucide-react';

// Helper to get the correct icon for a drawing tool
const getToolIcon = (tool: DrawingTool) => {
    const iconMap: Record<string, React.ElementType> = {
        'trendline': TrendingUp,
        'fib-retracement': Waves,
        'horizontalRay': MoveRight,
        'vertical': MoveVertical,
    };
    if (tool && iconMap[tool]) {
        return iconMap[tool];
    }
    return TrendingUp; // Default icon
};

export const FavoriteDrawingToolsToolbar = () => {
    const { 
        favoriteDrawingTools, 
        isFavoriteToolbarVisible,
        activeDrawingTool,
        setActiveDrawingTool,
        setFavoriteToolbarVisible
    } = useTradingProStore();
    
    const [position, setPosition] = useState({ x: 300, y: 100 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartPos = useRef({ x: 0, y: 0 });
    const panelRef = useRef<HTMLDivElement>(null);

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

    if (!isFavoriteToolbarVisible || favoriteDrawingTools.length === 0) {
        return null;
    }

    return (
        <div
            ref={panelRef}
            className="absolute z-30 flex items-center p-1 space-x-1 bg-[#0e0e0e] border border-[#2D2D2D] rounded-md shadow-2xl"
            style={{ top: `${position.y}px`, left: `${position.x}px` }}
            onMouseDown={(e) => e.stopPropagation()}
        >
            {/* Render tool buttons */}
            {favoriteDrawingTools.map(tool => {
                const Icon = getToolIcon(tool);
                return (
                    <button
                        key={tool}
                        onClick={() => setActiveDrawingTool(tool)}
                        className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${activeDrawingTool === tool ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}
                    >
                        <Icon size={18} />
                    </button>
                );
            })}

            {/* Separator */}
            <div className="w-px h-6 bg-gray-600 mx-1"></div>

            {/* Drag handle */}
            <div
                className="p-1 cursor-move text-gray-500 hover:text-white"
                onMouseDown={handleMouseDown}
            >
                <GripVertical size={16} />
            </div>

             {/* Close button */}
            <button onClick={() => setFavoriteToolbarVisible(false)} className="p-1 text-gray-500 hover:text-white">
                <X size={16}/>
            </button>
        </div>
    );
};
