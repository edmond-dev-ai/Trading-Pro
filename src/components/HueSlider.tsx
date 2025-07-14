import { useRef, useEffect, useCallback, useState } from 'react';

interface HueSliderProps {
    hue: number;
    onChange: (hue: number, isDragging: boolean) => void;
}

interface DragState {
    startY: number;
    startHue: number;
}

export const HueSlider: React.FC<HueSliderProps> = ({ hue, onChange }) => {
    const sliderRef = useRef<HTMLCanvasElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const dragStateRef = useRef<DragState | null>(null);

    const drawSlider = useCallback(() => {
        const canvas = sliderRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const { width, height } = canvas;

        // Draw from bottom to top for correct hue orientation
        const gradient = ctx.createLinearGradient(0, height, 0, 0);
        for (let i = 0; i <= 360; i += 30) {
            gradient.addColorStop(i / 360, `hsl(${i}, 100%, 50%)`);
        }
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }, []);

    const updateHue = useCallback((clientY: number, isDragging: boolean) => {
        const canvas = sliderRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const y = Math.max(0, Math.min(clientY - rect.top, rect.height));
        // Invert the hue calculation to match the gradient
        const newHue = 360 - (y / rect.height) * 360;
        onChange(newHue, isDragging);
    }, [onChange]);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        dragStateRef.current = {
            startY: e.clientY,
            startHue: hue
        };
        setIsDragging(true);
        updateHue(e.clientY, true);
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging) return;
        e.preventDefault();
        e.stopPropagation();
        updateHue(e.clientY, true);
    }, [isDragging, updateHue]);

    const handleMouseUp = useCallback((e: MouseEvent) => {
        e.stopPropagation();
        setIsDragging(false);
        dragStateRef.current = null;
        updateHue(e.clientY, false);
    }, [updateHue]);

    useEffect(() => {
        drawSlider();
    }, [drawSlider]);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove, { capture: true });
            window.addEventListener('mouseup', handleMouseUp, { capture: true });
            document.body.style.userSelect = 'none';
        } else {
            window.removeEventListener('mousemove', handleMouseMove, { capture: true });
            window.removeEventListener('mouseup', handleMouseUp, { capture: true });
            document.body.style.userSelect = '';
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove, { capture: true });
            window.removeEventListener('mouseup', handleMouseUp, { capture: true });
            document.body.style.userSelect = '';
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    return (
        <div 
            className="relative ml-2" 
            onMouseDown={(e) => e.stopPropagation()}
        >
            <canvas 
                ref={sliderRef} 
                width={18} 
                height={100} 
                className="cursor-pointer rounded"
                onMouseDown={handleMouseDown}
            />
            <div 
                className="absolute w-6 h-1 bg-white pointer-events-none -translate-x-1/2 -translate-y-1/2"
                style={{ 
                    left: '50%',
                    // Invert the position calculation to match the inverted hue
                    top: `${100 - (hue / 360) * 100}%`,
                    boxShadow: '0 0 0 1.5px rgba(0,0,0,0.5)'
                }} 
            />
        </div>
    );
};