import { useRef, useEffect, useCallback, useState } from 'react';

interface ColorCanvasProps {
    hue: number;
    saturation: number;
    lightness: number;
    onChange: (saturation: number, lightness: number, isDragging: boolean) => void;
}

interface DragState {
    startX: number;
    startY: number;
    startSaturation: number;
    startLightness: number;
}

export const ColorCanvas: React.FC<ColorCanvasProps> = ({ hue, saturation, lightness, onChange }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const dragStateRef = useRef<DragState | null>(null);

    const drawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const { width, height } = canvas;

        ctx.clearRect(0, 0, width, height);
        
        // Base hue color
        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        ctx.fillRect(0, 0, width, height);

        // White gradient
        const whiteGradient = ctx.createLinearGradient(0, 0, width, 0);
        whiteGradient.addColorStop(0, 'rgba(255,255,255,1)');
        whiteGradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = whiteGradient;
        ctx.fillRect(0, 0, width, height);

        // Black gradient
        const blackGradient = ctx.createLinearGradient(0, 0, 0, height);
        blackGradient.addColorStop(0, 'rgba(0,0,0,0)');
        blackGradient.addColorStop(1, 'rgba(0,0,0,1)');
        ctx.fillStyle = blackGradient;
        ctx.fillRect(0, 0, width, height);
    }, [hue]);

    const updateColor = useCallback((clientX: number, clientY: number, isDragging: boolean) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
        const y = Math.max(0, Math.min(clientY - rect.top, rect.height));

        const newSaturation = (x / rect.width) * 100;
        const newLightness = 100 - (y / rect.height) * 100;

        onChange(newSaturation, newLightness, isDragging);
    }, [onChange]);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        dragStateRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startSaturation: saturation,
            startLightness: lightness
        };
        setIsDragging(true);
        updateColor(e.clientX, e.clientY, true);
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging) return;
        e.preventDefault();
        e.stopPropagation();
        updateColor(e.clientX, e.clientY, true);
    }, [isDragging, updateColor]);

    const handleMouseUp = useCallback((e: MouseEvent) => {
        e.stopPropagation();
        setIsDragging(false);
        dragStateRef.current = null;
        // Send final update with isDragging false
        const canvas = canvasRef.current;
        if (canvas) {
            const rect = canvas.getBoundingClientRect();
            const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
            const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
            const finalSaturation = (x / rect.width) * 100;
            const finalLightness = 100 - (y / rect.height) * 100;
            onChange(finalSaturation, finalLightness, false);
        }
    }, [onChange]);

    useEffect(() => {
        drawCanvas();
    }, [drawCanvas]);

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
        <div className="relative" onMouseDown={(e) => e.stopPropagation()}>
            <canvas 
                ref={canvasRef} 
                width={180} 
                height={100} 
                className="cursor-crosshair rounded"
                onMouseDown={handleMouseDown}
            />
            <div 
                className="absolute w-3 h-3 border-2 border-white rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2"
                style={{ 
                    left: `${saturation}%`, 
                    top: `${100 - lightness}%`,
                    boxShadow: '0 0 0 1.5px rgba(0,0,0,0.5)'
                }} 
            />
        </div>
    );
};