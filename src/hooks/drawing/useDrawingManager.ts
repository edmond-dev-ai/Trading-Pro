import { useCallback, useEffect, useRef } from 'react';
import { useTrendlineService } from './useTrendlineService';
import { useVerticalLineService } from './useVerticalLineService';
import { useHorizontalRayService } from './useHorizontalRayService';
import { useFibRetracementService } from './useFibRetracementService';
import { useRectangleService } from './useRectangleService';
import { usePositionService } from './usePositionService';
import type { IChartApi, ISeriesApi, MouseEventParams, Time, UTCTimestamp, CandlestickData, BarPrice } from 'lightweight-charts';
import type { InProgressFibRetracement } from './useFibRetracementService';
import type { InProgressTrendline } from './useTrendlineService';
import type { InProgressVerticalLine } from './useVerticalLineService';
import type { InProgressHorizontalRay } from './useHorizontalRayService';
import type { InProgressRectangle } from './useRectangleService';
import { useTradingProStore, type DrawingPoint } from '../../store/store';


export type InProgressDrawing =
    | InProgressTrendline
    | InProgressVerticalLine
    | InProgressHorizontalRay
    | InProgressFibRetracement
    | InProgressRectangle;

export const useDrawingManager = () => {
    const { setIsMagnetModeActive } = useTradingProStore();

    const trendlineService = useTrendlineService();
    const verticalLineService = useVerticalLineService();
    const horizontalRayService = useHorizontalRayService();
    const fibRetracementService = useFibRetracementService();
    const rectangleService = useRectangleService();
    const positionService = usePositionService();

    const magnetStateBeforeOverride = useRef(false);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Candlestick', Time> | null>(null);

    const mouseStateRef = { current: {
        isDown: false,
        startedDrag: false,
        lastClickTime: 0,
        mouseDownPos: null as { x: number, y: number } | null,
    }};

    const getDragState = useCallback(() => {
        if (trendlineService.isDragging) {
            return { isDragging: true, service: trendlineService, type: 'trendline' };
        }
        if (verticalLineService.isDragging) {
            return { isDragging: true, service: verticalLineService, type: 'verticalLine' };
        }
        if (horizontalRayService.isDragging) {
            return { isDragging: true, service: horizontalRayService, type: 'horizontalRay' };
        }
        if (fibRetracementService.isDragging) {
            return { isDragging: true, service: fibRetracementService, type: 'fibRetracement' };
        }
        if (rectangleService.isDragging) {
            return { isDragging: true, service: rectangleService, type: 'rectangle' };
        }
        if (positionService.isDragging) {
            return { isDragging: true, service: positionService, type: 'position' };
        }
        return { isDragging: false, service: null, type: null };
    }, [trendlineService.isDragging, verticalLineService.isDragging, horizontalRayService.isDragging, fibRetracementService.isDragging, rectangleService.isDragging, positionService.isDragging]);

    const getLogicalCoordinatesWithMagnet = useCallback((param: MouseEventParams): DrawingPoint | null => {
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

    useEffect(() => {
        const handleMouseDown = (e: MouseEvent) => {
            mouseStateRef.current.isDown = true;
            mouseStateRef.current.startedDrag = false;
            mouseStateRef.current.mouseDownPos = { x: e.clientX, y: e.clientY };
        };

        const handleMouseUp = () => {
            mouseStateRef.current.isDown = false;

            if (trendlineService.handleMouseUp) trendlineService.handleMouseUp();
            if (verticalLineService.handleMouseUp) verticalLineService.handleMouseUp();
            if (horizontalRayService.handleMouseUp) horizontalRayService.handleMouseUp();
            if (fibRetracementService.handleMouseUp) fibRetracementService.handleMouseUp();
        };

        document.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [trendlineService, verticalLineService, horizontalRayService, fibRetracementService]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Control' && !event.repeat) {
                magnetStateBeforeOverride.current = useTradingProStore.getState().isMagnetModeActive;
                setIsMagnetModeActive(true);
            } else if (!event.ctrlKey) {
                if (trendlineService.handleKeyDown && trendlineService.handleKeyDown(event)) return;
                if (verticalLineService.handleKeyDown && verticalLineService.handleKeyDown(event)) return;
                if (horizontalRayService.handleKeyDown && horizontalRayService.handleKeyDown(event)) return;
                if (fibRetracementService.handleKeyDown && fibRetracementService.handleKeyDown(event)) return;
                if (rectangleService.handleKeyDown && rectangleService.handleKeyDown(event)) return;
                if (positionService.handleKeyDown && positionService.handleKeyDown(event)) return;
            }
        };

        const handleKeyUp = (event: KeyboardEvent) => {
            if (event.key === 'Control') {
                setIsMagnetModeActive(magnetStateBeforeOverride.current);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [trendlineService, verticalLineService, horizontalRayService, fibRetracementService, rectangleService, positionService, setIsMagnetModeActive]);

    const init = useCallback((
        chart: IChartApi,
        series: ISeriesApi<'Candlestick', Time>,
        findClosestDataPointTime: (time: UTCTimestamp) => UTCTimestamp | null
    ) => {
        chartRef.current = chart;
        seriesRef.current = series;
        trendlineService.init(chart, series, findClosestDataPointTime);
        verticalLineService.init(chart, series, findClosestDataPointTime);
        horizontalRayService.init(chart, series, findClosestDataPointTime);
        fibRetracementService.init(chart, series, findClosestDataPointTime);
        rectangleService.init(chart, series, findClosestDataPointTime);
        positionService.init(chart, series, findClosestDataPointTime);
    }, [trendlineService, verticalLineService, horizontalRayService, fibRetracementService, rectangleService, positionService]);

    const handleChartClick = useCallback((param: MouseEventParams) => {
        const { activeDrawingTool, selectedDrawingId, drawings } = useTradingProStore.getState();
        const selectedDrawing = drawings.find(d => d.id === selectedDrawingId);
        const isDrawingContext = activeDrawingTool !== null || selectedDrawing !== undefined;

        let finalParam = param;

        if (isDrawingContext) {
            const magnetCoords = getLogicalCoordinatesWithMagnet(param);
            if (magnetCoords && chartRef.current && seriesRef.current) {
                const timeScale = chartRef.current.timeScale();
                const snappedX = timeScale.timeToCoordinate(magnetCoords.time);
                const snappedY = seriesRef.current.priceToCoordinate(magnetCoords.price);

                if (snappedX !== null && snappedY !== null) {
                    finalParam = {
                        ...param,
                        point: { x: snappedX, y: snappedY },
                        time: magnetCoords.time,
                    };
                }
            }
        }

        if (trendlineService.handleTrendlineClick(finalParam)) return;
        if (verticalLineService.handleVerticalLineClick(finalParam)) return;
        if (horizontalRayService.handleHorizontalRayClick(finalParam)) return;
        if (fibRetracementService.handleFibRetracementClick(finalParam)) return;
        if (rectangleService.handleRectangleClick(finalParam)) return;
        if (positionService.handleClick(finalParam)) return;

        if (trendlineService.handleTrendlineSelection(finalParam)) return;
        if (verticalLineService.handleVerticalLineSelection(finalParam)) return;
        if (horizontalRayService.handleHorizontalRaySelection(finalParam)) return;
        if (fibRetracementService.handleFibRetracementSelection(finalParam)) return;
        if (rectangleService.handleRectangleSelection(finalParam)) return;
        if (positionService.handleSelection(finalParam)) return;

    }, [trendlineService, verticalLineService, horizontalRayService, fibRetracementService, rectangleService, positionService, getLogicalCoordinatesWithMagnet]);

    const handleMouseMove = useCallback((param: MouseEventParams) => {
        const dragState = getDragState();

        if (dragState.isDragging) {
            const { activeDrawingTool, selectedDrawingId, drawings } = useTradingProStore.getState();
            const selectedDrawing = drawings.find(d => d.id === selectedDrawingId);
            const isDrawingContext = activeDrawingTool !== null || selectedDrawing !== undefined;

            if (isDrawingContext) {
                const magnetCoords = getLogicalCoordinatesWithMagnet(param);
                if (magnetCoords && chartRef.current && seriesRef.current) {
                    const timeScale = chartRef.current.timeScale();
                    const snappedX = timeScale.timeToCoordinate(magnetCoords.time);
                    const snappedY = seriesRef.current.priceToCoordinate(magnetCoords.price);

                    if (snappedX !== null && snappedY !== null) {
                        chartRef.current.setCrosshairPosition(magnetCoords.price, magnetCoords.time, seriesRef.current);

                        const snappedParam = {
                            ...param,
                            point: { x: snappedX, y: snappedY },
                            time: magnetCoords.time,
                        };

                        if (dragState.type === 'trendline') trendlineService.handleTrendlineMouseMove(snappedParam);
                        else if (dragState.type === 'verticalLine') verticalLineService.handleVerticalLineMouseMove(snappedParam);
                        else if (dragState.type === 'horizontalRay') horizontalRayService.handleHorizontalRayMouseMove(snappedParam);
                        else if (dragState.type === 'fibRetracement') fibRetracementService.handleFibRetracementMouseMove(snappedParam);
                        else if (dragState.type === 'rectangle') rectangleService.handleRectangleMouseMove(snappedParam);
                        else if (dragState.type === 'position') positionService.handleMouseMove(snappedParam);
                        return;
                    }
                }
            }

            if (dragState.type === 'trendline') trendlineService.handleTrendlineMouseMove(param);
            else if (dragState.type === 'verticalLine') verticalLineService.handleVerticalLineMouseMove(param);
            else if (dragState.type === 'horizontalRay') horizontalRayService.handleHorizontalRayMouseMove(param);
            else if (dragState.type === 'fibRetracement') fibRetracementService.handleFibRetracementMouseMove(param);
            else if (dragState.type === 'rectangle') rectangleService.handleRectangleMouseMove(param);
            else if (dragState.type === 'position') positionService.handleMouseMove(param);
            return;
        }

        const { activeDrawingTool, selectedDrawingId, drawings } = useTradingProStore.getState();
        const selectedDrawing = drawings.find(d => d.id === selectedDrawingId);
        const isDrawingContext = activeDrawingTool !== null || selectedDrawing !== undefined;

        if (isDrawingContext) {
            const magnetCoords = getLogicalCoordinatesWithMagnet(param);
            if (magnetCoords && chartRef.current && seriesRef.current) {
                const timeScale = chartRef.current.timeScale();
                const snappedX = timeScale.timeToCoordinate(magnetCoords.time);
                const snappedY = seriesRef.current.priceToCoordinate(magnetCoords.price);

                if (snappedX !== null && snappedY !== null) {
                    chartRef.current.setCrosshairPosition(magnetCoords.price, magnetCoords.time, seriesRef.current);

                    const snappedParam = {
                        ...param,
                        point: { x: snappedX, y: snappedY },
                        time: magnetCoords.time,
                    };

                    if (trendlineService.handleTrendlineMouseMove(snappedParam)) return;
                    if (verticalLineService.handleVerticalLineMouseMove(snappedParam)) return;
                    if (horizontalRayService.handleHorizontalRayMouseMove(snappedParam)) return;
                    if (fibRetracementService.handleFibRetracementMouseMove(snappedParam)) return;
                    if (rectangleService.handleRectangleMouseMove(snappedParam)) return;
                    if (positionService.handleMouseMove(snappedParam)) return;
                    return;
                }
            }
        }

        if (trendlineService.handleTrendlineMouseMove(param)) return;
        if (verticalLineService.handleVerticalLineMouseMove(param)) return;
        if (horizontalRayService.handleHorizontalRayMouseMove(param)) return;
        if (fibRetracementService.handleFibRetracementMouseMove(param)) return;
        if (rectangleService.handleRectangleMouseMove(param)) return;
        if (positionService.handleMouseMove(param)) return;

    }, [trendlineService, verticalLineService, horizontalRayService, fibRetracementService, rectangleService, positionService, getLogicalCoordinatesWithMagnet, getDragState]);

    const inProgressDrawing: InProgressDrawing | null =
        trendlineService.inProgressTrendline ||
        verticalLineService.inProgressVerticalLine ||
        horizontalRayService.inProgressHorizontalRay ||
        fibRetracementService.inProgressFibRetracement ||
        rectangleService.inProgressRectangle ||
        null;

    const hoveredDrawing =
        trendlineService.hoveredTrendline ||
        verticalLineService.hoveredVerticalLine ||
        horizontalRayService.hoveredHorizontalRay ||
        fibRetracementService.hoveredFibRetracement ||
        rectangleService.hoveredRectangle ||
        positionService.hoveredPosition ||
        null;

    const isDragging =
        trendlineService.isDragging ||
        verticalLineService.isDragging ||
        horizontalRayService.isDragging ||
        fibRetracementService.isDragging ||
        rectangleService.isDragging ||
        positionService.isDragging;

    const isActive =
        trendlineService.isActive ||
        verticalLineService.isActive ||
        horizontalRayService.isActive ||
        fibRetracementService.isActive ||
        rectangleService.isActive ||
        positionService.isActive;

    return {
        init,
        handleChartClick,
        handleMouseDown: () => {},
        handleMouseUp: () => {},
        handleMouseMove,
        inProgressDrawing,
        hoveredDrawing,
        isDragging,
        isActive,
        trendlineService,
        verticalLineService,
        horizontalRayService,
        fibRetracementService,
        rectangleService,
        positionService,
        getLogicalCoordinatesWithMagnet,
    };
};