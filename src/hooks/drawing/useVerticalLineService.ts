import { useState, useCallback, useRef, useEffect } from 'react';
import { useTradingProStore, type DrawingPoint, type VerticalLineDrawing, type Drawing } from '../../store/store';
import type { IChartApi, ISeriesApi, UTCTimestamp, MouseEventParams, Time } from 'lightweight-charts';

export type InProgressVerticalLine = {
    type: 'vertical';
    time: UTCTimestamp;
};

type VerticalLineState =
    | { type: 'IDLE' }
    | { type: 'SELECTED', drawingId: string }
    | {
        type: 'DRAGGING',
        drawingId: string,
        startTime: UTCTimestamp,
        startMouseTime: UTCTimestamp
      };

// FIX: The hover check now uses the snapping function to align with the visual rendering.
const checkVerticalLineHover = (
    param: MouseEventParams,
    drawing: Drawing,
    chart: IChartApi,
    series: ISeriesApi<'Candlestick', Time>,
    findClosestDataPointTime: (time: UTCTimestamp) => UTCTimestamp | null
): { id: string, pointIndex: number | null } | null => {
    if (drawing.type !== 'vertical' || !param.point) return null;

    const timeScale = chart.timeScale();
    
    // Step A: Snap the true time to get its visual location.
    const snappedTime = findClosestDataPointTime(drawing.time);
    if (!snappedTime) return null;

    // Step B: Convert the visual time to a pixel coordinate for the check.
    const lineX = timeScale.timeToCoordinate(snappedTime);
    
    if (lineX === null) return null;

    const distanceToLine = Math.abs(param.point.x - lineX);
    if (distanceToLine < 6) {
        return { id: drawing.id, pointIndex: null };
    }

    return null;
};

export const useVerticalLineService = () => {
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

    const [verticalLineState, setVerticalLineState] = useState<VerticalLineState>({ type: 'IDLE' });
    const [hoveredVerticalLine, setHoveredVerticalLine] = useState<{ id: string, pointIndex: number | null } | null>(null);
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
        const isSelected = selectedDrawingId && drawings.some(d => d.id === selectedDrawingId && d.type === 'vertical');
        if (isSelected) {
            if (verticalLineState.type !== 'SELECTED' && verticalLineState.type !== 'DRAGGING') {
                setVerticalLineState({ type: 'SELECTED', drawingId: selectedDrawingId! });
            }
        } else {
            if (verticalLineState.type !== 'IDLE') {
                setVerticalLineState({ type: 'IDLE' });
            }
        }
    }, [selectedDrawingId, drawings, verticalLineState.type]);

    useEffect(() => {
        const handleMouseDown = (e: MouseEvent) => {
            mouseStateRef.current.isDown = true;
            mouseStateRef.current.startedDrag = false;
            mouseStateRef.current.mouseDownPos = { x: e.clientX, y: e.clientY };
        };
        
        const handleMouseUp = () => {
            mouseStateRef.current.isDown = false;
            
            setVerticalLineState(prevState => {
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

    const findVerticalLineUnderCursor = useCallback((param: MouseEventParams): { id: string, pointIndex: number | null } | null => {
        const chart = chartRef.current;
        const series = seriesRef.current;
        const findClosest = findClosestDataPointTimeRef.current;
        if (!chart || !series || !findClosest) return null;

        for (const drawing of drawings) {
            if (drawing.type === 'vertical') {
                const hoverResult = checkVerticalLineHover(param, drawing, chart, series, findClosest);
                if (hoverResult) return hoverResult;
            }
        }
        return null;
    }, [drawings]);

    const handleVerticalLineClick = useCallback((param: MouseEventParams) => {
        if (activeDrawingTool !== 'vertical') return false;

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

        const defaults = drawingDefaults.vertical;
        const finalDrawing: VerticalLineDrawing = {
            id: `vertical_${Date.now()}`,
            type: 'vertical',
            time: currentPoint.time,
            color: defaults.color!,
            width: defaults.width!,
            lineStyle: defaults.lineStyle,
        };
        
        addDrawing(finalDrawing);
        setVerticalLineState({ type: 'SELECTED', drawingId: finalDrawing.id });
        setSelectedDrawingId(finalDrawing.id);
        setHoveredVerticalLine({ id: finalDrawing.id, pointIndex: null });
        setActiveDrawingTool(null);
        
        return true;
    }, [activeDrawingTool, getLogicalCoordinates, addDrawing, setActiveDrawingTool, setSelectedDrawingId, drawingDefaults]);

    const handleVerticalLineSelection = useCallback((param: MouseEventParams) => {
        if (activeDrawingTool !== null) return false;

        const verticalLineUnderCursor = findVerticalLineUnderCursor(param);
        
        if (verticalLineState.type === 'SELECTED') {
            if (!verticalLineUnderCursor || verticalLineUnderCursor.id !== verticalLineState.drawingId) {
                setSelectedDrawingId(null);
                setVerticalLineState({ type: 'IDLE' });
            }
            return true;
        }
        
        if (verticalLineUnderCursor) {
            setSelectedDrawingId(verticalLineUnderCursor.id);
            setVerticalLineState({ type: 'SELECTED', drawingId: verticalLineUnderCursor.id });
            return true;
        }

        return false;
    }, [verticalLineState, activeDrawingTool, findVerticalLineUnderCursor, setSelectedDrawingId]);

    const handleVerticalLineMouseMove = useCallback((param: MouseEventParams) => {
        const currentPoint = getLogicalCoordinates(param);
        const chart = chartRef.current;
        const series = seriesRef.current;
        if (!chart || !series || !currentPoint || !param.point) return false;

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
            if (verticalLineState.type === 'IDLE' || verticalLineState.type === 'SELECTED') {
                const target = findVerticalLineUnderCursor(param);
                const targetDrawing = target ? drawings.find(d => d.id === target.id) : null;

                if (target && targetDrawing && targetDrawing.type === 'vertical') {
                    setVerticalLineState({
                        type: 'DRAGGING',
                        drawingId: target.id,
                        startTime: targetDrawing.time,
                        startMouseTime: currentPoint.time
                    });
                    setSelectedDrawingId(target.id);
                    chart.applyOptions({ handleScroll: false, handleScale: false });
                    return true;
                }
            } else if (verticalLineState.type === 'DRAGGING') {
                const timeDelta = (currentPoint.time as number) - (verticalLineState.startMouseTime as number);
                const newTime = (verticalLineState.startTime as number) + timeDelta as UTCTimestamp;
                
                updateDrawing(verticalLineState.drawingId, { time: newTime });
                return true;
            }
        } else {
            if (verticalLineState.type !== 'DRAGGING') {
                const verticalLineUnderCursor = findVerticalLineUnderCursor(param);
                setHoveredVerticalLine(verticalLineUnderCursor);
            }
        }

        return false;
    }, [verticalLineState, activeDrawingTool, getLogicalCoordinates, findVerticalLineUnderCursor, drawings, updateDrawing, setSelectedDrawingId]);

    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        switch (event.key) {
            case 'Delete':
                if (verticalLineState.type === 'SELECTED') {
                    removeDrawing(verticalLineState.drawingId);
                    setVerticalLineState({ type: 'IDLE' });
                    setHoveredVerticalLine(null);
                    setSelectedDrawingId(null);
                    return true;
                }
                break;
            case 'Escape':
                if (verticalLineState.type === 'SELECTED' || verticalLineState.type === 'DRAGGING') {
                    if (verticalLineState.type === 'DRAGGING') {
                         updateDrawing(verticalLineState.drawingId, { time: verticalLineState.startTime });
                         chartRef.current?.applyOptions({ handleScroll: true, handleScale: true });
                    }
                    setVerticalLineState({ type: 'IDLE' });
                    setHoveredVerticalLine(null);
                    setSelectedDrawingId(null);
                    return true;
                }
                break;
        }
        return false;
    }, [verticalLineState, removeDrawing, updateDrawing, setSelectedDrawingId]);

    const handleMouseUp = useCallback(() => {
        setVerticalLineState(prevState => {
            if (prevState.type === 'DRAGGING') {
                chartRef.current?.applyOptions({ handleScroll: true, handleScale: true });
                setSelectedDrawingId(prevState.drawingId);
                return { type: 'SELECTED', drawingId: prevState.drawingId };
            }
            return prevState;
        });
    }, [setSelectedDrawingId]);

    const inProgressVerticalLine: InProgressVerticalLine | null =
        activeDrawingTool === 'vertical' && currentMousePoint
            ? { type: 'vertical', time: currentMousePoint.time }
            : null;

    const finalHoveredVerticalLine = verticalLineState.type === 'SELECTED' || verticalLineState.type === 'DRAGGING'
        ? { id: verticalLineState.drawingId, pointIndex: null }
        : verticalLineState.type === 'IDLE' ? hoveredVerticalLine : null;

    return {
        init,
        handleVerticalLineClick,
        handleVerticalLineSelection,
        handleVerticalLineMouseMove,
        handleKeyDown,
        handleMouseUp,
        inProgressVerticalLine,
        hoveredVerticalLine: finalHoveredVerticalLine,
        isDragging: verticalLineState.type === 'DRAGGING',
        isActive: activeDrawingTool === 'vertical' || verticalLineState.type !== 'IDLE',
    };
};
