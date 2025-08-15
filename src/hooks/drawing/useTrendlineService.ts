import { useState, useCallback, useRef, useEffect } from 'react';
import { useTradingProStore, type DrawingPoint, type TrendlineDrawing, type Drawing } from '../../store/store';
import type { IChartApi, ISeriesApi, UTCTimestamp, MouseEventParams, Time, CandlestickData, BarPrice } from 'lightweight-charts';

export type InProgressTrendline = {
    type: 'trendline';
    points: [DrawingPoint, DrawingPoint];
};

type TrendlineState =
    | { type: 'IDLE' }
    | { type: 'DRAWING', firstPoint: DrawingPoint }
    | { type: 'SELECTED', drawingId: string }
    | {
        type: 'DRAGGING',
        drawingId: string,
        startPoints: [DrawingPoint, DrawingPoint],
        // --- FIX START: Changed from logical to pixel-based tracking for dragging the whole line ---
        startMousePixels: { x: number, y: number },
        startPointsPixels: { p1: { x: number, y: number }, p2: { x: number, y: number } },
        // --- FIX END ---
        dragMode: 'ENTIRE_LINE' | 'POINT_0' | 'POINT_1'
      };

// The hover check uses the snapping function to align with the visual rendering.
const checkTrendlineHover = (
    param: MouseEventParams,
    drawing: Drawing,
    chart: IChartApi,
    series: ISeriesApi<'Candlestick', Time>,
    findClosestDataPointTime: (time: UTCTimestamp) => UTCTimestamp | null
): { id: string, pointIndex: number | null } | null => {
    if (drawing.type !== 'trendline' || !param.point) return null;

    const timeScale = chart.timeScale();

    // Step A: Snap the true points to get their visual location.
    const snappedP1Time = findClosestDataPointTime(drawing.points[0].time);
    const snappedP2Time = findClosestDataPointTime(drawing.points[1].time);

    if (!snappedP1Time || !snappedP2Time) return null;

    const p1 = { ...drawing.points[0], time: snappedP1Time };
    const p2 = { ...drawing.points[1], time: snappedP2Time };

    // Step B: Convert visual points to pixels for the check.
    const p1Coord = { x: timeScale.timeToCoordinate(p1.time), y: series.priceToCoordinate(p1.price) };
    const p2Coord = { x: timeScale.timeToCoordinate(p2.time), y: series.priceToCoordinate(p2.price) };

    if (p1Coord.x === null || p1Coord.y === null || p2Coord.x === null || p2Coord.y === null) return null;

    const distToP1 = Math.hypot(param.point.x - p1Coord.x, param.point.y - p1Coord.y);
    if (distToP1 < 12) return { id: drawing.id, pointIndex: 0 };

    const distToP2 = Math.hypot(param.point.x - p2Coord.x, param.point.y - p2Coord.y);
    if (distToP2 < 12) return { id: drawing.id, pointIndex: 1 };

    const distToLine = Math.abs(
        (p2Coord.y - p1Coord.y) * param.point.x -
        (p2Coord.x - p1Coord.x) * param.point.y +
        p2Coord.x * p1Coord.y -
        p2Coord.y * p1Coord.x
    ) / Math.hypot(p2Coord.y - p1Coord.y, p2Coord.x - p1Coord.x);

    const isWithinBounds =
        param.point.x >= Math.min(p1Coord.x, p2Coord.x) - 5 &&
        param.point.x <= Math.max(p1Coord.x, p2Coord.x) + 5;

    if (distToLine < 6 && isWithinBounds) return { id: drawing.id, pointIndex: null };

    return null;
};

export const useTrendlineService = () => {
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

    const [trendlineState, setTrendlineState] = useState<TrendlineState>({ type: 'IDLE' });
    const [hoveredTrendline, setHoveredTrendline] = useState<{ id: string, pointIndex: number | null } | null>(null);
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
        const isSelected = selectedDrawingId && drawings.some(d => d.id === selectedDrawingId && d.type === 'trendline');
        if (isSelected) {
            if (trendlineState.type !== 'SELECTED' && trendlineState.type !== 'DRAGGING') {
                setTrendlineState({ type: 'SELECTED', drawingId: selectedDrawingId! });
            }
        } else {
            if (trendlineState.type !== 'IDLE' && trendlineState.type !== 'DRAWING') {
                setTrendlineState({ type: 'IDLE' });
            }
        }
    }, [selectedDrawingId, drawings, trendlineState.type]);


    useEffect(() => {
        const handleMouseDown = (e: MouseEvent) => {
            mouseStateRef.current.isDown = true;
            mouseStateRef.current.startedDrag = false;
            mouseStateRef.current.mouseDownPos = { x: e.clientX, y: e.clientY };
        };

        const handleMouseUp = () => {
            mouseStateRef.current.isDown = false;

            setTrendlineState(prevState => {
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

    const handleKeyDown = useCallback((event: KeyboardEvent): boolean => {
        switch (event.key) {
            case 'Delete':
                if (trendlineState.type === 'SELECTED') {
                    removeDrawing(trendlineState.drawingId);
                    setTrendlineState({ type: 'IDLE' });
                    setHoveredTrendline(null);
                    setSelectedDrawingId(null);
                    return true;
                }
                break;
            case 'Escape':
                if (trendlineState.type === 'DRAWING') {
                    setTrendlineState({ type: 'IDLE' });
                    setActiveDrawingTool(null);
                    return true;
                } else if (trendlineState.type === 'SELECTED' || trendlineState.type === 'DRAGGING') {
                    if (trendlineState.type === 'DRAGGING') {
                        updateDrawing(trendlineState.drawingId, { points: trendlineState.startPoints });
                        chartRef.current?.applyOptions({ handleScroll: true, handleScale: true });
                    }
                    setTrendlineState({ type: 'IDLE' });
                    setHoveredTrendline(null);
                    setSelectedDrawingId(null);
                    return true;
                }
                break;
        }
        return false;
    }, [trendlineState, removeDrawing, setActiveDrawingTool, updateDrawing, setSelectedDrawingId]);

    const handleMouseUp = useCallback(() => {
        mouseStateRef.current.isDown = false;

        setTrendlineState(prevState => {
            if (prevState.type === 'DRAGGING') {
                chartRef.current?.applyOptions({ handleScroll: true, handleScale: true });
                setSelectedDrawingId(prevState.drawingId);
                return { type: 'SELECTED', drawingId: prevState.drawingId };
            }
            return prevState;
        });
    }, [setSelectedDrawingId]);

    const init = useCallback((chart: IChartApi, series: ISeriesApi<'Candlestick', Time>, findClosestDataPointTime: (time: UTCTimestamp) => UTCTimestamp | null) => {
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


    const findTrendlineUnderCursor = useCallback((param: MouseEventParams): { id: string, pointIndex: number | null } | null => {
        const chart = chartRef.current;
        const series = seriesRef.current;
        const findClosest = findClosestDataPointTimeRef.current;
        if (!chart || !series || !findClosest) return null;

        for (const drawing of drawings) {
            if (drawing.type === 'trendline') {
                const hoverResult = checkTrendlineHover(param, drawing, chart, series, findClosest);
                if (hoverResult) return hoverResult;
            }
        }
        return null;
    }, [drawings]);

    const handleTrendlineClick = useCallback((param: MouseEventParams) => {
        if (activeDrawingTool !== 'trendline') return false;

        const now = Date.now();

        if (
            (mouseStateRef.current.startedDrag && trendlineState.type !== 'DRAWING') ||
            (now - mouseStateRef.current.lastClickTime < 150)
        ) {
            mouseStateRef.current.startedDrag = false;
            return true;
        }
        mouseStateRef.current.lastClickTime = now;
        mouseStateRef.current.startedDrag = false;

        const currentPoint = getLogicalCoordinates(param);
        if (!currentPoint) return true;

        if (trendlineState.type === 'IDLE') {
            setTrendlineState({ type: 'DRAWING', firstPoint: currentPoint });
            return true;
        }

        if (trendlineState.type === 'DRAWING') {
             if (currentPoint.time !== trendlineState.firstPoint.time) {
                const defaults = drawingDefaults.trendline;
                const finalDrawing: TrendlineDrawing = {
                    id: `trend_${Date.now()}`,
                    type: 'trendline',
                    points: [trendlineState.firstPoint, currentPoint],
                    color: defaults.color,
                    width: defaults.width,
                    lineStyle: defaults.lineStyle,
                };
                addDrawing(finalDrawing);
                setTrendlineState({ type: 'SELECTED', drawingId: finalDrawing.id });
                setSelectedDrawingId(finalDrawing.id);
            } else {
                setTrendlineState({ type: 'IDLE' });
            }
            setActiveDrawingTool(null);
            return true;
        }

        return false;
    }, [trendlineState, activeDrawingTool, getLogicalCoordinates, addDrawing, setActiveDrawingTool, setSelectedDrawingId, drawingDefaults]);

    const handleTrendlineSelection = useCallback((param: MouseEventParams) => {
        if (activeDrawingTool !== null) return false;

        const trendlineUnderCursor = findTrendlineUnderCursor(param);

        if (trendlineState.type === 'SELECTED') {
            if (!trendlineUnderCursor || trendlineUnderCursor.id !== trendlineState.drawingId) {
                setSelectedDrawingId(null);
                setTrendlineState({ type: 'IDLE' });
            }
            return true;
        }

        if (trendlineUnderCursor) {
            setSelectedDrawingId(trendlineUnderCursor.id);
            setTrendlineState({ type: 'SELECTED', drawingId: trendlineUnderCursor.id });
            return true;
        }

        return false;
    }, [trendlineState, activeDrawingTool, findTrendlineUnderCursor, setSelectedDrawingId]);

    const handleTrendlineMouseMove = useCallback((param: MouseEventParams) => {
        const chart = chartRef.current;
        const series = seriesRef.current;
        const findClosest = findClosestDataPointTimeRef.current;
        if (!chart || !series || !findClosest || !param.point || !param.sourceEvent) return false;


        let endPoint = getLogicalCoordinates(param);
        if (!endPoint) return false;

        const isDrawing = trendlineState.type === 'DRAWING';
        const isDraggingPoint = trendlineState.type === 'DRAGGING' && (trendlineState.dragMode === 'POINT_0' || trendlineState.dragMode === 'POINT_1');

        if (param.sourceEvent.shiftKey && (isDrawing || isDraggingPoint)) {
            const timeScale = chart.timeScale();
            let anchorPoint: DrawingPoint;

            if (isDrawing) {
                anchorPoint = trendlineState.firstPoint;
            } else {
                anchorPoint = trendlineState.dragMode === 'POINT_0'
                    ? trendlineState.startPoints[1]
                    : trendlineState.startPoints[0];
            }

            const anchorCoords = {
                x: timeScale.timeToCoordinate(anchorPoint.time),
                y: series.priceToCoordinate(anchorPoint.price),
            };
            const currentCoords = { x: param.point.x, y: param.point.y };

            if (anchorCoords.x !== null && anchorCoords.y !== null) {
                const dx = currentCoords.x - anchorCoords.x;
                const dy = currentCoords.y - anchorCoords.y;

                let angle = Math.atan2(dy, dx) * 180 / Math.PI;
                if (angle < 0) angle += 360;

                const snappedAngleDeg = Math.round(angle / 45) * 45;
                const distance = Math.hypot(dx, dy);
                let snappedX, snappedY;

                if (snappedAngleDeg === 90 || snappedAngleDeg === 270) {
                    snappedX = anchorCoords.x;
                    snappedY = snappedAngleDeg === 90 ?
                        anchorCoords.y - distance :
                        anchorCoords.y + distance;
                } else if (snappedAngleDeg === 0 || snappedAngleDeg === 180) {
                    snappedX = snappedAngleDeg === 0 ?
                        anchorCoords.x + distance :
                        anchorCoords.x - distance;
                    snappedY = anchorCoords.y;
                } else {
                    const snappedAngleRad = (snappedAngleDeg * Math.PI) / 180;
                    snappedX = anchorCoords.x + distance * Math.cos(snappedAngleRad);
                    snappedY = anchorCoords.y + distance * Math.sin(snappedAngleRad);
                }

                const snappedTime = timeScale.coordinateToTime(snappedX);
                const snappedPrice = series.priceToCoordinate(snappedY);

                if (snappedTime !== null && snappedPrice !== null) {
                    endPoint = { time: snappedTime as UTCTimestamp, price: snappedPrice as number };
                }
            }
        }

        setCurrentMousePoint(endPoint);

        const isMouseDown = mouseStateRef.current.isDown;

        if (isMouseDown && !mouseStateRef.current.startedDrag) {
            const downPos = mouseStateRef.current.mouseDownPos;
            const distance = downPos ? Math.hypot(param.point.x - downPos.x, param.point.y - downPos.y) : 0;
            if (distance > 5) {
                mouseStateRef.current.startedDrag = true;
            }
        }

        if (isMouseDown && activeDrawingTool === 'trendline' && trendlineState.type === 'IDLE') {
             setTrendlineState({ type: 'DRAWING', firstPoint: endPoint });
             chart.applyOptions({ handleScroll: false, handleScale: false });
             return true;
        }

        if (isMouseDown && mouseStateRef.current.startedDrag) {
             if (trendlineState.type === 'IDLE' || trendlineState.type === 'SELECTED') {
                const target = findTrendlineUnderCursor(param);
                const targetDrawing = target ? drawings.find(d => d.id === target.id) as TrendlineDrawing : null;

                if (target && targetDrawing) {
                    let dragMode: 'ENTIRE_LINE' | 'POINT_0' | 'POINT_1' = 'ENTIRE_LINE';
                    if (target.pointIndex === 0) dragMode = 'POINT_0';
                    else if (target.pointIndex === 1) dragMode = 'POINT_1';

                    // --- FIX START: Implemented pixel-based dragging logic ---
                    if (dragMode === 'ENTIRE_LINE') {
                        // Snap points to valid coordinates BEFORE starting the drag
                        const snappedP1Time = findClosest(targetDrawing.points[0].time);
                        const snappedP2Time = findClosest(targetDrawing.points[1].time);

                        if (snappedP1Time === null || snappedP2Time === null) {
                             return true; // Points are off-screen, abort drag.
                        }

                        const snappedPoints: [DrawingPoint, DrawingPoint] = [
                            { ...targetDrawing.points[0], time: snappedP1Time },
                            { ...targetDrawing.points[1], time: snappedP2Time },
                        ];

                        // Convert snapped points to pixel coordinates
                        const p1_coord = {
                            x: chart.timeScale().timeToCoordinate(snappedPoints[0].time),
                            y: series.priceToCoordinate(snappedPoints[0].price)
                        };
                        const p2_coord = {
                            x: chart.timeScale().timeToCoordinate(snappedPoints[1].time),
                            y: series.priceToCoordinate(snappedPoints[1].price)
                        };

                        if (p1_coord.x === null || p1_coord.y === null || p2_coord.x === null || p2_coord.y === null) {
                            return true; // Should not fail if points were snapped correctly
                        }

                        setTrendlineState({
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
                    } else { // Handle individual point resize (existing logic)
                         setTrendlineState({
                            type: 'DRAGGING',
                            drawingId: target.id,
                            startPoints: targetDrawing.points,
                            startMousePixels: { x: param.point.x, y: param.point.y }, // Store mouse pos for point drag too
                            startPointsPixels: { p1: {x:0, y:0}, p2: {x:0, y:0} }, // Not used for point resize
                            dragMode
                        });
                    }
                    // --- FIX END ---

                    setSelectedDrawingId(target.id);
                    chart.applyOptions({ handleScroll: false, handleScale: false });
                    return true;
                }
            } else if (trendlineState.type === 'DRAGGING') {
                let newPoints: [DrawingPoint, DrawingPoint];

                if (trendlineState.dragMode === 'ENTIRE_LINE') {
                    // --- FIX START: Calculate new position based on pixel delta ---
                    const pixelDeltaX = param.point.x - trendlineState.startMousePixels.x;
                    const pixelDeltaY = param.point.y - trendlineState.startMousePixels.y;

                    const newP1Coord = {
                        x: trendlineState.startPointsPixels.p1.x + pixelDeltaX,
                        y: trendlineState.startPointsPixels.p1.y + pixelDeltaY
                    };
                    const newP2Coord = {
                        x: trendlineState.startPointsPixels.p2.x + pixelDeltaX,
                        y: trendlineState.startPointsPixels.p2.y + pixelDeltaY
                    };

                    const newP1Time = chart.timeScale().coordinateToTime(newP1Coord.x);
                    const newP1Price = series.coordinateToPrice(newP1Coord.y);
                    const newP2Time = chart.timeScale().coordinateToTime(newP2Coord.x);
                    const newP2Price = series.coordinateToPrice(newP2Coord.y);

                    if (newP1Time === null || newP1Price === null || newP2Time === null || newP2Price === null) return true;

                    newPoints = [
                        { time: newP1Time as UTCTimestamp, price: newP1Price as number },
                        { time: newP2Time as UTCTimestamp, price: newP2Price as number }
                    ];
                    // --- FIX END ---
                } else { // Existing logic for dragging individual points
                    const stationaryPoint = trendlineState.dragMode === 'POINT_0'
                        ? trendlineState.startPoints[1]
                        : trendlineState.startPoints[0];

                    newPoints = trendlineState.dragMode === 'POINT_0'
                        ? [endPoint, stationaryPoint]
                        : [stationaryPoint, endPoint];
                }

                updateDrawing(trendlineState.drawingId, { points: newPoints });
                return true;
            }
        } else {
            if (trendlineState.type !== 'DRAWING') {
                const trendlineUnderCursor = findTrendlineUnderCursor(param);
                setHoveredTrendline(trendlineUnderCursor);
            }
        }

        return false;
    }, [trendlineState, activeDrawingTool, getLogicalCoordinates, findTrendlineUnderCursor, drawings, updateDrawing, setSelectedDrawingId, selectedDrawingId]);

    const inProgressTrendline: InProgressTrendline | null =
        trendlineState.type === 'DRAWING' && currentMousePoint && activeDrawingTool === 'trendline'
            ? { type: 'trendline', points: [trendlineState.firstPoint, currentMousePoint] }
            : null;

    const finalHoveredTrendline = (trendlineState.type === 'SELECTED' || trendlineState.type === 'DRAGGING')
        ? { id: trendlineState.drawingId, pointIndex: hoveredTrendline?.pointIndex ?? null }
        : trendlineState.type === 'IDLE' ? hoveredTrendline : null;

    return {
        init,
        handleTrendlineClick,
        handleTrendlineSelection,
        handleTrendlineMouseMove,
        handleKeyDown,
        handleMouseUp,
        inProgressTrendline,
        hoveredTrendline: finalHoveredTrendline,
        isDragging: trendlineState.type === 'DRAGGING',
        isActive: activeDrawingTool === 'trendline' || trendlineState.type !== 'IDLE',
    };
};
