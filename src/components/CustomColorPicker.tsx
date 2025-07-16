import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';
import { ColorCanvas } from './ColorCanvas';
import { HueSlider } from './HueSlider';

interface CustomColorPickerProps {
    color: string;
    onChange: (color: string) => void;
}

// Helper to convert hex to an RGBA object
const hexToRgba = (hex: string) => {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
        r = parseInt(hex[1] + hex[2], 16);
        g = parseInt(hex[3] + hex[4], 16);
        b = parseInt(hex[5] + hex[6], 16);
    }
    return { r, g, b, a: 1 };
};

// Helper to convert rgba string to an object
const rgbaStringToObject = (rgba: string) => {
    if (rgba.startsWith('#')) {
        const { r, g, b } = hexToRgba(rgba);
        return { r, g, b, a: 1 };
    }
    
    const result = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (!result) return { r: 0, g: 0, b: 0, a: 1 };
    return {
        r: parseInt(result[1], 10),
        g: parseInt(result[2], 10),
        b: parseInt(result[3], 10),
        a: result[4] !== undefined ? parseFloat(result[4]) : 1,
    };
};

// Convert RGB to HSL
const rgbToHsl = (r: number, g: number, b: number) => {
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    
    return { h: h * 360, s: s * 100, l: l * 100 };
};

// Helper to convert HSL to hex
const hslToHex = (h: number, s: number, l: number) => {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
};

// TradingView default color palette
const defaultColors = [
    ['#ffffff', '#e8e8e8', '#d1d1d1', '#b8b8b8', '#a0a0a0', '#888888', '#707070', '#585858', '#404040', '#000000'],
    ['#f44336', '#ff9800', '#ffeb3b', '#4caf50', '#00bcd4', '#2196f3', '#3f51b5', '#9c27b0', '#e91e63', '#795548'],
    ['#ffcdd2', '#ffecb3', '#fff9c4', '#c8e6c9', '#b2ebf2', '#bbdefb', '#c5cae9', '#d1c4e9', '#f8bbd0', '#d7ccc8'],
    ['#ef9a9a', '#ffcc80', '#fff59d', '#a5d6a7', '#80deea', '#90caf9', '#9fa8da', '#b39ddb', '#f48fb1', '#bcaaa4'],
    ['#e57373', '#ffb74d', '#fff176', '#81c784', '#4dd0e1', '#64b5f6', '#7986cb', '#9575cd', '#f06292', '#a1887f'],
    ['#ef5350', '#ffa726', '#ffee58', '#66bb6a', '#26c6da', '#42a5f5', '#5c6bc0', '#7e57c2', '#ec407a', '#8d6e63'],
    ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#00acc1', '#1e88e5', '#3949ab', '#5e35b1', '#d81b60', '#6d4c41'],
    ['#c62828', '#f57c00', '#fbc02d', '#388e3c', '#0097a7', '#1976d2', '#303f9f', '#512da8', '#c2185b', '#5d4037'],
    ['#b71c1c', '#ef6c00', '#f9a825', '#2e7d32', '#00838f', '#1565c0', '#283593', '#4527a0', '#ad1457', '#4e342e'],
    ['#880e4f', '#bf360c', '#f57f17', '#1b5e20', '#006064', '#0d47a1', '#1a237e', '#311b92', '#6a0dad', '#3e2723'],
];

// Global storage for custom colors
let globalCustomColors: string[] = [];

export const CustomColorPicker = ({ color, onChange }: CustomColorPickerProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [showCustomPicker, setShowCustomPicker] = useState(false);
    const [customColors, setCustomColors] = useState<string[]>([]);
    const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
    
    const [hue, setHue] = useState(0);
    const [saturation, setSaturation] = useState(100);
    const [lightness, setLightness] = useState(50);
    const [opacity, setOpacity] = useState(100);
    const [hexInput, setHexInput] = useState(color.startsWith('#') ? color.substring(1) : '');

    const triggerRef = useRef<HTMLDivElement>(null);
    const pickerRef = useRef<HTMLDivElement>(null);
    const isDraggingCanvas = useRef(false);
    const isDraggingHue = useRef(false);
    const isInternalUpdate = useRef(false);

    const updateColorFromHsl = useCallback((h: number, s: number, l: number, a: number) => {
        isInternalUpdate.current = true;
        const hex = hslToHex(h, s, l);
        if (a === 1) {
            onChange(hex);
        } else {
            const { r, g, b } = hexToRgba(hex);
            onChange(`rgba(${r}, ${g}, ${b}, ${a})`);
        }
        setTimeout(() => {
            isInternalUpdate.current = false;
        }, 0);
    }, [onChange]);

    const handleCanvasChange = useCallback((newSaturation: number, newLightness: number, isDragging: boolean) => {
        isDraggingCanvas.current = isDragging;
        setSaturation(newSaturation);
        setLightness(newLightness);
        updateColorFromHsl(hue, newSaturation, newLightness, opacity / 100);
    }, [hue, opacity, updateColorFromHsl]);

    const handleHueChange = useCallback((newHue: number, isDragging: boolean) => {
        isDraggingHue.current = isDragging;
        setHue(newHue);
        updateColorFromHsl(newHue, saturation, lightness, opacity / 100);
    }, [saturation, lightness, opacity, updateColorFromHsl]);

    const handleColorSelect = (selectedColor: string) => {
        onChange(selectedColor);
        const rgba = rgbaStringToObject(selectedColor);
        const { h, s, l } = rgbToHsl(rgba.r, rgba.g, rgba.b);
        setHue(h);
        setSaturation(s);
        setLightness(l);
        setOpacity(rgba.a * 100);
        handleClose();
    };
    
    const addCurrentCustomColor = () => {
        const newColor = currentColorWithOpacity;
        if (!globalCustomColors.includes(newColor) && !defaultColors.flat().includes(newColor)) {
            globalCustomColors = [...globalCustomColors, newColor];
            setCustomColors(globalCustomColors);
        }
        setShowCustomPicker(false);
    };

    const handleOpacityChange = useCallback((newOpacity: number) => {
        setOpacity(newOpacity);
        updateColorFromHsl(hue, saturation, lightness, newOpacity / 100);
    }, [hue, saturation, lightness, updateColorFromHsl]);

    const calculatePopupPosition = useCallback(() => {
        if (!triggerRef.current) return { x: 0, y: 0 };
        
        const rect = triggerRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const popupWidth = 240; // w-60 = 15rem = 240px
        const popupHeight = showCustomPicker ? 200 : 300; // Approximate heights
        
        let x = rect.left;
        let y = rect.bottom + 8; // 8px gap (mt-2)
        
        // Adjust horizontal position if popup would go off-screen
        if (x + popupWidth > viewportWidth) {
            x = rect.right - popupWidth;
        }
        
        // Adjust vertical position if popup would go off-screen
        if (y + popupHeight > viewportHeight) {
            y = rect.top - popupHeight - 8;
        }
        
        // Ensure popup doesn't go off the left edge
        if (x < 8) {
            x = 8;
        }
        
        // Ensure popup doesn't go off the top edge
        if (y < 8) {
            y = 8;
        }
        
        return { x, y };
    }, [showCustomPicker]);

    useEffect(() => {
        if (isOpen && !isInternalUpdate.current && !isDraggingCanvas.current && !isDraggingHue.current) {
            const rgba = rgbaStringToObject(color);
            const { h, s, l } = rgbToHsl(rgba.r, rgba.g, rgba.b);
            setHue(h);
            setSaturation(s);
            setLightness(l);
            setOpacity(rgba.a * 100);
        }
    }, [isOpen, color]);

    useEffect(() => {
        if (isOpen) {
            setCustomColors([...globalCustomColors]);
            setPopupPosition(calculatePopupPosition());
        }
    }, [isOpen, calculatePopupPosition]);

    useEffect(() => {
        if (isOpen) {
            setPopupPosition(calculatePopupPosition());
        }
    }, [showCustomPicker, calculatePopupPosition]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node) &&
                triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
                handleClose();
            }
        };

        const handleResize = () => {
            if (isOpen) {
                setPopupPosition(calculatePopupPosition());
            }
        };

        const handleScroll = () => {
            if (isOpen) {
                setPopupPosition(calculatePopupPosition());
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            window.addEventListener('resize', handleResize);
            window.addEventListener('scroll', handleScroll, true);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [isOpen, calculatePopupPosition]);

    const handleToggle = () => {
        if (!isOpen) {
            setPopupPosition(calculatePopupPosition());
        }
        setIsOpen(!isOpen);
    };

    const handleClose = useCallback(() => {
        setIsOpen(false);
        setShowCustomPicker(false);
    }, []);

    const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newHex = e.target.value;
        setHexInput(newHex);
        if (/^[0-9A-F]{6}$/i.test(newHex)) {
            onChange('#' + newHex);
        }
    };

    useEffect(() => {
        if (color.startsWith('#')) {
            setHexInput(color.substring(1));
        }
    }, [color]);

    const currentColorWithOpacity = opacity === 100 
        ? hslToHex(hue, saturation, lightness) 
        : `rgba(${Object.values(hexToRgba(hslToHex(hue, saturation, lightness))).slice(0, 3).join(', ')}, ${opacity / 100})`;

    // Get portal container or create it if it doesn't exist
    const getPortalContainer = () => {
        let container = document.getElementById('color-picker-portal');
        if (!container) {
            container = document.createElement('div');
            container.id = 'color-picker-portal';
            document.body.appendChild(container);
        }
        return container;
    };

    const portalContent = isOpen ? (
        <div
            ref={pickerRef}
            className="fixed z-50 bg-gray-800 rounded-lg shadow-xl border border-gray-700 p-3 w-60"
            style={{
                left: `${popupPosition.x}px`,
                top: `${popupPosition.y}px`,
            }}
        >
            {showCustomPicker ? (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div 
                            className="w-8 h-8 rounded border-2 border-gray-600" 
                            style={{ backgroundColor: currentColorWithOpacity }}
                        />
                        <div className="relative w-24">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400">#</span>
                            <input
                                type="text"
                                value={hexInput}
                                onChange={handleHexInputChange}
                                maxLength={6}
                                className="w-full pl-5 pr-1 py-1 bg-gray-700 border border-gray-600 rounded text-center text-white text-sm uppercase"
                            />
                        </div>
                        <button 
                            onClick={addCurrentCustomColor} 
                            className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded text-sm font-semibold"
                        >
                            Add
                        </button>
                    </div>
                    <div className="flex gap-2">
                        <ColorCanvas
                            hue={hue}
                            saturation={saturation}
                            lightness={lightness}
                            onChange={handleCanvasChange}
                        />
                        <HueSlider
                            hue={hue}
                            onChange={handleHueChange}
                        />
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="grid grid-cols-10 gap-1">
                        {defaultColors.flat().map((c) => (
                            <div 
                                key={c} 
                                onClick={() => handleColorSelect(c)} 
                                className="w-4 h-4 rounded-sm cursor-pointer" 
                                style={{ backgroundColor: c }} 
                            />
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-1 border-t border-gray-700 pt-2">
                        {customColors.map((c) => (
                            <div 
                                key={c} 
                                onClick={() => handleColorSelect(c)} 
                                className="w-4 h-4 rounded-sm cursor-pointer" 
                                style={{ backgroundColor: c }} 
                            />
                        ))}
                        <button 
                            onClick={() => setShowCustomPicker(true)} 
                            className="w-4 h-4 rounded-sm flex items-center justify-center bg-gray-700 hover:bg-gray-600"
                        >
                            <Plus size={14} />
                        </button>
                    </div>
                    <div>
                        <div className="text-xs text-gray-400 mb-1">Opacity: {Math.round(opacity)}%</div>
                        <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={opacity} 
                            onChange={(e) => handleOpacityChange(parseInt(e.target.value, 10))}
                            className="w-full" 
                        />
                    </div>
                </div>
            )}
        </div>
    ) : null;

    return (
        <>
            <div
                ref={triggerRef}
                onClick={handleToggle}
                className="w-8 h-7 p-0.5 border-2 border-gray-600 rounded cursor-pointer"
                style={{ backgroundColor: color }}
            />
            {portalContent && createPortal(portalContent, getPortalContainer())}
        </>
    );
};