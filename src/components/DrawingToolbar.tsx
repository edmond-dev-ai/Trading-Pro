import {
    TrendingUp,
    ArrowUpRight,
    ArrowDownRight,
    Waves,
    MoveRight,
    MoveVertical,
} from 'lucide-react';
import { useTradingProStore } from '../store/store';
import type { DrawingTool } from '../store/store';

// --- NEW: Custom SVG component for the dashed crosshair icon ---
const DashedCrosshairIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="18" 
        height="18" 
        viewBox="0 0 18 18" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        {...props}
    >
        <line x1="9" y1="2" x2="9" y2="16" strokeDasharray="2 2" />
        <line x1="2" y1="9" x2="16" y2="9" strokeDasharray="2 2" />
    </svg>
);

// --- MODIFICATION: Updated tool list with new order and custom icon ---
const tools: { id: DrawingTool | null; icon: React.ElementType; label: string }[] = [
    { id: null, icon: DashedCrosshairIcon, label: 'Crosshair' },
    { id: 'trendline', icon: TrendingUp, label: 'Trend Line' },
    { id: 'horizontal-ray', icon: MoveRight, label: 'Horizontal Ray' },
    { id: 'vertical-line', icon: MoveVertical, label: 'Vertical Line' },
    { id: 'fib-retracement', icon: Waves, label: 'Fib Retracement' },
    { id: 'long-position', icon: ArrowUpRight, label: 'Long Position' },
    { id: 'short-position', icon: ArrowDownRight, label: 'Short Position' },
];

// Reusable button component for the toolbar
const ToolButton = ({ tool, isActive, onClick }: { tool: typeof tools[0], isActive: boolean, onClick: () => void }) => (
    <button
        onClick={onClick}
        title={tool.label}
        className={`w-9 h-9 flex items-center justify-center rounded-md transition-colors duration-200 ${
            isActive 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-400 hover:bg-gray-700 hover:text-white'
        }`}
    >
        <tool.icon />
    </button>
);

export const DrawingToolbar = () => {
    const { activeDrawingTool, setActiveDrawingTool } = useTradingProStore();

    const handleToolClick = (toolId: DrawingTool | null) => {
        setActiveDrawingTool(activeDrawingTool === toolId ? null : toolId);
    };

    return (
        <div className="flex flex-col items-center p-1.5 space-y-2">
            {tools.map((tool) => (
                <ToolButton
                    key={tool.label}
                    tool={tool}
                    isActive={activeDrawingTool === tool.id}
                    onClick={() => handleToolClick(tool.id)}
                />
            ))}
        </div>
    );
};
