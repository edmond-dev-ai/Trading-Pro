import { useState, useCallback, useRef, useEffect } from 'react';
import { useTradingProStore, type DrawingPoint, type PositionDrawing } from '../../store/store';
import type { IChartApi, ISeriesApi, UTCTimestamp, MouseEventParams, Time, CandlestickData, BarPrice } from 'lightweight-charts';

type PositionState =
    | { type: 'IDLE' }
    | { type: 'SELECTED', drawingId: string }
    | {
        type: 'DRAGGING',
        drawingId: string,
        startPosition: PositionDrawing,
        startMousePixels: { x: number, y: number },
        // --- FIX: Correctly implement pixel-based state like in the rectangle service ---
        startPointsPixels?: {
            entry: { x: number, y: number },
            stop: { x: number, y: number },
            profit: { x: number, y: number },
            end?: { x: number, y: number },
        },
        dragMode: 'ENTIRE_POSITION' | 'PROFIT_LINE' | 'STOP_LINE' | 'ENTRY_LINE' | 'RIGHT_EDGE'
      };

type HoverResult = {
    id: string;
    pointIndex: number | null;
};

const checkPositionHover = (
    param: MouseEventParams,
    drawing: PositionDrawing,
    chart: IChartApi,
    series: ISeriesApi<'Candlestick', Time>,
    findClosestDataPointTime: (time: UTCTimestamp) => UTCTimestamp | null
): HoverResult | null => {
    if (drawing.type !== 'long-position' && drawing.type !== 'short-position' || !param.point) return null;

    const timeScale = chart.timeScale();

    const snappedEntryTime = findClosestDataPointTime(drawing.entryPoint.time);
    const snappedEndTime = drawing.endPoint ? findClosestDataPointTime(drawing.endPoint.time) : snappedEntryTime;

    if (!snappedEntryTime || !snappedEndTime) return null;

    const entryX = timeScale.timeToCoordinate(snappedEntryTime);
    const rightX = timeScale.timeToCoordinate(snappedEndTime);
    const entryY = series.priceToCoordinate(drawing.entryPoint.price);
    const stopY = series.priceToCoordinate(drawing.stopPoint.price);
    const profitY = series.priceToCoordinate(drawing.profitPoint.price);

    if (entryX === null || rightX === null || entryY === null || stopY === null || profitY === null) return null;

    const tolerance = 12;

    const mouseX = param.point.x;
    const mouseY = param.point.y;

    if (Math.hypot(mouseX - entryX, mouseY - entryY) < tolerance) {
        return { id: drawing.id, pointIndex: 0 };
    }
    if (Math.hypot(mouseX - entryX, mouseY - profitY) < tolerance) {
        return { id: drawing.id, pointIndex: 2 };
    }
    if (Math.hypot(mouseX - entryX, mouseY - stopY) < tolerance) {
        return { id: drawing.id, pointIndex: 1 };
    }
    if (Math.hypot(mouseX - rightX, mouseY - entryY) < tolerance) {
        return { id: drawing.id, pointIndex: 3 };
    }

    const bodyTop = Math.min(profitY, stopY);
    const bodyBottom = Math.max(profitY, stopY);
    if (mouseX >= entryX && mouseX <= rightX && mouseY >= bodyTop && mouseY <= bodyBottom) {
        return { id: drawing.id, pointIndex: null };
    }

    return null;
};

export const usePositionService = () => {
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

    const [positionState, setPositionState] = useState<PositionState>({ type: 'IDLE' });
    const [hoveredPosition, setHoveredPosition] = useState<HoverResult | null>(null);

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
        const isSelected = selectedDrawingId && drawings.some(d => d.id === selectedDrawingId && (d.type === 'long-position' || d.type === 'short-position'));
        if (isSelected) {
            if (positionState.type !== 'SELECTED' && positionState.type !== 'DRAGGING') {
                setPositionState({ type: 'SELECTED', drawingId: selectedDrawingId! });
            }
        } else {
            if (positionState.type !== 'IDLE') {
                setPositionState({ type: 'IDLE' });
            }
        }
    }, [selectedDrawingId, drawings, positionState.type]);

    useEffect(() => {
        const handleMouseDown = (e: MouseEvent) => {
            mouseStateRef.current.isDown = true;
            mouseStateRef.current.startedDrag = false;
            mouseStateRef.current.mouseDownPos = { x: e.clientX, y: e.clientY };
        };

        const handleMouseUp = () => {
            mouseStateRef.current.isDown = false;

            setPositionState(prevState => {
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
                if (positionState.type === 'SELECTED') {
                    removeDrawing(positionState.drawingId);
                    setPositionState({ type: 'IDLE' });
                    setHoveredPosition(null);
                    setSelectedDrawingId(null);
                    return true;
                }
                break;
            case 'Escape':
                if (positionState.type === 'SELECTED' || positionState.type === 'DRAGGING') {
                    if (positionState.type === 'DRAGGING') {
                        updateDrawing(positionState.drawingId, positionState.startPosition);
                        chartRef.current?.applyOptions({ handleScroll: true, handleScale: true });
                    }
                    setPositionState({ type: 'IDLE' });
                    setHoveredPosition(null);
                    setSelectedDrawingId(null);
                    return true;
                }
                break;
        }
        return false;
    }, [positionState, removeDrawing, setActiveDrawingTool, updateDrawing, setSelectedDrawingId]);

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

    const findPositionUnderCursor = useCallback((param: MouseEventParams): HoverResult | null => {
        const chart = chartRef.current;
        const series = seriesRef.current;
        const findClosest = findClosestDataPointTimeRef.current;
        if (!chart || !series || !findClosest) return null;

        for (const drawing of drawings) {
            if (drawing.type === 'long-position' || drawing.type === 'short-position') {
                const hoverResult = checkPositionHover(param, drawing as PositionDrawing, chart, series, findClosest);
                if (hoverResult) return hoverResult;
            }
        }
        return null;
    }, [drawings]);

    const handleClick = useCallback((param: MouseEventParams) => {
        if (activeDrawingTool !== 'long-position' && activeDrawingTool !== 'short-position') return false;

        const now = Date.now();

        if (
            mouseStateRef.current.startedDrag ||
            (now - mouseStateRef.current.lastClickTime < 150)
        ) {
            mouseStateRef.current.startedDrag = false;
            return true;
        }
        mouseStateRef.current.lastClickTime = now;

        const currentPoint = getLogicalCoordinates(param);
        if (!currentPoint) return true;

        const positionType = activeDrawingTool === 'long-position' ? 'long' : 'short';
        const defaults = drawingDefaults[activeDrawingTool];

        const defaultDistance = 20;
        const stopPrice = positionType === 'long'
            ? currentPoint.price - defaultDistance
            : currentPoint.price + defaultDistance;
        const profitPrice = positionType === 'long'
            ? currentPoint.price + defaultDistance
            : currentPoint.price - defaultDistance;

        const defaultHorizontalDistance = 50;
        const intervalInSeconds = getTimeframeInSeconds(useTradingProStore.getState().timeframe);
        const endPointTime = (currentPoint.time as number) + (intervalInSeconds * defaultHorizontalDistance);

        const finalDrawing: PositionDrawing = {
            id: `pos_${Date.now()}`,
            type: activeDrawingTool,
            entryPoint: currentPoint,
            stopPoint: { time: currentPoint.time, price: stopPrice },
            profitPoint: { time: currentPoint.time, price: profitPrice },
            endPoint: { time: endPointTime as UTCTimestamp, price: currentPoint.price },
            profitColor: defaults.profitColor,
            stopColor: defaults.stopColor,
            lineColor: defaults.lineColor,
            lineWidth: defaults.width || 1,
        };

        addDrawing(finalDrawing);
        setPositionState({ type: 'SELECTED', drawingId: finalDrawing.id });
        setSelectedDrawingId(finalDrawing.id);
        setActiveDrawingTool(null);

        return true;
    }, [activeDrawingTool, getLogicalCoordinates, addDrawing, setActiveDrawingTool, setSelectedDrawingId, drawingDefaults, timeframe]);

    const handleSelection = useCallback((param: MouseEventParams) => {
        if (activeDrawingTool !== null) return false;

        const positionUnderCursor = findPositionUnderCursor(param);

        if (positionState.type === 'SELECTED') {
            if (!positionUnderCursor || positionUnderCursor.id !== positionState.drawingId) {
                setSelectedDrawingId(null);
                setPositionState({ type: 'IDLE' });
            }
            return true;
        }

        if (positionUnderCursor) {
            setSelectedDrawingId(positionUnderCursor.id);
            setPositionState({ type: 'SELECTED', drawingId: positionUnderCursor.id });
            return true;
        }

        return false;
    }, [positionState, activeDrawingTool, findPositionUnderCursor, setSelectedDrawingId]);

    const handleMouseMove = useCallback((param: MouseEventParams) => {
        const chart = chartRef.current;
        const series = seriesRef.current;
        const findClosest = findClosestDataPointTimeRef.current;
        if (!chart || !series || !findClosest || !param.point || !param.sourceEvent) return false;

        const currentPoint = getLogicalCoordinates(param);
        if (!currentPoint) return false;

        const isMouseDown = mouseStateRef.current.isDown;

        if (isMouseDown && !mouseStateRef.current.startedDrag) {
            const downPos = mouseStateRef.current.mouseDownPos;
            const distance = downPos ? Math.hypot(param.point.x - downPos.x, param.point.y - downPos.y) : 0;
            if (distance > 5) {
                mouseStateRef.current.startedDrag = true;
            }
        }

        if (isMouseDown && mouseStateRef.current.startedDrag) {
            if (positionState.type === 'IDLE' || positionState.type === 'SELECTED') {
                const target = findPositionUnderCursor(param);
                const targetDrawing = target ? drawings.find(d => d.id === target.id) as PositionDrawing : null;

                if (target && targetDrawing) {
                    let dragMode: 'ENTIRE_POSITION' | 'PROFIT_LINE' | 'STOP_LINE' | 'ENTRY_LINE' | 'RIGHT_EDGE' = 'ENTIRE_POSITION';

                    switch(target.pointIndex) {
                        case 0: dragMode = 'ENTRY_LINE'; break;
                        case 1: dragMode = 'STOP_LINE'; break;
                        case 2: dragMode = 'PROFIT_LINE'; break;
                        case 3: dragMode = 'RIGHT_EDGE'; break;
                        default: dragMode = 'ENTIRE_POSITION';
                    }

                    let startPointsPixels;
                    if (dragMode === 'ENTIRE_POSITION') {
                        const snappedEntryTime = findClosest(targetDrawing.entryPoint.time);
                        const snappedEndTime = targetDrawing.endPoint ? findClosest(targetDrawing.endPoint.time) : null;

                        if (!snappedEntryTime || (targetDrawing.endPoint && !snappedEndTime)) {
                            return true;
                        }

                        const entryCoord = { x: chart.timeScale().timeToCoordinate(snappedEntryTime), y: series.priceToCoordinate(targetDrawing.entryPoint.price) };
                        const stopCoord = { x: chart.timeScale().timeToCoordinate(snappedEntryTime), y: series.priceToCoordinate(targetDrawing.stopPoint.price) };
                        const profitCoord = { x: chart.timeScale().timeToCoordinate(snappedEntryTime), y: series.priceToCoordinate(targetDrawing.profitPoint.price) };
                        const endCoord = snappedEndTime ? { x: chart.timeScale().timeToCoordinate(snappedEndTime), y: series.priceToCoordinate(targetDrawing.endPoint!.price) } : undefined;

                        if (!entryCoord.x || !entryCoord.y || !stopCoord.x || !stopCoord.y || !profitCoord.x || !profitCoord.y || (endCoord && (!endCoord.x || !endCoord.y))) {
                             return true;
                        }
                        startPointsPixels = {
                            entry: entryCoord as {x: number, y: number},
                            stop: stopCoord as {x: number, y: number},
                            profit: profitCoord as {x: number, y: number},
                            end: endCoord as {x: number, y: number} | undefined
                        };
                    }

                    setPositionState({
                        type: 'DRAGGING',
                        drawingId: target.id,
                        startPosition: { ...targetDrawing },
                        startMousePixels: { x: param.point.x, y: param.point.y },
                        startPointsPixels,
                        dragMode
                    });

                    setSelectedDrawingId(target.id);
                    chart.applyOptions({ handleScroll: false, handleScale: false });
                    return true;
                }
            } else if (positionState.type === 'DRAGGING') {
                let updatedPosition: Partial<PositionDrawing> = {};
                const isLong = positionState.startPosition.type === 'long-position';

                switch (positionState.dragMode) {
                    case 'ENTIRE_POSITION': {
                        const { startPointsPixels, startMousePixels } = positionState;
                        if (!startPointsPixels) return true;

                        const pixelDeltaX = param.point.x - startMousePixels.x;
                        const pixelDeltaY = param.point.y - startMousePixels.y;

                        const { entry, stop, profit, end } = startPointsPixels;

                        const newEntryCoord = { x: entry.x + pixelDeltaX, y: entry.y + pixelDeltaY };
                        const newStopCoord = { x: stop.x + pixelDeltaX, y: stop.y + pixelDeltaY };
                        const newProfitCoord = { x: profit.x + pixelDeltaX, y: profit.y + pixelDeltaY };

                        const newEntryTime = chart.timeScale().coordinateToTime(newEntryCoord.x);
                        const newEntryPrice = series.coordinateToPrice(newEntryCoord.y);
                        const newStopPrice = series.coordinateToPrice(newStopCoord.y);
                        const newProfitPrice = series.coordinateToPrice(newProfitCoord.y);

                        if (newEntryTime === null || newEntryPrice === null || newStopPrice === null || newProfitPrice === null) {
                            return true;
                        }

                        updatedPosition = {
                            entryPoint: { time: newEntryTime as UTCTimestamp, price: newEntryPrice },
                            stopPoint: { time: newEntryTime as UTCTimestamp, price: newStopPrice },
                            profitPoint: { time: newEntryTime as UTCTimestamp, price: newProfitPrice },
                        };

                        if (end) {
                            const newEndCoord = { x: end.x + pixelDeltaX, y: end.y + pixelDeltaY };
                            const newEndTime = chart.timeScale().coordinateToTime(newEndCoord.x);
                            if (newEndTime !== null) {
                                updatedPosition.endPoint = { time: newEndTime as UTCTimestamp, price: newEntryPrice };
                            }
                        }
                        break;
                    }

                    case 'ENTRY_LINE': {
                        const newPrice = currentPoint.price;
                        const newTime = currentPoint.time;

                        const profitPrice = positionState.startPosition.profitPoint.price;
                        const stopPrice = positionState.startPosition.stopPoint.price;

                        let constrainedPrice = newPrice;
                        if (isLong) {
                            constrainedPrice = Math.min(constrainedPrice, profitPrice);
                            constrainedPrice = Math.max(constrainedPrice, stopPrice);
                        } else {
                            constrainedPrice = Math.max(constrainedPrice, profitPrice);
                            constrainedPrice = Math.min(constrainedPrice, stopPrice);
                        }

                        const endTime = positionState.startPosition.endPoint?.time;
                        if (endTime && (newTime as number) > (endTime as number)) return true;

                        updatedPosition = {
                            entryPoint: { time: newTime as UTCTimestamp, price: constrainedPrice },
                        };
                        break;
                    }

                    case 'STOP_LINE': {
                        const newPrice = currentPoint.price;
                        const entryPrice = positionState.startPosition.entryPoint.price;
                        if ((isLong && newPrice < entryPrice) || (!isLong && newPrice > entryPrice)) {
                            updatedPosition = {
                                stopPoint: { ...positionState.startPosition.stopPoint, price: newPrice },
                            };
                        }
                        break;
                    }

                    case 'PROFIT_LINE': {
                        const newPrice = currentPoint.price;
                        const entryPrice = positionState.startPosition.entryPoint.price;
                        if ((isLong && newPrice > entryPrice) || (!isLong && newPrice < entryPrice)) {
                            updatedPosition = {
                                profitPoint: { ...positionState.startPosition.profitPoint, price: newPrice },
                            };
                        }
                        break;
                    }

                    case 'RIGHT_EDGE': {
                        const newTime = currentPoint.time;
                        const entryTime = positionState.startPosition.entryPoint.time;
                        if ((newTime as number) < (entryTime as number)) return true;

                        const originalEntryPointPrice = positionState.startPosition.entryPoint.price;
                        updatedPosition = {
                            endPoint: { time: newTime as UTCTimestamp, price: originalEntryPointPrice },
                        };
                        break;
                    }
                }

                if (Object.keys(updatedPosition).length > 0) {
                    updateDrawing(positionState.drawingId, updatedPosition);
                }
                return true;
            }
        } else {
            const positionUnderCursor = findPositionUnderCursor(param);
            setHoveredPosition(positionUnderCursor);
        }

        return false;
    }, [positionState, activeDrawingTool, getLogicalCoordinates, findPositionUnderCursor, drawings, updateDrawing, setSelectedDrawingId]);

    const handleMouseUp = useCallback(() => {
        mouseStateRef.current.isDown = false;

        setPositionState(prevState => {
            if (prevState.type === 'DRAGGING') {
                chartRef.current?.applyOptions({ handleScroll: true, handleScale: true });
                setSelectedDrawingId(prevState.drawingId);
                return { type: 'SELECTED', drawingId: prevState.drawingId };
            }
            return prevState;
        });
    }, [setSelectedDrawingId]);

    const finalHoveredPosition = (positionState.type === 'SELECTED' || positionState.type === 'DRAGGING')
        ? { id: positionState.drawingId, pointIndex: hoveredPosition?.pointIndex ?? null }
        : positionState.type === 'IDLE' ? hoveredPosition : null;

    return {
        init,
        handleClick,
        handleSelection,
        handleMouseMove,
        handleKeyDown,
        handleMouseUp,
        hoveredPosition: finalHoveredPosition,
        isDragging: positionState.type === 'DRAGGING',
        isActive: (activeDrawingTool === 'long-position' || activeDrawingTool === 'short-position') || positionState.type !== 'IDLE',
    };
};

const getTimeframeInSeconds = (tf: string): number => {
    if (!tf || tf.length < 2) return 0;
    const unit = tf.slice(-1).toLowerCase();
    const valueStr = tf.slice(0, -1);
    const value = parseInt(valueStr, 10);
    if (isNaN(value)) return 0;

    switch (unit) {
        case 'm': return value * 60;
        case 'h': return value * 60 * 60;
        case 'd': return value * 24 * 60 * 60;
        case 'w': return value * 7 * 24 * 60 * 60;
        default: return 0;
    }
};