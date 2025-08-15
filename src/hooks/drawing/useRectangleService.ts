import { useState, useCallback, useRef, useEffect } from 'react';
import { useTradingProStore, type DrawingPoint, type RectangleDrawing, type Drawing } from '../../store/store';
import type { IChartApi, ISeriesApi, UTCTimestamp, MouseEventParams, Time, CandlestickData, BarPrice, Coordinate } from 'lightweight-charts';

export type InProgressRectangle = {
    type: 'rectangle';
    points: [DrawingPoint, DrawingPoint];
};

type RectangleState =
    | { type: 'IDLE' }
    | { type: 'DRAWING', firstPoint: DrawingPoint }
    | { type: 'SELECTED', drawingId: string }
    | {
        type: 'DRAGGING',
        drawingId: string,
        startPoints: [DrawingPoint, DrawingPoint],
        startMousePixels: { x: number, y: number },
        startPointsPixels: { p1: { x: number, y: number }, p2: { x: number, y: number } },
        dragMode: 'ENTIRE_RECTANGLE' | 'CORNER_TL' | 'CORNER_TR' | 'CORNER_BL' | 'CORNER_BR' | 'EDGE_TOP' | 'EDGE_RIGHT' | 'EDGE_BOTTOM' | 'EDGE_LEFT'
      };

type HoverResult = {
    id: string;
    pointIndex: number | null;
};

// --- FIX: This is the "Interaction" part of the hybrid solution ---
// It now uses the snapping function to align with the visual rendering.
const checkRectangleHover = (
    param: MouseEventParams,
    drawing: Drawing,
    chart: IChartApi,
    series: ISeriesApi<'Candlestick', Time>,
    findClosestDataPointTime: (time: UTCTimestamp) => UTCTimestamp | null // Use the passed-in function
): HoverResult | null => {
    if (drawing.type !== 'rectangle' || !param.point) return null;

    // Step A: First, find where the rectangle is VISUALLY rendered by snapping its true points.
    const snappedPoints = (drawing as RectangleDrawing).points.map(point => {
        const snappedTime = findClosestDataPointTime(point.time);
        return snappedTime !== null ? { ...point, time: snappedTime } : null;
    }).filter((p): p is DrawingPoint => p !== null);

    if (snappedPoints.length < 2) return null;

    const pointsToUse = snappedPoints as [DrawingPoint, DrawingPoint];

    const timeScale = chart.timeScale();
    const p1 = pointsToUse[0];
    const p2 = pointsToUse[1];

    // Step B: Convert these visual (snapped) coordinates to pixels for the hover check.
    const p1Coord = { x: timeScale.timeToCoordinate(p1.time), y: series.priceToCoordinate(p1.price) };
    const p2Coord = { x: timeScale.timeToCoordinate(p2.time), y: series.priceToCoordinate(p2.price) };

    if (p1Coord.x === null || p1Coord.y === null || p2Coord.x === null || p2Coord.y === null) return null;

    const left = Math.min(p1Coord.x, p2Coord.x);
    const right = Math.max(p1Coord.x, p2Coord.x);
    const top = Math.min(p1Coord.y, p2Coord.y);
    const bottom = Math.max(p1Coord.y, p2Coord.y);
    const centerX = left + (right - left) / 2;
    const centerY = top + (bottom - top) / 2;
    const tolerance = 8;

    const handles = [
        { x: left, y: top, index: 0 },
        { x: right, y: top, index: 1 },
        { x: left, y: bottom, index: 2 },
        { x: right, y: bottom, index: 3 },
        { x: centerX, y: top, index: 4 },
        { x: right, y: centerY, index: 5 },
        { x: centerX, y: bottom, index: 6 },
        { x: left, y: centerY, index: 7 },
    ];

    for (const handle of handles) {
        const dist = Math.hypot(param.point.x - handle.x, param.point.y - handle.y);
        if (dist < tolerance) return { id: drawing.id, pointIndex: handle.index };
    }

    if (param.point.x >= left && param.point.x <= right && param.point.y >= top && param.point.y <= bottom) {
        return { id: drawing.id, pointIndex: null };
    }

    const borderTolerance = 4;
    if ((param.point.x >= left - borderTolerance && param.point.x <= right + borderTolerance &&
         (Math.abs(param.point.y - top) < borderTolerance || Math.abs(param.point.y - bottom) < borderTolerance)) ||
        (param.point.y >= top - borderTolerance && param.point.y <= bottom + borderTolerance &&
         (Math.abs(param.point.x - left) < borderTolerance || Math.abs(param.point.x - right) < borderTolerance))) {
        return { id: drawing.id, pointIndex: null };
    }

    return null;
};
// --- END FIX ---

export const useRectangleService = () => {
    const {
        drawings, activeDrawingTool, addDrawing, updateDrawing, removeDrawing,
        setActiveDrawingTool, setSelectedDrawingId, selectedDrawingId, drawingDefaults,
        timeframe,
    } = useTradingProStore();

    const [rectangleState, setRectangleState] = useState<RectangleState>({ type: 'IDLE' });
    const [hoveredRectangle, setHoveredRectangle] = useState<HoverResult | null>(null);
    const [currentMousePoint, setCurrentMousePoint] = useState<DrawingPoint | null>(null);

    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Candlestick', Time> | null>(null);
    const findClosestDataPointTimeRef = useRef<((time: UTCTimestamp) => UTCTimestamp | null) | null>(null);

    const mouseStateRef = useRef({
        isDown: false, startedDrag: false, lastClickTime: 0,
        mouseDownPos: null as { x: number, y: number } | null,
    });

    useEffect(() => {
        const isSelected = selectedDrawingId && drawings.some(d => d.id === selectedDrawingId && d.type === 'rectangle');
        if (isSelected) {
            if (rectangleState.type !== 'SELECTED' && rectangleState.type !== 'DRAGGING') {
                setRectangleState({ type: 'SELECTED', drawingId: selectedDrawingId! });
            }
        } else {
            if (rectangleState.type !== 'IDLE' && rectangleState.type !== 'DRAWING') {
                setRectangleState({ type: 'IDLE' });
            }
        }
    }, [selectedDrawingId, drawings, rectangleState.type]);

    useEffect(() => {
        const handleMouseDown = (e: MouseEvent) => {
            mouseStateRef.current.isDown = true;
            mouseStateRef.current.startedDrag = false;
            mouseStateRef.current.mouseDownPos = { x: e.clientX, y: e.clientY };
        };

        const handleMouseUp = () => {
            mouseStateRef.current.isDown = false;
            setRectangleState(prevState => {
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

    // Reset Drawing Drag States on Timeframe Change
    useEffect(() => {
        if (rectangleState.type === 'DRAGGING') {
            // Correctly transition back to SELECTED state, preserving the selection
            setRectangleState({ type: 'SELECTED', drawingId: rectangleState.drawingId });
            chartRef.current?.applyOptions({ handleScroll: true, handleScale: true });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timeframe]);


    const handleKeyDown = useCallback((event: KeyboardEvent): boolean => {
        switch (event.key) {
            case 'Delete':
                if (rectangleState.type === 'SELECTED') {
                    removeDrawing(rectangleState.drawingId);
                    setRectangleState({ type: 'IDLE' });
                    setHoveredRectangle(null);
                    setSelectedDrawingId(null);
                    return true;
                }
                break;
            case 'Escape':
                if (rectangleState.type === 'DRAWING') {
                    setRectangleState({ type: 'IDLE' });
                    setActiveDrawingTool(null);
                    return true;
                } else if (rectangleState.type === 'SELECTED' || rectangleState.type === 'DRAGGING') {
                    if (rectangleState.type === 'DRAGGING') {
                        updateDrawing(rectangleState.drawingId, { points: rectangleState.startPoints });
                        chartRef.current?.applyOptions({ handleScroll: true, handleScale: true });
                    }
                    setRectangleState({ type: 'IDLE' });
                    setHoveredRectangle(null);
                    setSelectedDrawingId(null);
                    return true;
                }
                break;
        }
        return false;
    }, [rectangleState, removeDrawing, setActiveDrawingTool, updateDrawing, setSelectedDrawingId]);

    const handleMouseUp = useCallback(() => {
        mouseStateRef.current.isDown = false;
        setRectangleState(prevState => {
            if (prevState.type === 'DRAGGING') {
                chartRef.current?.applyOptions({ handleScroll: true, handleScale: true });
                setSelectedDrawingId(prevState.drawingId);
                return { type: 'SELECTED', drawingId: prevState.drawingId };
            }
            return prevState;
        });
    }, [setSelectedDrawingId]);

    const init = useCallback((
        chart: IChartApi,
        series: ISeriesApi<'Candlestick', Time>,
        findClosestDataPointTime: (time: UTCTimestamp) => UTCTimestamp | null
    ) => {
        chartRef.current = chart;
        seriesRef.current = series;
        findClosestDataPointTimeRef.current = findClosestDataPointTime;
    }, []);

    const getLogicalCoordinates = useCallback((param: MouseEventParams): DrawingPoint | null => {
        const chart = chartRef.current;
        const series = seriesRef.current;
        if (!chart || !series || !param.point || !param.time) return null;

        let price = series.coordinateToPrice(param.point.y);
        if (price === null) return null;

        const { isMagnetModeActive, activeDrawingTool, selectedDrawingId, drawings, replayState, liveData, replayData, replayCurrentIndex } = useTradingProStore.getState();
        const magnetOn = isMagnetModeActive || (param.sourceEvent && param.sourceEvent.ctrlKey);

        const selectedDrawing = drawings.find(d => d.id === selectedDrawingId);
        const isDrawingContext = activeDrawingTool !== null || selectedDrawing !== undefined;

        if (magnetOn && isDrawingContext) {
            const logical = chart.timeScale().coordinateToLogical(param.point.x);
            if (logical !== null) {
                const chartData = replayState === 'idle' ? liveData : replayData.slice(0, replayCurrentIndex + 1);
                const roundedLogical = Math.round(logical);

                if (roundedLogical >= 0 && roundedLogical < chartData.length) {
                    const candle = chartData[roundedLogical] as CandlestickData<UTCTimestamp> | undefined;

                    if (candle) {
                        const ohlc = [candle.open, candle.high, candle.low, candle.close];
                        const currentPrice = price as number;
                        const snappedPrice = ohlc.reduce((prev, curr) =>
                            (Math.abs((curr as number) - currentPrice) < Math.abs((prev as number) - currentPrice) ? curr : prev)
                        );
                        price = snappedPrice as BarPrice;
                    }
                }
            }
        }

        return { time: param.time as UTCTimestamp, price: price as number };
    }, []);

    const findRectangleUnderCursor = useCallback((param: MouseEventParams): HoverResult | null => {
        const chart = chartRef.current;
        const series = seriesRef.current;
        const findClosest = findClosestDataPointTimeRef.current;
        if (!chart || !series || !findClosest) return null;

        for (const drawing of drawings) {
            if (drawing.type === 'rectangle') {
                const hoverResult = checkRectangleHover(param, drawing, chart, series, findClosest);
                if (hoverResult) return hoverResult;
            }
        }
        return null;
    }, [drawings]);

    const handleRectangleClick = useCallback((param: MouseEventParams) => {
        if (activeDrawingTool !== 'rectangle') return false;

        const now = Date.now();
        if ((mouseStateRef.current.startedDrag && rectangleState.type !== 'DRAWING') || (now - mouseStateRef.current.lastClickTime < 150)) {
            mouseStateRef.current.startedDrag = false;
            return true;
        }
        mouseStateRef.current.lastClickTime = now;
        mouseStateRef.current.startedDrag = false;

        const currentPoint = getLogicalCoordinates(param);
        if (!currentPoint) return true;

        if (rectangleState.type === 'IDLE') {
            setRectangleState({ type: 'DRAWING', firstPoint: currentPoint });
            return true;
        }

        if (rectangleState.type === 'DRAWING') {
            if (currentPoint.time !== rectangleState.firstPoint.time || currentPoint.price !== rectangleState.firstPoint.price) {
                const defaults = drawingDefaults.rectangle || { color: '#2196F3', width: 1, lineStyle: 'Solid' as const };
                const finalDrawing: RectangleDrawing = {
                    id: `rect_${Date.now()}`, type: 'rectangle', points: [rectangleState.firstPoint, currentPoint],
                    color: defaults.color || '#2196F3', width: defaults.width || 1, lineStyle: defaults.lineStyle || 'Solid',
                };
                addDrawing(finalDrawing);
                setRectangleState({ type: 'SELECTED', drawingId: finalDrawing.id });
                setSelectedDrawingId(finalDrawing.id);
            } else {
                setRectangleState({ type: 'IDLE' });
            }
            setActiveDrawingTool(null);
            return true;
        }
        return false;
    }, [rectangleState, activeDrawingTool, getLogicalCoordinates, addDrawing, setActiveDrawingTool, setSelectedDrawingId, drawingDefaults]);

    const handleRectangleSelection = useCallback((param: MouseEventParams) => {
        if (activeDrawingTool !== null) return false;
        const rectangleUnderCursor = findRectangleUnderCursor(param);
        if (rectangleState.type === 'SELECTED') {
            if (!rectangleUnderCursor || rectangleUnderCursor.id !== rectangleState.drawingId) {
                setSelectedDrawingId(null);
                setRectangleState({ type: 'IDLE' });
            }
            return true;
        }
        if (rectangleUnderCursor) {
            setSelectedDrawingId(rectangleUnderCursor.id);
            setRectangleState({ type: 'SELECTED', drawingId: rectangleUnderCursor.id });
            return true;
        }
        return false;
    }, [rectangleState, activeDrawingTool, findRectangleUnderCursor, setSelectedDrawingId]);

    const handleRectangleMouseMove = useCallback((param: MouseEventParams) => {
        const chart = chartRef.current;
        const series = seriesRef.current;
        const findClosest = findClosestDataPointTimeRef.current;
        if (!chart || !series || !findClosest || !param.point || !param.sourceEvent) return false;

        let endPoint = getLogicalCoordinates(param);
        if (!endPoint) return false;

        setCurrentMousePoint(endPoint);

        const isMouseDown = mouseStateRef.current.isDown;
        if (isMouseDown && !mouseStateRef.current.startedDrag) {
            const downPos = mouseStateRef.current.mouseDownPos;
            const distance = downPos ? Math.hypot(param.point.x - downPos.x, param.point.y - downPos.y) : 0;
            if (distance > 5) mouseStateRef.current.startedDrag = true;
        }

        if (isMouseDown && activeDrawingTool === 'rectangle' && rectangleState.type === 'IDLE') {
            setRectangleState({ type: 'DRAWING', firstPoint: endPoint });
            chart.applyOptions({ handleScroll: false, handleScale: false });
            return true;
        }

        if (isMouseDown && mouseStateRef.current.startedDrag) {
            if (rectangleState.type === 'IDLE' || rectangleState.type === 'SELECTED') {
                const target = findRectangleUnderCursor(param);
                const targetDrawing = target ? drawings.find(d => d.id === target.id) as RectangleDrawing : null;
                if (target && targetDrawing) {
                    let dragMode: 'ENTIRE_RECTANGLE' | 'CORNER_TL' | 'CORNER_TR' | 'CORNER_BL' | 'CORNER_BR' | 'EDGE_TOP' | 'EDGE_RIGHT' | 'EDGE_BOTTOM' | 'EDGE_LEFT' = 'ENTIRE_RECTANGLE';
                    switch(target.pointIndex) {
                        case 0: dragMode = 'CORNER_TL'; break; case 1: dragMode = 'CORNER_TR'; break;
                        case 2: dragMode = 'CORNER_BL'; break; case 3: dragMode = 'CORNER_BR'; break;
                        case 4: dragMode = 'EDGE_TOP'; break; case 5: dragMode = 'EDGE_RIGHT'; break;
                        case 6: dragMode = 'EDGE_BOTTOM'; break; case 7: dragMode = 'EDGE_LEFT'; break;
                        default: dragMode = 'ENTIRE_RECTANGLE';
                    }
                    
                    if (dragMode === 'ENTIRE_RECTANGLE') {
                        // --- DEFINITIVE FIX: Snap points to valid coordinates BEFORE starting the drag ---
                        const snappedP1Time = findClosest(targetDrawing.points[0].time);
                        const snappedP2Time = findClosest(targetDrawing.points[1].time);

                        if (snappedP1Time === null || snappedP2Time === null) {
                             return true; // Points are off-screen, abort drag.
                        }
                        
                        const snappedPoints: [DrawingPoint, DrawingPoint] = [
                            { ...targetDrawing.points[0], time: snappedP1Time },
                            { ...targetDrawing.points[1], time: snappedP2Time },
                        ];
                        
                        // Update the drawing with snapped points to ensure alignment
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
                            return true; // Double check after snapping, should not fail.
                        }
                        
                        setRectangleState({
                            type: 'DRAGGING', drawingId: target.id, startPoints: snappedPoints,
                            startMousePixels: { x: param.point.x, y: param.point.y },
                            startPointsPixels: { 
                                p1: p1_coord as { x: number; y: number; }, 
                                p2: p2_coord as { x: number; y: number; } 
                            },
                            dragMode
                        });

                    } else { // Handle corner/edge resize
                         setRectangleState({
                            type: 'DRAGGING', drawingId: target.id, startPoints: targetDrawing.points,
                            startMousePixels: { x: param.point.x, y: param.point.y },
                            startPointsPixels: { p1: {x:0, y:0}, p2: {x:0, y:0} }, // Not used for resize
                            dragMode
                        });
                    }
                    
                    setSelectedDrawingId(target.id);
                    chart.applyOptions({ handleScroll: false, handleScale: false });
                    return true;
                }
            } else if (rectangleState.type === 'DRAGGING') {
                const timeScale = chart.timeScale();
                let newPoints: [DrawingPoint, DrawingPoint];

                if (rectangleState.dragMode === 'ENTIRE_RECTANGLE') {
                    const pixelDeltaX = param.point.x - rectangleState.startMousePixels.x;
                    const pixelDeltaY = param.point.y - rectangleState.startMousePixels.y;

                    const newP1Coord = {
                        x: rectangleState.startPointsPixels.p1.x + pixelDeltaX,
                        y: rectangleState.startPointsPixels.p1.y + pixelDeltaY
                    };
                    const newP2Coord = {
                        x: rectangleState.startPointsPixels.p2.x + pixelDeltaX,
                        y: rectangleState.startPointsPixels.p2.y + pixelDeltaY
                    };

                    const newP1Time = timeScale.coordinateToTime(newP1Coord.x);
                    const newP1Price = series.coordinateToPrice(newP1Coord.y);
                    const newP2Time = timeScale.coordinateToTime(newP2Coord.x);
                    const newP2Price = series.coordinateToPrice(newP2Coord.y);

                    if (newP1Time === null || newP1Price === null || newP2Time === null || newP2Price === null) return true;

                    newPoints = [{ time: newP1Time as UTCTimestamp, price: newP1Price as number }, { time: newP2Time as UTCTimestamp, price: newP2Price as number }];
                
                } else {
                    const p1_start = { ...rectangleState.startPoints[0] };
                    const p2_start = { ...rectangleState.startPoints[1] };

                    const topLeft_start = {
                        time: Math.min(p1_start.time as number, p2_start.time as number) as UTCTimestamp,
                        price: Math.max(p1_start.price, p2_start.price)
                    };
                    const bottomRight_start = {
                        time: Math.max(p1_start.time as number, p2_start.time as number) as UTCTimestamp,
                        price: Math.min(p1_start.price, p2_start.price)
                    };

                    let newTopLeft = { ...topLeft_start };
                    let newBottomRight = { ...bottomRight_start };

                    switch (rectangleState.dragMode) {
                        case 'CORNER_TL':
                            newTopLeft = { time: endPoint.time, price: endPoint.price };
                            break;
                        case 'CORNER_TR':
                            newTopLeft.price = endPoint.price;
                            newBottomRight.time = endPoint.time;
                            break;
                        case 'CORNER_BL':
                            newTopLeft.time = endPoint.time;
                            newBottomRight.price = endPoint.price;
                            break;
                        case 'CORNER_BR':
                            newBottomRight = { time: endPoint.time, price: endPoint.price };
                            break;
                        case 'EDGE_TOP':
                            newTopLeft.price = endPoint.price;
                            break;
                        case 'EDGE_RIGHT':
                            newBottomRight.time = endPoint.time;
                            break;
                        case 'EDGE_BOTTOM':
                            newBottomRight.price = endPoint.price;
                            break;
                        case 'EDGE_LEFT':
                            newTopLeft.time = endPoint.time;
                            break;
                    }
                    newPoints = [newTopLeft, newBottomRight];
                }
                updateDrawing(rectangleState.drawingId, { points: newPoints });
                return true;
            }
        } else {
            if (rectangleState.type !== 'DRAWING') {
                const rectangleUnderCursor = findRectangleUnderCursor(param);
                setHoveredRectangle(rectangleUnderCursor);
            }
        }
        return false;
    }, [rectangleState, activeDrawingTool, getLogicalCoordinates, findRectangleUnderCursor, drawings, updateDrawing, setSelectedDrawingId]);

    const inProgressRectangle: InProgressRectangle | null =
        rectangleState.type === 'DRAWING' && currentMousePoint && activeDrawingTool === 'rectangle'
            ? { type: 'rectangle', points: [rectangleState.firstPoint, currentMousePoint] }
            : null;

    const finalHoveredRectangle = (rectangleState.type === 'SELECTED' || rectangleState.type === 'DRAGGING')
        ? { id: rectangleState.drawingId, pointIndex: hoveredRectangle?.pointIndex ?? null }
        : rectangleState.type === 'IDLE' ? hoveredRectangle : null;

    return {
        init, handleRectangleClick, handleRectangleSelection, handleRectangleMouseMove,
        handleKeyDown, handleMouseUp, inProgressRectangle,
        hoveredRectangle: finalHoveredRectangle,
        isDragging: rectangleState.type === 'DRAGGING',
        isActive: activeDrawingTool === 'rectangle' || rectangleState.type !== 'IDLE',
    };
};
