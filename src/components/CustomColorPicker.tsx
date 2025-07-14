import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';

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

    const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
    const [isDraggingHue, setIsDraggingHue] = useState(false);
    
    const pickerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const hueSliderRef = useRef<HTMLCanvasElement>(null);

    // --- Color Conversion Logic ---
    const hslToHex = (h: number, s: number, l: number) => {
        l /= 100;
        const a = s * Math.min(l, 1 - l) / 100;
        const f = (n: number) => {
            const k = (n + h / 30) % 12;
            const colorVal = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * colorVal).toString(16).padStart(2, '0');
        };
        return `#${f(0)}${f(8)}${f(4)}`;
    };

    const updateColorFromHsl = useCallback((h: number, s: number, l: number, a: number) => {
        const hex = hslToHex(h, s, l);
        if (a === 1) {
            onChange(hex);
        } else {
            const { r, g, b } = hexToRgba(hex);
            onChange(`rgba(${r}, ${g}, ${b}, ${a})`);
        }
    }, [onChange]);
    
    // --- Drawing Logic ---
    const drawColorCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const { width, height } = canvas;
        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        ctx.fillRect(0, 0, width, height);
        const whiteGradient = ctx.createLinearGradient(0, 0, width, 0);
        whiteGradient.addColorStop(0, 'rgba(255,255,255,1)');
        whiteGradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = whiteGradient;
        ctx.fillRect(0, 0, width, height);
        const blackGradient = ctx.createLinearGradient(0, 0, 0, height);
        blackGradient.addColorStop(0, 'rgba(0,0,0,0)');
        blackGradient.addColorStop(1, 'rgba(0,0,0,1)');
        ctx.fillStyle = blackGradient;
        ctx.fillRect(0, 0, width, height);
    }, [hue]);

    const drawHueSlider = useCallback(() => {
        const canvas = hueSliderRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const { width, height } = canvas;
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        for (let i = 0; i <= 360; i += 60) {
            gradient.addColorStop(i / 360, `hsl(${i}, 100%, 50%)`);
        }
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }, []);

    // --- Mouse Event Handlers ---
    const handleCanvasMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDraggingCanvas(true);
    };

    const handleHueMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDraggingHue(true);
    };

    // --- BUGFIX: Global Event Listener Effect for Dragging ---
    // This effect now correctly manages global event listeners to prevent the "snapping" bug.
    // It uses useCallback for the handlers to ensure stable function references.
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDraggingCanvas) {
                const canvas = canvasRef.current;
                if (!canvas) return;
                const rect = canvas.getBoundingClientRect();
                const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
                const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
                
                const newSaturation = (x / rect.width) * 100;
                const newLightness = 100 - (y / rect.height) * 100;
                
                setSaturation(newSaturation);
                setLightness(newLightness);
                updateColorFromHsl(hue, newSaturation, newLightness, opacity / 100);
            } else if (isDraggingHue) {
                const canvas = hueSliderRef.current;
                if (!canvas) return;
                const rect = canvas.getBoundingClientRect();
                const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
                
                const newHue = (y / rect.height) * 360;

                setHue(newHue);
                updateColorFromHsl(newHue, saturation, lightness, opacity / 100);
            }
        };

        const handleMouseUp = () => {
            setIsDraggingCanvas(false);
            setIsDraggingHue(false);
        };

        if (isDraggingCanvas || isDraggingHue) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.userSelect = 'none';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.userSelect = '';
        };
    }, [isDraggingCanvas, isDraggingHue, hue, saturation, lightness, opacity, updateColorFromHsl]);


    // --- Component Logic ---
    const handleToggle = () => setIsOpen(!isOpen);
    const handleClose = useCallback(() => {
        setIsOpen(false);
        setShowCustomPicker(false); // Also reset view on close
    }, []);

    const handleColorSelect = (selectedColor: string) => {
        onChange(selectedColor);
        // When a color is selected, update the internal HSL state to match
        const rgba = rgbaStringToObject(selectedColor);
        const { h, s, l } = rgbToHsl(rgba.r, rgba.g, rgba.b);
        setHue(h);
        setSaturation(s);
        setLightness(l);
        setOpacity(rgba.a * 100);
        handleClose();
    };
    
    const addCurrentCustomColor = () => {
        const newColor = currentColorWithOpacity; // Use the calculated current color
        if (!globalCustomColors.includes(newColor) && !defaultColors.flat().includes(newColor)) {
            globalCustomColors = [...globalCustomColors, newColor];
            setCustomColors(globalCustomColors);
        }
        setShowCustomPicker(false);
    };

    // --- BUGFIX: Opacity Handling ---
    // This function now consistently uses the component's internal HSL state
    // to calculate the new color, fixing the opacity bug.
    const handleOpacityChange = useCallback((newOpacity: number) => {
        setOpacity(newOpacity);
        updateColorFromHsl(hue, saturation, lightness, newOpacity / 100);
    }, [hue, saturation, lightness, updateColorFromHsl]);

    // Initialize HSL values from the current color prop when the picker opens
    useEffect(() => {
        if (isOpen) {
            const rgba = rgbaStringToObject(color);
            const { h, s, l } = rgbToHsl(rgba.r, rgba.g, rgba.b);
            setHue(h);
            setSaturation(s);
            setLightness(l);
            setOpacity(rgba.a * 100);
        }
    }, [isOpen, color]);

    // Sync local custom colors with global ones when picker opens
    useEffect(() => {
        if (isOpen) {
            setCustomColors([...globalCustomColors]);
        }
    }, [isOpen]);
    
    // Redraw canvases when necessary
    useEffect(() => {
        if (isOpen && showCustomPicker) {
            drawColorCanvas();
            drawHueSlider();
        }
    }, [isOpen, showCustomPicker, hue, drawColorCanvas, drawHueSlider]);

    // Handle clicking outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                handleClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [handleClose]);

    // Get current color with opacity for preview
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
                                <div className="w-8 h-8 rounded border-2 border-gray-600" style={{ backgroundColor: currentColorWithOpacity }}></div>
                                <input
                                    type="text"
                                    value={currentColorWithOpacity}
                                    readOnly
                                    className="w-28 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-center text-white text-sm"
                                />
                                <button onClick={addCurrentCustomColor} className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded text-sm font-semibold">Add</button>
                            </div>
                            <div className="flex gap-2">
                                <div className="relative" 
                                     onMouseDown={handleCanvasMouseDown}>
                                    <canvas ref={canvasRef} width={180} height={100} className="cursor-crosshair rounded" />
                                    <div className="absolute w-3 h-3 border-2 border-white rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2" 
                                         style={{ left: `${saturation}%`, top: `${100 - lightness}%`, boxShadow: '0 0 0 1.5px rgba(0,0,0,0.5)' }} />
                                </div>
                                <div className="relative" 
                                     onMouseDown={handleHueMouseDown}>
                                    <canvas ref={hueSliderRef} width={18} height={100} className="cursor-pointer rounded" />
                                    <div className="absolute w-6 h-1 bg-white pointer-events-none -translate-x-1/2 -translate-y-1/2" 
                                         style={{ left: '50%', top: `${(hue / 360) * 100}%`, boxShadow: '0 0 0 1.5px rgba(0,0,0,0.5)' }} />
                                </div>
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
                                    <div key={c} onClick={() => handleColorSelect(c)} className="w-5 h-5 rounded-full cursor-pointer border border-gray-700" style={{ backgroundColor: c }} />
                                ))}
                            </div>
                            <div className="flex flex-wrap items-center gap-1 border-t border-gray-700 pt-2">
                                {customColors.map((c) => (
                                    <div key={c} onClick={() => handleColorSelect(c)} className="w-5 h-5 rounded-full cursor-pointer border border-gray-700" style={{ backgroundColor: c }} />
                                ))}
                                <button onClick={() => setShowCustomPicker(true)} className="w-5 h-5 rounded-full flex items-center justify-center bg-gray-700 hover:bg-gray-600">
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
