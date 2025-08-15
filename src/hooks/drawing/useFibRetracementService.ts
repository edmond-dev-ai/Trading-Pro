import { useState, useCallback, useRef, useEffect } from 'react';
import { useTradingProStore, type DrawingPoint, type FibRetracementDrawing, type Drawing } from '../../store/store';
import type { IChartApi, ISeriesApi, UTCTimestamp, MouseEventParams, Time, Coordinate } from 'lightweight-charts';

export type InProgressFibRetracement = {
    type: 'fib-retracement';
    points: [DrawingPoint, DrawingPoint];
};

const FIB_LEVELS = [
    { value: 0, label: '0%', color: '#688ee7', lineStyle: 'Solid' as const },
    { value: 0.236, label: '23.6%', color: '#7a96e8', lineStyle: 'Dotted' as const },
    { value: 0.382, label: '38.2%', color: '#8cbfe9', lineStyle: 'Dotted' as const },
    { value: 0.5, label: '50%', color: '#9ed8ea', lineStyle: 'Dotted' as const },
    { value: 0.618, label: '61.8%', color: '#b0e1eb', lineStyle: 'Dotted' as const },
    { value: 0.786, label: '78.6%', color: '#c2ebec', lineStyle: 'Dotted' as const },
    { value: 1, label: '100%', color: '#d4f4ed', lineStyle: 'Solid' as const },
];

type FibRetracementState =
    | { type: 'IDLE' }
    | { type: 'DRAWING', firstPoint: DrawingPoint }
    | { type: 'SELECTED', drawingId: string }
    | {
        type: 'DRAGGING',
        drawingId: string,
        startPoints: [DrawingPoint, DrawingPoint],
        startMousePixels: { x: number, y: number },
        startPointsPixels: { p1: { x: number, y: number }, p2: { x: number, y: number } },
        dragMode: 'ENTIRE_FIB' | 'POINT_0' | 'POINT_1'
      };

const checkFibRetracementHover = (
    param: MouseEventParams,
    drawing: Drawing,
    chart: IChartApi,
    series: ISeriesApi<'Candlestick', Time>,
    findClosestDataPointTime: (time: UTCTimestamp) => UTCTimestamp | null
): { id: string, pointIndex: number | null } | null => {
    if (drawing.type !== 'fib-retracement' || !param.point) return null;

    const timeScale = chart.timeScale();
    
    const snappedP1Time = findClosestDataPointTime(drawing.points[0].time);
    const snappedP2Time = findClosestDataPointTime(drawing.points[1].time);

    if (!snappedP1Time || !snappedP2Time) return null;

    const p1 = { ...drawing.points[0], time: snappedP1Time };
    const p2 = { ...drawing.points[1], time: snappedP2Time };

    const p1Coord = { x: timeScale.timeToCoordinate(p1.time), y: series.priceToCoordinate(p1.price) };
    const p2Coord = { x: timeScale.timeToCoordinate(p2.time), y: series.priceToCoordinate(p2.price) };

    if (p1Coord.x === null || p1Coord.y === null || p2Coord.x === null || p2Coord.y === null) return null;

    const distToP1 = Math.hypot(param.point.x - p1Coord.x, param.point.y - p1Coord.y);
    if (distToP1 < 12) return { id: drawing.id, pointIndex: 0 };

    const distToP2 = Math.hypot(param.point.x - p2Coord.x, param.point.y - p2Coord.y);
    if (distToP2 < 12) return { id: drawing.id, pointIndex: 1 };

    const lineLengthSq = (p2Coord.x - p1Coord.x) ** 2 + (p2Coord.y - p1Coord.y) ** 2;
    if (lineLengthSq === 0) return null;

    const t = ((param.point.x - p1Coord.x) * (p2Coord.x - p1Coord.x) + (param.point.y - p1Coord.y) * (p2Coord.y - p1Coord.y)) / lineLengthSq;
    const projectionX = p1Coord.x + t * (p2Coord.x - p1Coord.x);
    const projectionY = p1Coord.y + t * (p2Coord.y - p1Coord.y);

    const distToLine = Math.hypot(param.point.x - projectionX, param.point.y - projectionY);

    const isWithinSegment = t >= 0 && t <= 1;

    if (distToLine < 6 && isWithinSegment) return { id: drawing.id, pointIndex: null };

    const priceRange = p1.price - p2.price;
    for (const level of FIB_LEVELS) {
        const levelPrice = p1.price - (priceRange * level.value);
        const levelY = series.priceToCoordinate(levelPrice);
        
        if (levelY === null) continue;

        const isWithinFibXRange = param.point.x >= Math.min(p1Coord.x, p2Coord.x) - 5 &&
                                  param.point.x <= Math.max(p1Coord.x, p2Coord.x) + 5; 

        const distanceToLevel = Math.abs(param.point.y - levelY);
        if (distanceToLevel < 6 && isWithinFibXRange) {
            return { id: drawing.id, pointIndex: null };
        }
    }

    return null;
};

export const useFibRetracementService = () => {
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
        timeframe,
    } = useTradingProStore();

    const [fibRetracementState, setFibRetracementState] = useState<FibRetracementState>({ type: 'IDLE' });
    const [hoveredFibRetracement, setHoveredFibRetracement] = useState<{ id: string, pointIndex: number | null } | null>(null);
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
        const isSelected = selectedDrawingId && drawings.some(d => d.id === selectedDrawingId && d.type === 'fib-retracement');
        if (isSelected) {
            if (fibRetracementState.type !== 'SELECTED' && fibRetracementState.type !== 'DRAGGING') {
                setFibRetracementState({ type: 'SELECTED', drawingId: selectedDrawingId! });
            }
        } else {
            if (fibRetracementState.type !== 'IDLE' && fibRetracementState.type !== 'DRAWING') {
                setFibRetracementState({ type: 'IDLE' });
            }
        }
    }, [selectedDrawingId, drawings, fibRetracementState.type]);

    useEffect(() => {
        const handleMouseDown = (e: MouseEvent) => {
            mouseStateRef.current.isDown = true;
            mouseStateRef.current.startedDrag = false;
            mouseStateRef.current.mouseDownPos = { x: e.clientX, y: e.clientY };
        };
        
        const handleMouseUp = () => {
            mouseStateRef.current.isDown = false;
            
            setFibRetracementState(prevState => {
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

    useEffect(() => {
        if (fibRetracementState.type === 'DRAGGING') {
            setFibRetracementState({ type: 'SELECTED', drawingId: fibRetracementState.drawingId });
            chartRef.current?.applyOptions({ handleScroll: true, handleScale: true });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timeframe]);

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

    const findFibRetracementUnderCursor = useCallback((param: MouseEventParams): { id: string, pointIndex: number | null } | null => {
        const chart = chartRef.current;
        const series = seriesRef.current;
        const findClosest = findClosestDataPointTimeRef.current;
        if (!chart || !series || !findClosest) return null;

        for (const drawing of drawings) {
            if (drawing.type === 'fib-retracement') {
                const hoverResult = checkFibRetracementHover(param, drawing, chart, series, findClosest);
                if (hoverResult) return hoverResult;
            }
        }
        return null;
    }, [drawings]);

    const handleFibRetracementClick = useCallback((param: MouseEventParams) => {
        if (activeDrawingTool !== 'fib-retracement') return false;

        const now = Date.now();
        
        if (
            (mouseStateRef.current.startedDrag && fibRetracementState.type !== 'DRAWING') ||
            (now - mouseStateRef.current.lastClickTime < 150)
        ) {
            mouseStateRef.current.startedDrag = false;
            return true;
        }
        mouseStateRef.current.lastClickTime = now;
        mouseStateRef.current.startedDrag = false;
        
        const currentPoint = getLogicalCoordinates(param);
        if (!currentPoint) return true;

        if (fibRetracementState.type === 'IDLE') {
            setFibRetracementState({ type: 'DRAWING', firstPoint: currentPoint });
            chartRef.current?.applyOptions({ handleScroll: false, handleScale: false });
            return true;
        }
        
        if (fibRetracementState.type === 'DRAWING') {
             if (currentPoint.time !== fibRetracementState.firstPoint.time ||
                 currentPoint.price !== fibRetracementState.firstPoint.price) {
                const defaults = drawingDefaults['fib-retracement'];
                const finalDrawing: FibRetracementDrawing = {
                    id: `fib_${Date.now()}`,
                    type: 'fib-retracement',
                    points: [fibRetracementState.firstPoint, currentPoint],
                    color: defaults.color,
                    width: defaults.width,
                    lineStyle: defaults.lineStyle,
                    showLabels: true,
                    levels: FIB_LEVELS,
                };
                addDrawing(finalDrawing);
                setFibRetracementState({ type: 'SELECTED', drawingId: finalDrawing.id });
                setSelectedDrawingId(finalDrawing.id);
                setHoveredFibRetracement({ id: finalDrawing.id, pointIndex: null });
            } else {
                setFibRetracementState({ type: 'IDLE' });
            }
            setActiveDrawingTool(null);
            chartRef.current?.applyOptions({ handleScroll: true, handleScale: true });
            return true;
        }

        return false;
    }, [fibRetracementState, activeDrawingTool, getLogicalCoordinates, addDrawing, setActiveDrawingTool, setSelectedDrawingId, drawingDefaults]);

    const handleFibRetracementSelection = useCallback((param: MouseEventParams) => {
        if (activeDrawingTool !== null) return false;

        const fibRetracementUnderCursor = findFibRetracementUnderCursor(param);
        
        if (fibRetracementState.type === 'SELECTED') {
            if (!fibRetracementUnderCursor || fibRetracementUnderCursor.id !== fibRetracementState.drawingId) {
                setSelectedDrawingId(null);
                setFibRetracementState({ type: 'IDLE' });
            }
            return true;
        }
        
        if (fibRetracementUnderCursor) {
            setSelectedDrawingId(fibRetracementUnderCursor.id);
            setFibRetracementState({ type: 'SELECTED', drawingId: fibRetracementUnderCursor.id });
            return true;
        }

        return false;
    }, [fibRetracementState, activeDrawingTool, findFibRetracementUnderCursor, setSelectedDrawingId]);

    const handleFibRetracementMouseMove = useCallback((param: MouseEventParams) => {
        const chart = chartRef.current;
        const series = seriesRef.current;
        const findClosest = findClosestDataPointTimeRef.current;
        if (!chart || !series || !findClosest || !param.point || !param.sourceEvent) return false;

        const currentPoint = getLogicalCoordinates(param);
        if (!currentPoint) return false;

        setCurrentMousePoint(currentPoint);

        const isMouseDown = mouseStateRef.current.isDown;
        
        if (isMouseDown && !mouseStateRef.current.startedDrag) {
            const downPos = mouseStateRef.current.mouseDownPos;
            const distance = downPos ? Math.hypot(param.point.x - downPos.x, param.point.y - downPos.y) : 0;
            if (distance > 5) {
                mouseStateRef.current.startedDrag = true;
            }
        }

        if (isMouseDown && activeDrawingTool === 'fib-retracement' && fibRetracementState.type === 'IDLE') {
             setFibRetracementState({ type: 'DRAWING', firstPoint: currentPoint });
             chart.applyOptions({ handleScroll: false, handleScale: false });
             return true;
        }

        if (isMouseDown && mouseStateRef.current.startedDrag) {
             if (fibRetracementState.type === 'IDLE' || fibRetracementState.type === 'SELECTED') {
                const target = findFibRetracementUnderCursor(param);
                const targetDrawing = target ? drawings.find(d => d.id === target.id) as FibRetracementDrawing : null;

                if (target && targetDrawing) {
                    let dragMode: 'ENTIRE_FIB' | 'POINT_0' | 'POINT_1' = 'ENTIRE_FIB';
                    if (target.pointIndex === 0) dragMode = 'POINT_0';
                    else if (target.pointIndex === 1) dragMode = 'POINT_1';
                    
                    if (dragMode === 'ENTIRE_FIB') {
                        const snappedP1Time = findClosest(targetDrawing.points[0].time);
                        const snappedP2Time = findClosest(targetDrawing.points[1].time);

                        if (snappedP1Time === null || snappedP2Time === null) {
                            return true; 
                        }

                        const snappedPoints: [DrawingPoint, DrawingPoint] = [
                            { ...targetDrawing.points[0], time: snappedP1Time },
                            { ...targetDrawing.points[1], time: snappedP2Time },
                        ];
                        
                        updateDrawing(targetDrawing.id, { points: snappedPoints });

                        const p1_coord = {
                            x: chart.timeScale().timeToCoordinate(snappedPoints[0].time),
                            y: series.priceToCoordinate(snappedPoints[0].price)
                        };
                        const p2_coord = {
                            x: chart.timeScale().timeToCoordinate(snappedPoints[1].time),
                            y: series.priceToCoordinate(snappedPoints[1].price)
                        };

                        if (p1_coord.x === null || p1_coord.y === null || p2_coord.x === null || p2_coord.y === null) {
                            return true;
                        }

                        setFibRetracementState({
                            type: 'DRAGGING',
                            drawingId: target.id,
                            startPoints: snappedPoints,
                            startMousePixels: { x: param.point.x, y: param.point.y },
                            startPointsPixels: { 
                                p1: p1_coord as { x: number; y: number; }, 
                                p2: p2_coord as { x: number; y: number; } 
                            },
                            dragMode
                        });

                    } else { // Handle point resize
                        setFibRetracementState({
                            type: 'DRAGGING',
                            drawingId: target.id,
                            startPoints: targetDrawing.points,
                            startMousePixels: { x: param.point.x, y: param.point.y },
                            startPointsPixels: { p1: {x:0, y:0}, p2: {x:0, y:0}}, // Not used for resize
                            dragMode
                        });
                    }
                    setSelectedDrawingId(target.id);
                    chart.applyOptions({ handleScroll: false, handleScale: false });
                    return true;
                }
            } else if (fibRetracementState.type === 'DRAGGING') {
                let newPoints: [DrawingPoint, DrawingPoint];
                
                if (fibRetracementState.dragMode === 'ENTIRE_FIB') {
                    const pixelDeltaX = param.point.x - fibRetracementState.startMousePixels.x;
                    const pixelDeltaY = param.point.y - fibRetracementState.startMousePixels.y;
                    
                    const newP1Pixel = {
                        x: fibRetracementState.startPointsPixels.p1.x + pixelDeltaX,
                        y: fibRetracementState.startPointsPixels.p1.y + pixelDeltaY
                    };
                    const newP2Pixel = {
                        x: fibRetracementState.startPointsPixels.p2.x + pixelDeltaX,
                        y: fibRetracementState.startPointsPixels.p2.y + pixelDeltaY
                    };
                    
                    const newP1Time = chart.timeScale().coordinateToTime(newP1Pixel.x);
                    const newP1Price = series.coordinateToPrice(newP1Pixel.y);
                    const newP2Time = chart.timeScale().coordinateToTime(newP2Pixel.x);
                    const newP2Price = series.coordinateToPrice(newP2Pixel.y);
                    
                    if (newP1Time === null || newP1Price === null || newP2Time === null || newP2Price === null) {
                        return true;
                    }
                    
                    newPoints = [
                        { time: newP1Time as UTCTimestamp, price: newP1Price },
                        { time: newP2Time as UTCTimestamp, price: newP2Price }
                    ];
                } else { // Handle point resize
                    const newPoint = getLogicalCoordinates(param);
                    if (!newPoint) return true;

                    if (fibRetracementState.dragMode === 'POINT_0') {
                        newPoints = [newPoint, fibRetracementState.startPoints[1]];
                    } else { // POINT_1
                        newPoints = [fibRetracementState.startPoints[0], newPoint];
                    }
                }
                
                updateDrawing(fibRetracementState.drawingId, { points: newPoints });
                return true;
            }
        } else {
            if (activeDrawingTool === 'fib-retracement' && fibRetracementState.type === 'DRAWING') {
                chart.applyOptions({ handleScroll: false, handleScale: false });
            } else if (fibRetracementState.type !== 'DRAGGING') {
                const fibRetracementUnderCursor = findFibRetracementUnderCursor(param);
                setHoveredFibRetracement(fibRetracementUnderCursor);
            }
        }

        return false;
    }, [fibRetracementState, activeDrawingTool, getLogicalCoordinates, findFibRetracementUnderCursor, drawings, updateDrawing, setSelectedDrawingId]);

    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        switch (event.key) {
            case 'Delete':
                if (fibRetracementState.type === 'SELECTED') {
                    removeDrawing(fibRetracementState.drawingId);
                    setFibRetracementState({ type: 'IDLE' });
                    setHoveredFibRetracement(null);
                    setSelectedDrawingId(null);
                    return true;
                }
                break;
            case 'Escape':
                if (fibRetracementState.type === 'DRAWING') {
                    setFibRetracementState({ type: 'IDLE' });
                    setActiveDrawingTool(null);
                    chartRef.current?.applyOptions({ handleScroll: true, handleScale: true });
                    return true;
                } else if (fibRetracementState.type === 'SELECTED' || fibRetracementState.type === 'DRAGGING') {
                    if (fibRetracementState.type === 'DRAGGING') {
                         updateDrawing(fibRetracementState.drawingId, { points: fibRetracementState.startPoints });
                         chartRef.current?.applyOptions({ handleScroll: true, handleScale: true });
                    }
                    setFibRetracementState({ type: 'IDLE' });
                    setHoveredFibRetracement(null);
                    setSelectedDrawingId(null);
                    return true;
                }
                break;
        }
        return false;
    }, [fibRetracementState, removeDrawing, setActiveDrawingTool, updateDrawing, setSelectedDrawingId]);

    const handleMouseUp = useCallback(() => {
        mouseStateRef.current.isDown = false;
        
        setFibRetracementState(prevState => {
            if (prevState.type === 'DRAGGING') {
                chartRef.current?.applyOptions({ handleScroll: true, handleScale: true });
                setSelectedDrawingId(prevState.drawingId);
                return { type: 'SELECTED', drawingId: prevState.drawingId };
            }
            return prevState;
        });
    }, [setSelectedDrawingId]);

    const inProgressFibRetracement: InProgressFibRetracement | null =
        fibRetracementState.type === 'DRAWING' && currentMousePoint && activeDrawingTool === 'fib-retracement'
            ? { type: 'fib-retracement', points: [fibRetracementState.firstPoint, currentMousePoint] }
            : null;

    const finalHoveredFibRetracement = fibRetracementState.type === 'SELECTED' || fibRetracementState.type === 'DRAGGING'
        ? { id: fibRetracementState.drawingId, pointIndex: hoveredFibRetracement?.pointIndex ?? null }
        : fibRetracementState.type === 'IDLE' ? hoveredFibRetracement : null;

    return {
        init,
        handleFibRetracementClick,
        handleFibRetracementSelection,
        handleFibRetracementMouseMove,
        handleKeyDown,
        handleMouseUp,
        inProgressFibRetracement,
        hoveredFibRetracement: finalHoveredFibRetracement,
        isDragging: fibRetracementState.type === 'DRAGGING',
        isActive: activeDrawingTool === 'fib-retracement' || fibRetracementState.type !== 'IDLE',
    };
};