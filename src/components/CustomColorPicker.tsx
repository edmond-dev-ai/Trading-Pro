import { useState, useRef, useEffect, useCallback } from 'react';
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
    ['#f44336', '#ff9800', '#ffeb3b', '#4caf50', '#2196f3', '#3f51b5', '#9c27b0', '#e91e63', '#795548', '#607d8b'],
];

// Global storage for custom colors
let globalCustomColors: string[] = [];

export const CustomColorPicker = ({ color, onChange }: CustomColorPickerProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [showCustomPicker, setShowCustomPicker] = useState(false);
    const [customColors, setCustomColors] = useState<string[]>([]);
    
    const [hue, setHue] = useState(0);
    const [saturation, setSaturation] = useState(100);
    const [lightness, setLightness] = useState(50);
    const [opacity, setOpacity] = useState(100);

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
        // Reset the flag after a short delay to allow the parent to update
        setTimeout(() => {
            isInternalUpdate.current = false;
        }, 0);
    }, [onChange]);

    const handleCanvasChange = useCallback((newSaturation: number, newLightness: number, isDragging: boolean) => {
        isDraggingCanvas.current = isDragging;
        
        setSaturation(newSaturation);
        setLightness(newLightness);
        
        // Always update the color when canvas changes
        updateColorFromHsl(hue, newSaturation, newLightness, opacity / 100);
    }, [hue, opacity, updateColorFromHsl]);

    const handleHueChange = useCallback((newHue: number, isDragging: boolean) => {
        isDraggingHue.current = isDragging;
        
        setHue(newHue);
        
        // Always update the color when hue changes
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
        }
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                handleClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleToggle = () => setIsOpen(!isOpen);
    const handleClose = useCallback(() => {
        setIsOpen(false);
        setShowCustomPicker(false);
    }, []);

    const currentColorWithOpacity = opacity === 100 
        ? hslToHex(hue, saturation, lightness) 
        : `rgba(${Object.values(hexToRgba(hslToHex(hue, saturation, lightness))).slice(0, 3).join(', ')}, ${opacity / 100})`;

    return (
        <div className="relative" ref={pickerRef}>
            <div
                onClick={handleToggle}
                className="w-8 h-7 p-0.5 border-2 border-gray-600 rounded cursor-pointer"
                style={{ backgroundColor: color }}
            />
            {isOpen && (
                <div className="absolute z-50 top-full mt-2 right-0 bg-gray-800 rounded-lg shadow-xl border border-gray-700 p-3 w-60">
                    {showCustomPicker ? (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div 
                                    className="w-8 h-8 rounded border-2 border-gray-600" 
                                    style={{ backgroundColor: currentColorWithOpacity }}
                                />
                                <input
                                    type="text"
                                    value={currentColorWithOpacity}
                                    readOnly
                                    className="w-28 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-center text-white text-sm"
                                />
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
                    ) : (
                        <div className="space-y-3">
                            <div className="grid grid-cols-10 gap-1">
                                {defaultColors.flat().map((c) => (
                                    <div 
                                        key={c} 
                                        onClick={() => handleColorSelect(c)} 
                                        className="w-5 h-5 rounded-full cursor-pointer border border-gray-700" 
                                        style={{ backgroundColor: c }} 
                                    />
                                ))}
                            </div>
                            <div className="flex flex-wrap items-center gap-1 border-t border-gray-700 pt-2">
                                {customColors.map((c) => (
                                    <div 
                                        key={c} 
                                        onClick={() => handleColorSelect(c)} 
                                        className="w-5 h-5 rounded-full cursor-pointer border border-gray-700" 
                                        style={{ backgroundColor: c }} 
                                    />
                                ))}
                                <button 
                                    onClick={() => setShowCustomPicker(true)} 
                                    className="w-5 h-5 rounded-full flex items-center justify-center bg-gray-700 hover:bg-gray-600"
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
            )}
        </div>
    );
};