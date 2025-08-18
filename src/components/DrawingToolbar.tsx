import {
    TrendingUp,
    Waves,
    MoveRight,
    MoveVertical,
    Trash2,
    ChevronRight,
    Star,
    Settings,
    RectangleHorizontal, // NEW
    ArrowUpRight, // NEW
    ArrowDownRight, // NEW
} from 'lucide-react';
import { useTradingProStore } from '../store/store';
import type { DrawingTool } from '../store/store';
import { useState, useRef, useEffect } from 'react';
import { FavoriteDrawingToolsToolbar } from './FavoriteDrawingToolsToolbar';
import { DrawingPropertiesPanel } from './DrawingPropertiesPanel';

// Price Range/Measurement icon with vertical arrows
const PriceRangeIcon = ({ size = 18 }: { size?: number }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width={size}
        height={size}
        viewBox="0 0 18 18" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
    >
        <path d="M9 3v12" />
        <path d="M6 6l3-3 3 3" />
        <path d="M6 12l3 3 3-3" />
    </svg>
);

// Custom SVG Icons matching TradingView
const CrosshairIcon = ({ size = 18 }: { size?: number }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width={size}
        height={size}
        viewBox="0 0 18 18" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
    >
        <line x1="9" y1="2" x2="9" y2="16" strokeDasharray="2 2" />
        <line x1="2" y1="9" x2="16" y2="9" strokeDasharray="2 2" />
    </svg>
);

const LineToolIcon = ({ size = 18 }: { size?: number }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width={size}
        height={size}
        viewBox="0 0 18 18" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
    >
        <line x1="3" y1="15" x2="15" y2="3" />
    </svg>
);

const FibToolIcon = ({ size = 18 }: { size?: number }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width={size}
        height={size}
        viewBox="0 0 18 18" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
    >
        <line x1="3" y1="5" x2="15" y2="5" />
        <line x1="3" y1="8" x2="15" y2="8" />
        <line x1="3" y1="11" x2="15" y2="11" />
        <line x1="3" y1="14" x2="15" y2="14" />
    </svg>
);

const ElliottWaveIcon = ({ size = 18 }: { size?: number }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width={size}
        height={size}
        viewBox="0 0 18 18" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
    >
        <path d="M2 12l3-6 3 4 3-8 3 6 2-4" />
    </svg>
);

const GeometricIcon = ({ size = 18 }: { size?: number }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width={size}
        height={size}
        viewBox="0 0 18 18" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
    >
        <rect x="3" y="3" width="12" height="8" />
    </svg>
);

const TextIcon = ({ size = 18 }: { size?: number }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width={size}
        height={size}
        viewBox="0 0 18 18" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
    >
        <path d="M5 3h8M9 3v12M7 15h4" />
    </svg>
);

const ZoomIcon = ({ size = 18 }: { size?: number }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width={size}
        height={size}
        viewBox="0 0 18 18" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
    >
        <circle cx="8" cy="8" r="6" />
        <path d="M16 16l-4.35-4.35" />
        <path d="M6 8h4M8 6v4" />
    </svg>
);

const MagnetIcon = ({ size = 18 }: { size?: number }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width={size}
        height={size}
        viewBox="0 0 18 18" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="1.8" 
        strokeLinecap="round" 
        strokeLinejoin="round"
    >
        <path d="M4 3v6c0 2.8 2.2 5 5 5s5-2.2 5-5V3" />
        <path d="M4 3h2M12 3h2M4 6h2M12 6h2" />
    </svg>
);

const EyeIcon = ({ size = 18 }: { size?: number }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width={size}
        height={size}
        viewBox="0 0 18 18" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
    >
        <path d="M1 9s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" />
        <circle cx="9" cy="9" r="3" />
    </svg>
);

const StarIcon = ({ size = 18 }: { size?: number }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width={size}
        height={size}
        viewBox="0 0 18 18" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
    >
        <polygon points="9,1 11,6 17,6 12.5,10 14.5,16 9,12.5 3.5,16 5.5,10 1,6 7,6" />
    </svg>
);

const RulerIcon = ({ size = 18 }: { size?: number }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width={size}
        height={size}
        viewBox="0 0 18 18" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
    >
        <rect x="2" y="7" width="14" height="4" rx="1" />
        <line x1="4" y1="7" x2="4" y2="9" />
        <line x1="6" y1="7" x2="6" y2="11" />
        <line x1="8" y1="7" x2="8" y2="9" />
        <line x1="10" y1="7" x2="10" y2="11" />
        <line x1="12" y1="7" x2="12" y2="9" />
        <line x1="14" y1="7" x2="14" y2="11" />
    </svg>
);

// NEW: Icon for Prediction/Measurement Tools
const PredictionToolIcon = ({ size = 18 }: { size?: number }) => (
     <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width={size}
        height={size}
        viewBox="0 0 18 18" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
    >
        <path d="M3 3v12h12" />
        <path d="M7 10l4-4 4 4" />
    </svg>
);

// Tool category definitions
interface ToolCategory {
    id: string;
    icon: React.ElementType;
    label: string;
    tools: { id: DrawingTool | null | 'delete' | 'magnet'; icon: React.ElementType; label: string }[];
    hasSubmenu?: boolean;
}

const toolCategories: ToolCategory[] = [
    { 
        id: 'crosshair', 
        icon: CrosshairIcon, 
        label: 'Crosshair',
        tools: [{ id: null, icon: CrosshairIcon, label: 'Crosshair' }],
        hasSubmenu: false
    },
    { 
        id: 'line-tools', 
        icon: LineToolIcon, 
        label: 'Line Tools',
        tools: [
            { id: 'trendline', icon: TrendingUp, label: 'Trend Line' },
            { id: 'horizontalRay', icon: MoveRight, label: 'Horizontal Ray' },
            { id: 'vertical', icon: MoveVertical, label: 'Vertical Line' },
        ],
        hasSubmenu: true
    },
    { 
        id: 'fib-tools', 
        icon: FibToolIcon, 
        label: 'Fibonacci Tools',
        tools: [
            { id: 'fib-retracement', icon: Waves, label: 'Fib Retracement' },
        ],
        hasSubmenu: true
    },
    // NEW: Prediction and Measurement Category
    {
        id: 'prediction-measurement',
        icon: PredictionToolIcon,
        label: 'Prediction and Measurement Tools',
        tools: [
            { id: 'long-position', icon: ArrowUpRight, label: 'Long Position' },
            { id: 'short-position', icon: ArrowDownRight, label: 'Short Position' },
        ],
        hasSubmenu: true,
    },
    { 
        id: 'elliott-wave', 
        icon: ElliottWaveIcon, 
        label: 'Elliott Wave',
        tools: [],
        hasSubmenu: true
    },
    { 
        id: 'price-range', 
        icon: PriceRangeIcon, 
        label: 'Price Range/Measurement',
        tools: [],
        hasSubmenu: true
    },
    { 
        id: 'geometric', 
        icon: GeometricIcon, 
        label: 'Geometric Shapes & Brushes',
        tools: [
            { id: 'rectangle', icon: RectangleHorizontal, label: 'Rectangle' },
        ],
        hasSubmenu: true
    },
    { 
        id: 'text', 
        icon: TextIcon, 
        label: 'Text & Notes',
        tools: [],
        hasSubmenu: true
    },
    { 
        id: 'measure', 
        icon: RulerIcon, 
        label: 'Measure',
        tools: [],
        hasSubmenu: false
    },
    { 
        id: 'zoom', 
        icon: ZoomIcon, 
        label: 'Zoom',
        tools: [],
        hasSubmenu: true
    },
    { 
        id: 'magnet', 
        icon: MagnetIcon, 
        label: 'Magnet',
        tools: [{ id: 'magnet', icon: MagnetIcon, label: 'Magnet Mode' }],
        hasSubmenu: false
    },
    { 
        id: 'eye', 
        icon: EyeIcon, 
        label: 'Hide/Show',
        tools: [],
        hasSubmenu: false
    },
    { 
        id: 'delete', 
        icon: Trash2, 
        label: 'Delete',
        tools: [{ id: 'delete', icon: Trash2, label: 'Delete' }],
        hasSubmenu: true
    },
    { 
        id: 'favorites', 
        icon: StarIcon, 
        label: 'Favorites',
        tools: [],
        hasSubmenu: false
    },
    { 
        id: 'settings', 
        icon: Settings, 
        label: 'Drawing Properties',
        tools: [],
        hasSubmenu: false
    },
];

// Category button component
const CategoryButton = ({ 
    category, 
    isActive, 
    onClick, 
    onSubmenuToggle,
    showSubmenu,
    currentToolIcon
}: { 
    category: ToolCategory;
    isActive: boolean;
    onClick: () => void;
    onSubmenuToggle: () => void;
    showSubmenu: boolean;
    currentToolIcon?: React.ElementType;
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const DisplayIcon = currentToolIcon || category.icon;
    
    return (
        <div 
            className="relative flex items-center"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <button
                onClick={onClick}
                title={category.label}
                className={`w-10 h-10 flex items-center justify-center rounded-md transition-colors duration-200 ${
                    isActive 
                        ? 'bg-blue-600 text-white' 
                        : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
            >
                <DisplayIcon size={20} />
            </button>
            
            {category.hasSubmenu && isHovered && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onSubmenuToggle();
                    }}
                    className="w-1.5 h-9 flex items-center justify-center bg-gray-600 rounded-bl-md rounded-tr-md ml-1"
                >
                    <ChevronRight size={7} className={`transition-transform duration-200 ${showSubmenu ? 'rotate-90' : ''}`} />
                </button>
            )}
        </div>
    );
};

// Submenu component
const ToolSubmenu = ({ 
    category, 
    onClose, 
    onToolSelect,
    activeDrawingTool,
    onClearDrawings,
    onClearIndicators
}: {
    category: ToolCategory;
    onClose: () => void;
    onToolSelect: (toolId: DrawingTool | null | 'delete' | 'magnet') => void;
    activeDrawingTool: DrawingTool | null;
    onClearDrawings: () => void;
    onClearIndicators: () => void;
}) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const { favoriteDrawingTools = [], toggleFavoriteDrawingTool } = useTradingProStore();

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    if (category.id === 'delete') {
        return (
            <div ref={menuRef} className="absolute left-full top-0 ml-1 w-48 bg-gray-800 rounded-md shadow-lg z-30 border border-gray-700">
                <div className="p-1.5 space-y-1">
                    <button
                        onClick={onClearDrawings}
                        className="w-full text-left px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700 rounded-md"
                    >
                        Delete all drawings
                    </button>
                    <button
                        onClick={onClearIndicators}
                        className="w-full text-left px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700 rounded-md"
                    >
                        Delete all indicators
                    </button>
                </div>
            </div>
        );
    }

    if (category.tools.length === 0) {
        return (
            <div ref={menuRef} className="absolute left-full top-0 ml-1 w-48 bg-gray-800 rounded-md shadow-lg z-30 border border-gray-700">
                <div className="p-3 text-sm text-gray-400">
                    Coming soon...
                </div>
            </div>
        );
    }

    return (
        <div ref={menuRef} className="absolute left-full top-0 ml-1 w-56 bg-gray-800 rounded-md shadow-lg z-30 border border-gray-700">
            <div className="p-1.5 space-y-1">
                {category.tools.map((tool) => {
                    if (!tool.id) return null;
                    const ToolIcon = tool.icon;
                    const isFavorite = favoriteDrawingTools.includes(tool.id as DrawingTool);
                    return (
                        <div key={tool.label} className="flex items-center group">
                            <button
                                onClick={() => onToolSelect(tool.id)}
                                className={`flex-grow flex items-center gap-3 px-3 py-1.5 text-sm rounded-l-md transition-colors duration-200 ${
                                    activeDrawingTool === tool.id
                                        ? 'bg-blue-600 text-white'
                                        : 'text-gray-200 group-hover:bg-gray-700'
                                }`}
                            >
                                <ToolIcon size={16} />
                                <span>{tool.label}</span>
                            </button>
                            <button
                                onClick={() => toggleFavoriteDrawingTool(tool.id as DrawingTool)}
                                className="px-2 py-1.5 rounded-r-md text-gray-500 group-hover:bg-gray-700"
                            >
                                <Star
                                    size={16}
                                    className={`transition-colors ${isFavorite ? 'text-yellow-400 fill-current' : 'group-hover:text-yellow-400'}`}
                                />
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export const DrawingToolbar = () => {
    const { 
        activeDrawingTool, 
        setActiveDrawingTool,
        selectedDrawingId,
        isFavoriteToolbarVisible,
        clearDrawings,
        clearIndicators,
        setFavoriteToolbarVisible,
        clearActiveTool,
        isMagnetModeActive,
        setIsMagnetModeActive,
    } = useTradingProStore();

    const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
    const [categoryToolIcons, setCategoryToolIcons] = useState<Record<string, React.ElementType>>({});

    const getCurrentCategory = () => {
        if (activeDrawingTool === null) return 'crosshair';
        
        for (const category of toolCategories) {
            if (category.tools.some(tool => tool.id === activeDrawingTool)) {
                return category.id;
            }
        }
        return null;
    };

    const handleCategoryClick = (categoryId: string) => {
        const category = toolCategories.find(cat => cat.id === categoryId);
        if (!category) return;

        if (categoryId === 'favorites') {
            setFavoriteToolbarVisible(!isFavoriteToolbarVisible);
            return;
        }
        
        if (categoryId === 'magnet') {
            setIsMagnetModeActive(!isMagnetModeActive);
            setOpenSubmenu(null);
            return;
        }

        if (categoryId === 'settings') {
            setOpenSubmenu(null);
            return;
        }

        if (category.hasSubmenu) {
            if (category.tools.length > 0) {
                const firstTool = category.tools[0];
                setActiveDrawingTool(firstTool.id as DrawingTool | null);
                setCategoryToolIcons(prev => ({
                    ...prev,
                    [categoryId]: firstTool.icon
                }));
            }
            setOpenSubmenu(openSubmenu === categoryId ? null : categoryId);
        } else {
            if (categoryId === 'crosshair') {
                clearActiveTool();
            }
            setOpenSubmenu(null);
        }
    };

    const handleSubmenuToggle = (categoryId: string) => {
        setOpenSubmenu(openSubmenu === categoryId ? null : categoryId);
    };

    const handleToolSelect = (toolId: DrawingTool | null | 'delete' | 'magnet') => {
        if (toolId === 'delete') {
            clearActiveTool();
        } else if (toolId === 'magnet') {
            setIsMagnetModeActive(!isMagnetModeActive);
        } else {
            setActiveDrawingTool(toolId as DrawingTool | null);
            
            const category = toolCategories.find(cat => 
                cat.tools.some(tool => tool.id === toolId)
            );
            if (category) {
                const selectedTool = category.tools.find(tool => tool.id === toolId);
                if (selectedTool) {
                    setCategoryToolIcons(prev => ({
                        ...prev,
                        [category.id]: selectedTool.icon
                    }));
                }
            }
        }
        setOpenSubmenu(null);
    };

    const handleClearDrawings = () => {
        clearDrawings();
        setOpenSubmenu(null);
    };
    
    const handleClearIndicators = () => {
        clearIndicators();
        setOpenSubmenu(null);
    };

    const currentCategory = getCurrentCategory();

    return (
        <div className="flex flex-row md:flex-col items-center justify-around h-full">
            {isFavoriteToolbarVisible && <FavoriteDrawingToolsToolbar />}
            {selectedDrawingId && <DrawingPropertiesPanel />}

            {toolCategories.map((category) => {
                const isActive = category.id === 'favorites' 
                    ? isFavoriteToolbarVisible 
                    : category.id === 'magnet'
                    ? isMagnetModeActive
                    : currentCategory === category.id;

                return (
                    <div key={category.id} className="relative">
                        <CategoryButton
                            category={category}
                            isActive={isActive}
                            onClick={() => handleCategoryClick(category.id)}
                            onSubmenuToggle={() => handleSubmenuToggle(category.id)}
                            showSubmenu={openSubmenu === category.id}
                            currentToolIcon={categoryToolIcons[category.id]}
                        />
                        {openSubmenu === category.id && (
                            <ToolSubmenu 
                                category={category}
                                onClose={() => setOpenSubmenu(null)}
                                onToolSelect={handleToolSelect}
                                activeDrawingTool={activeDrawingTool}
                                onClearDrawings={handleClearDrawings}
                                onClearIndicators={handleClearIndicators}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
};
