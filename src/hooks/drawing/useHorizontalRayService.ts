import { useState, useCallback, useRef, useEffect } from 'react';
import { useTradingProStore, type DrawingPoint, type HorizontalRayDrawing, type Drawing } from '../../store/store';
import type { IChartApi, ISeriesApi, UTCTimestamp, MouseEventParams, Time, CandlestickData, WhitespaceData } from 'lightweight-charts';

export type InProgressHorizontalRay = {
    type: 'horizontalRay';
    time: UTCTimestamp;
    price: number;
};

type HorizontalRayState =
    | { type: 'IDLE' }
    | { type: 'SELECTED', drawingId: string }
    | {
        type: 'DRAGGING',
        drawingId: string,
        startTime: UTCTimestamp,
        startPrice: number,
        startMousePos: { time: UTCTimestamp, price: number },
        dragMode: 'ENTIRE_RAY'
      };

// FIX: The hover check now uses the snapping function to align with the visual rendering.
const checkHorizontalRayHover = (
    param: MouseEventParams,
    drawing: Drawing,
    chart: IChartApi,
    series: ISeriesApi<'Candlestick', Time>,
    findClosestDataPointTime: (time: UTCTimestamp) => UTCTimestamp | null
): { id: string, pointIndex: number | null } | null => {
    if (drawing.type !== 'horizontalRay' || !param.point) return null;

    const timeScale = chart.timeScale();
    
    // Step A: Snap the true time to get its visual location.
    const snappedTime = findClosestDataPointTime(drawing.time);
    if (!snappedTime) return null;

    // Step B: Convert the visual (snapped) coordinates to pixels for the check.
    const startX = timeScale.timeToCoordinate(snappedTime);
    const rayY = series.priceToCoordinate(drawing.price);
    
    if (startX === null || rayY === null) return null;

    const distToStartPoint = Math.hypot(param.point.x - startX, param.point.y - rayY);
    if (distToStartPoint < 12) return { id: drawing.id, pointIndex: 0 };

    const isToTheRight = param.point.x >= startX;
    const distanceToRay = Math.abs(param.point.y - rayY);
    
    if (isToTheRight && distanceToRay < 6) {
        return { id: drawing.id, pointIndex: null };
    }

    return null;
};

export const useHorizontalRayService = () => {
    const {
        drawings,
        activeDrawingTool,
        addDrawing,
        updateDrawing,
        removeDrawing,
        setActiveDrawingTool,
        setSelectedDrawingId,
        selectedDrawingId,
        drawingDefaults,
    } = useTradingProStore();

    const [horizontalRayState, setHorizontalRayState] = useState<HorizontalRayState>({ type: 'IDLE' });
    const [hoveredHorizontalRay, setHoveredHorizontalRay] = useState<{ id: string, pointIndex: number | null } | null>(null);
    const [currentMousePoint, setCurrentMousePoint] = useState<DrawingPoint | null>(null);
    
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Candlestick', Time> | null>(null);
    const findClosestDataPointTimeRef = useRef<((time: UTCTimestamp) => UTCTimestamp | null) | null>(null);
    
    const mouseStateRef = useRef({
        isDown: false,
        startedDrag: false,
        lastClickTime: 0,
        mouseDownPos: null as { x: number, y: number } | null,
    });

    useEffect(() => {
        const isSelected = selectedDrawingId && drawings.some(d => d.id === selectedDrawingId && d.type === 'horizontalRay');
        if (isSelected) {
            if (horizontalRayState.type !== 'SELECTED' && horizontalRayState.type !== 'DRAGGING') {
                setHorizontalRayState({ type: 'SELECTED', drawingId: selectedDrawingId! });
            }
        } else {
            if (horizontalRayState.type !== 'IDLE') {
                setHorizontalRayState({ type: 'IDLE' });
            }
        }
    }, [selectedDrawingId, drawings, horizontalRayState.type]);

    useEffect(() => {
        const handleMouseDown = (e: MouseEvent) => {
            mouseStateRef.current.isDown = true;
            mouseStateRef.current.startedDrag = false;
            mouseStateRef.current.mouseDownPos = { x: e.clientX, y: e.clientY };
        };
        
        const handleMouseUp = () => {
            mouseStateRef.current.isDown = false;
            
            setHorizontalRayState(prevState => {
                if (prevState.type === 'DRAGGING') {
                    chartRef.current?.applyOptions({ handleScroll: true, handleScale: true });
                    setSelectedDrawingId(prevState.drawingId);
                    return { type: 'SELECTED', drawingId: prevState.drawingId };
                }
                return prevState;
            });
        };
        
        document.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mouseup', handleMouseUp);
        
        return () => {
            document.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [setSelectedDrawingId]);

    // FIX: Accept and store the snapping function.
    const init = useCallback((chart: IChartApi, series: ISeriesApi<'Candlestick', Time>, findClosestDataPointTime: (time: UTCTimestamp) => UTCTimestamp | null) => {
        chartRef.current = chart;
        seriesRef.current = series;
        findClosestDataPointTimeRef.current = findClosestDataPointTime;
    }, []);

    const getLogicalCoordinates = useCallback((param: MouseEventParams): DrawingPoint | null => {
        const series = seriesRef.current;
        if (!series || !param.point || !param.time) return null;
        
        const price = series.coordinateToPrice(param.point.y);
        if (price === null) return null;
        
        return { time: param.time as UTCTimestamp, price };
    }, []);

    const findHorizontalRayUnderCursor = useCallback((param: MouseEventParams): { id: string, pointIndex: number | null } | null => {
        const chart = chartRef.current;
        const series = seriesRef.current;
        const findClosest = findClosestDataPointTimeRef.current;
        if (!chart || !series || !findClosest) return null;

        for (const drawing of drawings) {
            if (drawing.type === 'horizontalRay') {
                const hoverResult = checkHorizontalRayHover(param, drawing, chart, series, findClosest);
                if (hoverResult) return hoverResult;
            }
        }
        return null;
    }, [drawings]);

    const handleHorizontalRayClick = useCallback((param: MouseEventParams) => {
        if (activeDrawingTool !== 'horizontalRay' as any) return false;

        const now = Date.now();
        
        if (
            mouseStateRef.current.startedDrag ||
            (now - mouseStateRef.current.lastClickTime < 150)
        ) {
            mouseStateRef.current.startedDrag = false;
            return true;
        }
        mouseStateRef.current.lastClickTime = now;
        mouseStateRef.current.startedDrag = false;
        
        const currentPoint = getLogicalCoordinates(param);
        if (!currentPoint) return true;

        const defaults = drawingDefaults.horizontalRay;
        const finalDrawing: HorizontalRayDrawing = {
            id: `horizontalRay_${Date.now()}`,
            type: 'horizontalRay',
            time: currentPoint.time,
            price: currentPoint.price,
            color: defaults.color!,
            width: defaults.width!,
            lineStyle: defaults.lineStyle,
            points: [currentPoint, { time: currentPoint.time, price: currentPoint.price }],
        };
        
        addDrawing(finalDrawing);
        setHorizontalRayState({ type: 'SELECTED', drawingId: finalDrawing.id });
        setSelectedDrawingId(finalDrawing.id);
        setHoveredHorizontalRay({ id: finalDrawing.id, pointIndex: null });
        setActiveDrawingTool(null);
        
        return true;
    }, [activeDrawingTool, getLogicalCoordinates, addDrawing, setActiveDrawingTool, setSelectedDrawingId, drawingDefaults]);

    const handleHorizontalRaySelection = useCallback((param: MouseEventParams) => {
        if (activeDrawingTool !== null) return false;

        const horizontalRayUnderCursor = findHorizontalRayUnderCursor(param);
        
        if (horizontalRayState.type === 'SELECTED') {
            if (!horizontalRayUnderCursor || horizontalRayUnderCursor.id !== horizontalRayState.drawingId) {
                setSelectedDrawingId(null);
                setHorizontalRayState({ type: 'IDLE' });
            }
            return true;
        }
        
        if (horizontalRayUnderCursor) {
            setSelectedDrawingId(horizontalRayUnderCursor.id);
            setHorizontalRayState({ type: 'SELECTED', drawingId: horizontalRayUnderCursor.id });
            return true;
        }

        return false;
    }, [horizontalRayState, activeDrawingTool, findHorizontalRayUnderCursor, setSelectedDrawingId]);

    const handleHorizontalRayMouseMove = useCallback((param: MouseEventParams) => {
        const currentPoint = getLogicalCoordinates(param);
        const chart = chartRef.current;
        if (!chart || !currentPoint || !param.point) return false;

        setCurrentMousePoint(currentPoint);

        const isMouseDown = mouseStateRef.current.isDown;
        
        if (isMouseDown && !mouseStateRef.current.startedDrag) {
            const downPos = mouseStateRef.current.mouseDownPos;
            const distance = downPos ? Math.hypot(param.point.x - downPos.x, param.point.y - downPos.y) : 0;
            if (distance > 5) {
                mouseStateRef.current.startedDrag = true;
            }
        }

        if (isMouseDown && mouseStateRef.current.startedDrag) {
            if (horizontalRayState.type === 'IDLE' || horizontalRayState.type === 'SELECTED') {
                const target = findHorizontalRayUnderCursor(param);
                const targetDrawing = target ? drawings.find(d => d.id === target.id) as HorizontalRayDrawing : null;

                if (target && targetDrawing) {
                    setHorizontalRayState({
                        type: 'DRAGGING',
                        drawingId: target.id,
                        startTime: targetDrawing.time,
                        startPrice: targetDrawing.price,
                        startMousePos: currentPoint,
                        dragMode: 'ENTIRE_RAY'
                    });
                    setSelectedDrawingId(target.id);
                    chart.applyOptions({ handleScroll: false, handleScale: false });
                    return true;
                }
            } else if (horizontalRayState.type === 'DRAGGING') {
                const timeOffset = (horizontalRayState.startMousePos.time as number) - (horizontalRayState.startTime as number);
                const priceOffset = horizontalRayState.startMousePos.price - horizontalRayState.startPrice;

                const newTime = (currentPoint.time as number) - timeOffset;
                const newPrice = currentPoint.price - priceOffset;
                
                updateDrawing(horizontalRayState.drawingId, { 
                    time: newTime as UTCTimestamp, 
                    price: newPrice 
                } as Partial<HorizontalRayDrawing>);
                
                return true;
            }
        } else {
            if (horizontalRayState.type !== 'DRAGGING') {
                const horizontalRayUnderCursor = findHorizontalRayUnderCursor(param);
                setHoveredHorizontalRay(horizontalRayUnderCursor);
            }
        }

        return false;
    }, [horizontalRayState, activeDrawingTool, getLogicalCoordinates, findHorizontalRayUnderCursor, drawings, updateDrawing, setSelectedDrawingId]);

    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        switch (event.key) {
            case 'Delete':
                if (horizontalRayState.type === 'SELECTED') {
                    removeDrawing(horizontalRayState.drawingId);
                    setHorizontalRayState({ type: 'IDLE' });
                    setHoveredHorizontalRay(null);
                    setSelectedDrawingId(null);
                    return true;
                }
                break;
            case 'Escape':
                if (horizontalRayState.type === 'SELECTED' || horizontalRayState.type === 'DRAGGING') {
                    if (horizontalRayState.type === 'DRAGGING') {
                         updateDrawing(horizontalRayState.drawingId, { 
                             time: horizontalRayState.startTime, 
                             price: horizontalRayState.startPrice 
                         } as Partial<HorizontalRayDrawing>);
                         chartRef.current?.applyOptions({ handleScroll: true, handleScale: true });
                    }
                    setHorizontalRayState({ type: 'IDLE' });
                    setHoveredHorizontalRay(null);
                    setSelectedDrawingId(null);
                    return true;
                }
                break;
        }
        return false;
    }, [horizontalRayState, removeDrawing, updateDrawing, setSelectedDrawingId]);

    const handleMouseUp = useCallback(() => {
        setHorizontalRayState(prevState => {
            if (prevState.type === 'DRAGGING') {
                chartRef.current?.applyOptions({ handleScroll: true, handleScale: true });
                setSelectedDrawingId(prevState.drawingId);
                return { type: 'SELECTED', drawingId: prevState.drawingId };
            }
            return prevState;
        });
    }, [setSelectedDrawingId]);

    const inProgressHorizontalRay: InProgressHorizontalRay | null =
        (activeDrawingTool as any) === 'horizontalRay' && currentMousePoint
            ? { type: 'horizontalRay', time: currentMousePoint.time, price: currentMousePoint.price }
            : null;

    const finalHoveredHorizontalRay = horizontalRayState.type === 'SELECTED' || horizontalRayState.type === 'DRAGGING'
        ? { id: horizontalRayState.drawingId, pointIndex: hoveredHorizontalRay?.pointIndex ?? null }
        : horizontalRayState.type === 'IDLE' ? hoveredHorizontalRay : null;

    return {
        init,
        handleHorizontalRayClick,
        handleHorizontalRaySelection,
        handleHorizontalRayMouseMove,
        handleKeyDown,
        handleMouseUp,
        inProgressHorizontalRay,
        hoveredHorizontalRay: finalHoveredHorizontalRay,
        isDragging: horizontalRayState.type === 'DRAGGING',
        isActive: (activeDrawingTool as any) === 'horizontalRay' || horizontalRayState.type !== 'IDLE',
    };
};
