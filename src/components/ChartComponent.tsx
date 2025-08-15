import {
    createChart, ColorType, CrosshairMode,
    type IChartApi, type ISeriesApi, type CandlestickData, type UTCTimestamp,
    type LogicalRange, type MouseEventParams, type LineWidth,
    type LineData,
    type WhitespaceData,
    CandlestickSeries,
    LineSeries,
    type Time,
} from 'lightweight-charts';
import React, { useEffect, useImperativeHandle, useRef, memo, useMemo } from 'react';
import { formatInTimeZone, getTimezoneOffset } from 'date-fns-tz';
import { useTradingProStore, type Drawing, type DrawingPoint, type FibRetracementDrawing, type HorizontalRayDrawing, type TrendlineDrawing, type VerticalLineDrawing, type RectangleDrawing, type PositionDrawing } from '../store/store';
import { TrendlinePrimitive, type TrendlineData } from '../primitives/TrendlinePrimitive';
import { VerticalLinePrimitive, type VerticalLineData } from '../primitives/VerticalLinePrimitive';
import { HorizontalRayPrimitive, type HorizontalRayData } from '../primitives/HorizontalRayPrimitive';
import { FibRetracementPrimitive, type FibRetracementData } from '../primitives/FibRetracementPrimitive';
import { RectanglePrimitive, type RectangleData } from '../primitives/RectanglePrimitive';
import { PositionPrimitive, type PositionDrawingData } from '../primitives/PositionPrimitive';
import { type InProgressDrawing } from '../hooks/useDrawingService';

// --- FIX: Helper function moved here from App.tsx ---
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
        case '1M': return value * 31 * 24 * 60 * 60; // Approximation for a month
        default: return 0;
    }
};

interface ChartComponentProps {
    data: CandlestickData<UTCTimestamp>[]; // --- FIX: Prop now only receives candlestick data ---
    onVisibleLogicalRangeChange: (range: LogicalRange | null) => void;
    onChartClick: (param: MouseEventParams) => void;
    onCrosshairMove: (param: MouseEventParams) => void;
    isClickArmed: boolean;
    shouldRescale: boolean;
    replayScrollToTime: UTCTimestamp | null;
    onReplayScrolled: () => void;
    initDrawingService?: (
        chart: IChartApi,
        series: ISeriesApi<'Candlestick', Time>,
        findClosestDataPointTime: (time: UTCTimestamp) => UTCTimestamp | null
    ) => void;
    inProgressDrawing: InProgressDrawing | null;
    drawings: Drawing[];
    hoveredDrawing: { id: string, pointIndex: any } | null;
    timezone: string;
}

export type ChartHandle = {
    scrollToRealtime: () => void;
    scrollToTime: (time: UTCTimestamp) => void;
};

const chartOptions = {
    timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderVisible: false,
        rightBarStaysOnScroll: false,
        fixRightEdge: false,
    },
    handleScroll: { horzDrag: true, mouseWheel: true, pressedMouseMove: true },
    handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    crosshair: {
        mode: CrosshairMode.Normal,
        horzLine: { labelVisible: true, labelBackgroundColor: '#2D2D2D' },
        vertLine: { labelVisible: true, labelBackgroundColor: '#2D2D2D' }
    },
    autoSize: true,
};

const isDailyOrHigherTimeframe = (tf: string): boolean => {
    if (!tf) return false;
    const unitMatch = tf.match(/[a-zA-Z]+$/);
    if (!unitMatch) return false;
    const unitStr = unitMatch[0].toUpperCase();
    return unitStr === 'D' || unitStr === 'W' || unitStr === 'MO';};

const FIB_LEVELS = [
    { value: 0, label: '0%', color: '#688ee7', lineStyle: 'Solid' as const },
    { value: 0.236, label: '23.6%', color: '#7a96e8', lineStyle: 'Dotted' as const },
    { value: 0.382, label: '38.2%', color: '#8cbfe9', lineStyle: 'Dotted' as const },
    { value: 0.5, label: '50%', color: '#9ed8ea', lineStyle: 'Dotted' as const },
    { value: 0.618, label: '61.8%', color: '#b0e1eb', lineStyle: 'Dotted' as const },
    { value: 0.786, label: '78.6%', color: '#c2ebec', lineStyle: 'Dotted' as const },
    { value: 1, label: '100%', color: '#d4f4ed', lineStyle: 'Solid' as const },
];


const ChartComponentImpl = React.forwardRef<ChartHandle, ChartComponentProps>(
    ({
        data,
        onVisibleLogicalRangeChange, onChartClick, onCrosshairMove, isClickArmed, shouldRescale, replayScrollToTime, onReplayScrolled,
        initDrawingService, inProgressDrawing, drawings, hoveredDrawing, timezone
    }, ref) => {
        const chartContainerRef = useRef<HTMLDivElement>(null);
        const chartRef = useRef<IChartApi | null>(null);
        const seriesRef = useRef<ISeriesApi<'Candlestick', Time> | null>(null);
        
        const {
            chartAppearance, candlestickColors, activeIndicators, replayState, timeframe, drawingDefaults
        } = useTradingProStore();

        const displayCandles = useMemo(() => {
            if (timezone === 'Etc/UTC' || !data || data.length === 0) {
                return data;
            }
            return data.map(d => {
                const offsetMilliseconds = getTimezoneOffset(timezone, new Date((d.time as number) * 1000));
                const offsetSeconds = offsetMilliseconds / 1000;
                return {
                    ...d,
                    time: (d.time as number + offsetSeconds) as UTCTimestamp,
                };
            });
        }, [data, timezone]);

        // --- FIX: Whitespace is now generated here, based on the final display-ready candles ---
        const dataWithWhitespace = useMemo(() => {
            if (displayCandles.length === 0) {
                return [];
            }
            const WHITESPACE_COUNT = 10000;
            const lastTimestamp = displayCandles[displayCandles.length - 1].time;
            const interval = getTimeframeInSeconds(timeframe);

            if (interval === 0) {
                return displayCandles;
            }

            const whitespace: WhitespaceData<UTCTimestamp>[] = [];
            const lastKnownTime = lastTimestamp as number;
            for (let i = 1; i <= WHITESPACE_COUNT; i++) {
                const nextTime = lastKnownTime + (interval * i);
                whitespace.push({ time: nextTime as UTCTimestamp });
            }
            return [...displayCandles, ...whitespace];
        }, [displayCandles, timeframe]);


        const convertUTCToDisplayTime = useMemo(() => {
            return (utcTime: UTCTimestamp): UTCTimestamp => {
                if (timezone === 'Etc/UTC') {
                    return utcTime;
                }
                const offsetMilliseconds = getTimezoneOffset(timezone, new Date((utcTime as number) * 1000));
                const offsetSeconds = offsetMilliseconds / 1000;
                return (utcTime as number + offsetSeconds) as UTCTimestamp;
            };
        }, [timezone]);

        const dataRef = useRef(data);
        useEffect(() => {
            dataRef.current = data;
        }, [data]);

        const displayDataRef = useRef(dataWithWhitespace);
        useEffect(() => {
            displayDataRef.current = dataWithWhitespace;
        }, [dataWithWhitespace]);

        const indicatorSeriesRef = useRef(new Map<string, ISeriesApi<'Line'>>());
        const trendlinePrimitivesRef = useRef<Map<string, TrendlinePrimitive>>(new Map());
        const verticalLinePrimitivesRef = useRef<Map<string, VerticalLinePrimitive>>(new Map());
        const horizontalRayPrimitivesRef = useRef<Map<string, HorizontalRayPrimitive>>(new Map());
        const fibRetracementPrimitivesRef = useRef<Map<string, FibRetracementPrimitive>>(new Map());
        const rectanglePrimitivesRef = useRef<Map<string, RectanglePrimitive>>(new Map());
        const positionPrimitivesRef = useRef<Map<string, PositionPrimitive>>(new Map());

        useImperativeHandle(ref, () => ({
            scrollToRealtime: () => chartRef.current?.timeScale().scrollToRealTime(),
            scrollToTime: (time) => {
                const chart = chartRef.current;
                if (!chart) return;
                const displayTime = convertUTCToDisplayTime(time);
                const dataIndex = dataWithWhitespace.findIndex(d => d.time === displayTime);
                if (dataIndex !== -1) {
                    chart.applyOptions({ handleScroll: false, handleScale: false });
                    chart.timeScale().scrollToPosition(dataIndex, false);
                    setTimeout(() => {
                        chart.applyOptions({ handleScroll: true, handleScale: true });
                        onReplayScrolled();
                    }, 50);
                }
            },
        }));

        useEffect(() => {
            const container = chartContainerRef.current;
            if (!container) return;
            
            const timeFormatter = (time: UTCTimestamp) => {
                return formatInTimeZone(new Date(time * 1000), 'Etc/UTC', 
                    isDailyOrHigherTimeframe(timeframe) ? 'eee d MMM yy' : 'eee d MMM yy HH:mm'
                );
            };

            const chart = createChart(container, {
                ...chartOptions,
                layout: {
                    background: { type: ColorType.Solid, color: chartAppearance.background },
                    textColor: '#d1d5db'
                },
                grid: {
                    vertLines: { color: chartAppearance.vertGridColor },
                    horzLines: { color: chartAppearance.horzGridColor },
                },
                localization: {
                    dateFormat: 'dd MMM \'yy',
                    timeFormatter: timeFormatter
                }
            });
            chartRef.current = chart;
            const series = chart.addSeries(CandlestickSeries, candlestickColors);
            seriesRef.current = series as ISeriesApi<'Candlestick', Time>;

            if (initDrawingService) {
                const findClosestDataPointTime = (time: UTCTimestamp): UTCTimestamp | null => {
                    const currentDisplayData = displayDataRef.current;
                    let closestPoint: (CandlestickData<UTCTimestamp> | WhitespaceData<UTCTimestamp>) | undefined;
                    for (let i = currentDisplayData.length - 1; i >= 0; i--) {
                        if (currentDisplayData[i].time <= time) {
                            closestPoint = currentDisplayData[i];
                            break;
                        }
                    }
                    if (!closestPoint && currentDisplayData.length > 0) {
                        closestPoint = currentDisplayData[0];
                    }
                    return closestPoint ? closestPoint.time : null;
                };
                initDrawingService(chart, series as ISeriesApi<'Candlestick', Time>, findClosestDataPointTime);
            }

            return () => {
                if (seriesRef.current) {
                    trendlinePrimitivesRef.current.forEach(p => seriesRef.current?.detachPrimitive(p));
                    verticalLinePrimitivesRef.current.forEach(p => seriesRef.current?.detachPrimitive(p));
                    horizontalRayPrimitivesRef.current.forEach(p => seriesRef.current?.detachPrimitive(p));
                    fibRetracementPrimitivesRef.current.forEach(p => seriesRef.current?.detachPrimitive(p));
                    rectanglePrimitivesRef.current.forEach(p => seriesRef.current?.detachPrimitive(p));
                    positionPrimitivesRef.current.forEach(p => seriesRef.current?.detachPrimitive(p));
                }
                indicatorSeriesRef.current.forEach(series => chart.removeSeries(series));
                chart.remove();
            };
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);

        useEffect(() => {
            if (!seriesRef.current) return;
            seriesRef.current.setData(dataWithWhitespace); // --- FIX: Use the final combined data ---

            if (shouldRescale && dataWithWhitespace.length > 0) {
                chartRef.current?.timeScale().fitContent();
            }
        }, [dataWithWhitespace, shouldRescale]);

        useEffect(() => {
            const series = seriesRef.current;
            if (!series) return;

            if (dataWithWhitespace.length === 0) {
                trendlinePrimitivesRef.current.forEach(p => series.detachPrimitive(p));
                trendlinePrimitivesRef.current.clear();
                verticalLinePrimitivesRef.current.forEach(p => series.detachPrimitive(p));
                verticalLinePrimitivesRef.current.clear();
                horizontalRayPrimitivesRef.current.forEach(p => series.detachPrimitive(p));
                horizontalRayPrimitivesRef.current.clear();
                fibRetracementPrimitivesRef.current.forEach(p => series.detachPrimitive(p));
                fibRetracementPrimitivesRef.current.clear();
                rectanglePrimitivesRef.current.forEach(p => series.detachPrimitive(p));
                rectanglePrimitivesRef.current.clear();
                positionPrimitivesRef.current.forEach(p => series.detachPrimitive(p));
                positionPrimitivesRef.current.clear();
                return;
            }

            const findClosestDataPointTime = (displayTime: UTCTimestamp): UTCTimestamp | null => {
                let closestPoint: (CandlestickData<UTCTimestamp> | WhitespaceData<UTCTimestamp>) | undefined;
                for (let i = dataWithWhitespace.length - 1; i >= 0; i--) {
                    if (dataWithWhitespace[i].time <= displayTime) {
                        closestPoint = dataWithWhitespace[i];
                        break;
                    }
                }
                if (!closestPoint && dataWithWhitespace.length > 0) {
                    closestPoint = dataWithWhitespace[0];
                }
                return closestPoint ? closestPoint.time : null;
            };

            const allDrawings: (Drawing | (InProgressDrawing & { id: string }))[] = [...drawings];
            if (inProgressDrawing) {
                 allDrawings.push({ ...inProgressDrawing, id: 'in_progress' });
            }

            const currentDrawingIds = new Set(allDrawings.map(d => d.id));

            const cleanupPrimitives = (primitiveMap: Map<string, any>) => {
                primitiveMap.forEach((primitive, id) => {
                    if(!currentDrawingIds.has(id)){
                        series.detachPrimitive(primitive);
                        primitiveMap.delete(id);
                    }
                });
            };

            cleanupPrimitives(trendlinePrimitivesRef.current);
            cleanupPrimitives(verticalLinePrimitivesRef.current);
            cleanupPrimitives(horizontalRayPrimitivesRef.current);
            cleanupPrimitives(fibRetracementPrimitivesRef.current);
            cleanupPrimitives(rectanglePrimitivesRef.current);
            cleanupPrimitives(positionPrimitivesRef.current);

            allDrawings.forEach(drawing => {
                const drawingId = drawing.id;
                const isInProgress = drawingId === 'in_progress';

                if (drawing.type === 'trendline') {
                    const snappedPoints = (drawing as TrendlineDrawing).points.map((point: DrawingPoint) => {
                        const displayTime = findClosestDataPointTime(point.time);
                        return displayTime !== null ? { ...point, time: displayTime } : null;
                    }).filter((p): p is DrawingPoint => p !== null) as [DrawingPoint, DrawingPoint];

                    if (snappedPoints.length < 2) {
                        const primitive = trendlinePrimitivesRef.current.get(drawingId);
                        if(primitive) {
                            series.detachPrimitive(primitive);
                            trendlinePrimitivesRef.current.delete(drawingId);
                        }
                        return;
                    }

                    if (snappedPoints.length > 1 && snappedPoints[0].time === snappedPoints[1].time) {
                        return;
                    }

                    const isHovered = hoveredDrawing?.id === drawingId;
                    const selectedPointIndex = isHovered ? hoveredDrawing.pointIndex : null;

                    const defaults = drawingDefaults.trendline;
                    const trendlineDrawing = drawing as TrendlineDrawing;

                    const trendlineData: TrendlineData = {
                        id: drawingId,
                        points: snappedPoints,
                        color: isInProgress ? defaults.color! : trendlineDrawing.color!,
                        width: isInProgress ? defaults.width! : trendlineDrawing.width!,
                        lineStyle: isInProgress ? defaults.lineStyle! : trendlineDrawing.lineStyle!,
                        isHovered,
                        selectedPointIndex,
                    };

                    let primitive = trendlinePrimitivesRef.current.get(drawingId);
                    if(primitive){
                        primitive.updateData(trendlineData);
                    } else {
                        primitive = new TrendlinePrimitive();
                        series.attachPrimitive(primitive);
                        primitive.updateData(trendlineData);
                        trendlinePrimitivesRef.current.set(drawingId, primitive);
                    }
                    return;
                }

                if (drawing.type === 'vertical') {
                    const snappedTime = findClosestDataPointTime((drawing as VerticalLineDrawing).time);

                    if (!snappedTime) {
                        const primitive = verticalLinePrimitivesRef.current.get(drawingId);
                        if(primitive) {
                            series.detachPrimitive(primitive);
                            verticalLinePrimitivesRef.current.delete(drawingId);
                        }
                        return;
                    }

                    const isHovered = hoveredDrawing?.id === drawingId;
                    const defaults = drawingDefaults.vertical;
                    const verticalLineDrawing = drawing as VerticalLineDrawing;

                    const verticalLineData: VerticalLineData = {
                        id: drawingId,
                        time: snappedTime,
                        color: isInProgress ? defaults.color! : verticalLineDrawing.color,
                        width: isInProgress ? defaults.width! : verticalLineDrawing.width,
                        lineStyle: isInProgress ? defaults.lineStyle! : verticalLineDrawing.lineStyle!,
                        isHovered,
                    };

                    let primitive = verticalLinePrimitivesRef.current.get(drawingId);
                    if(primitive){
                        primitive.updateData(verticalLineData);
                    } else {
                        primitive = new VerticalLinePrimitive();
                        series.attachPrimitive(primitive);
                        primitive.updateData(verticalLineData);
                        verticalLinePrimitivesRef.current.set(drawingId, primitive);
                    }
                    return;
                }

                if (drawing.type === 'horizontalRay') {
                    const snappedTime = findClosestDataPointTime((drawing as HorizontalRayDrawing).time);
                    if (!snappedTime) {
                        const primitive = horizontalRayPrimitivesRef.current.get(drawingId);
                        if(primitive) {
                            series.detachPrimitive(primitive);
                            horizontalRayPrimitivesRef.current.delete(drawingId);
                        }
                        return;
                    }

                    const isHovered = hoveredDrawing?.id === drawingId;
                    const defaults = drawingDefaults.horizontalRay;
                    const horizontalRayDrawing = drawing as HorizontalRayDrawing;

                    const horizontalRayData: HorizontalRayData = {
                        id: drawingId,
                        time: snappedTime,
                        price: horizontalRayDrawing.price,
                        color: isInProgress ? defaults.color! : horizontalRayDrawing.color,
                        width: isInProgress ? defaults.width! : horizontalRayDrawing.width,
                        lineStyle: isInProgress ? defaults.lineStyle! : horizontalRayDrawing.lineStyle!,
                        isHovered,
                    };

                    let primitive = horizontalRayPrimitivesRef.current.get(drawingId);
                    if(primitive){
                        primitive.updateData(horizontalRayData);
                    } else {
                        primitive = new HorizontalRayPrimitive();
                        series.attachPrimitive(primitive);
                        primitive.updateData(horizontalRayData);
                        horizontalRayPrimitivesRef.current.set(drawingId, primitive);
                    }
                    return;
                }

                if (drawing.type === 'fib-retracement') {
                    const fibDrawing = drawing as FibRetracementDrawing;

                    const snappedPoints: [DrawingPoint, DrawingPoint] = fibDrawing.points.map((point: DrawingPoint) => {
                        const snappedTime = findClosestDataPointTime(point.time);
                        return snappedTime !== null ? { ...point, time: snappedTime } : null;
                    }).filter((p): p is DrawingPoint => p !== null) as [DrawingPoint, DrawingPoint];


                    if (snappedPoints.length < 2) {
                        const primitive = fibRetracementPrimitivesRef.current.get(drawingId);
                        if(primitive) {
                            series.detachPrimitive(primitive);
                            fibRetracementPrimitivesRef.current.delete(drawingId);
                        }
                        return;
                    }

                    if (snappedPoints[0].time === snappedPoints[1].time && snappedPoints[0].price === snappedPoints[1].price) {
                         const primitive = fibRetracementPrimitivesRef.current.get(drawingId);
                        if(primitive) {
                            series.detachPrimitive(primitive);
                            fibRetracementPrimitivesRef.current.delete(drawingId);
                        }
                        return;
                    }

                    const isHovered = hoveredDrawing?.id === drawingId;
                    const selectedPointIndex = isHovered ? hoveredDrawing.pointIndex : null;
                    const defaults = drawingDefaults['fib-retracement'];
                    const fibRetracementDrawing = drawing as FibRetracementDrawing;

                    const fibRetracementData: FibRetracementData = {
                        id: drawingId,
                        points: snappedPoints,
                        color: isInProgress ? defaults.color! : fibRetracementDrawing.color!,
                        width: isInProgress ? defaults.width! : fibRetracementDrawing.width!,
                        lineStyle: isInProgress ? defaults.lineStyle! : fibRetracementDrawing.lineStyle!,
                        showLabels: isInProgress ? true : fibRetracementDrawing.showLabels ?? true,
                        levels: isInProgress ? FIB_LEVELS : fibRetracementDrawing.levels,
                        isHovered,
                        selectedPointIndex,
                    };

                    let primitive = fibRetracementPrimitivesRef.current.get(drawingId);
                    if(primitive){
                        primitive.updateData(fibRetracementData);
                    } else {
                        primitive = new FibRetracementPrimitive();
                        series.attachPrimitive(primitive);
                        primitive.updateData(fibRetracementData);
                        fibRetracementPrimitivesRef.current.set(drawingId, primitive);
                    }
                    return;
                }

                if (drawing.type === 'rectangle') {
                    const rectangleDrawing = drawing as RectangleDrawing;

                    const pointsToRender = rectangleDrawing.points.map(point => {
                        const snappedTime = findClosestDataPointTime(point.time);
                        return snappedTime !== null ? { ...point, time: snappedTime } : null;
                    }).filter((p): p is DrawingPoint => p !== null) as [DrawingPoint, DrawingPoint];

                    if (pointsToRender.length < 2) {
                        const primitive = rectanglePrimitivesRef.current.get(drawingId);
                        if (primitive) {
                            series.detachPrimitive(primitive);
                            rectanglePrimitivesRef.current.delete(drawingId);
                        }
                        return;
                    }

                    const isHovered = hoveredDrawing?.id === drawingId;
                    const selectedPointIndex = isHovered ? hoveredDrawing.pointIndex : null;
                    const defaults = drawingDefaults.rectangle;

                    const rectangleData: RectangleData = {
                        id: drawingId,
                        points: pointsToRender,
                        color: isInProgress ? (defaults.color || '#2196F3') : (rectangleDrawing.color || '#2196F3'),
                        fillColor: defaults.fillColor || 'rgba(136, 136, 136, 0.2)',
                        width: isInProgress ? (defaults.width || 1) : (rectangleDrawing.width || 1),
                        lineStyle: isInProgress ? (defaults.lineStyle || 'Solid') : (rectangleDrawing.lineStyle || 'Solid'),
                        isHovered,
                        selectedPointIndex,
                    };

                    let primitive = rectanglePrimitivesRef.current.get(drawingId);
                    if (primitive) {
                        primitive.updateData(rectangleData);
                    } else {
                        primitive = new RectanglePrimitive();
                        series.attachPrimitive(primitive);
                        primitive.updateData(rectangleData);
                        rectanglePrimitivesRef.current.set(drawingId, primitive);
                    }
                    return;
                }

                if (drawing.type === 'long-position' || drawing.type === 'short-position') {
                    const positionDrawing = drawing as PositionDrawing;

                    const snappedEntryPointTime = findClosestDataPointTime(positionDrawing.entryPoint.time);
                    const snappedEndPointTime = positionDrawing.endPoint ? findClosestDataPointTime(positionDrawing.endPoint.time) : null;

                    if (!snappedEntryPointTime || (positionDrawing.endPoint && !snappedEndPointTime)) {
                        const primitive = positionPrimitivesRef.current.get(drawingId);
                        if (primitive) {
                            series.detachPrimitive(primitive);
                            positionPrimitivesRef.current.delete(drawingId);
                        }
                        return;
                    }

                    const isHovered = hoveredDrawing?.id === drawingId;
                    const positionData: PositionDrawingData = {
                        id: drawingId,
                        type: positionDrawing.type,
                        entryPoint: { ...positionDrawing.entryPoint, time: snappedEntryPointTime },
                        profitPoint: { ...positionDrawing.profitPoint, time: snappedEntryPointTime },
                        stopPoint: { ...positionDrawing.stopPoint, time: snappedEntryPointTime },
                        endPoint: positionDrawing.endPoint ? { ...positionDrawing.endPoint, time: snappedEndPointTime! } : undefined,
                        profitColor: positionDrawing.profitColor || '#22c55e',
                        stopColor: positionDrawing.stopColor || '#ef4444',
                        lineColor: positionDrawing.lineColor || '#FFFFFF',
                        lineWidth: positionDrawing.lineWidth,
                        isHovered,
                        hoveredPart: isHovered
                            ? (function () {
                                switch (hoveredDrawing.pointIndex) {
                                    case 0: return 'ENTRY_LINE';
                                    case 1: return 'STOP_LINE';
                                    case 2: return 'PROFIT_LINE';
                                    case 3: return 'RIGHT_EDGE';
                                    default: 'ENTIRE_POSITION';
                                }
                            })()
                            : null,
                    };

                    let primitive = positionPrimitivesRef.current.get(drawingId);
                    if (primitive) {
                        primitive.updateData(positionData);
                    } else {
                        primitive = new PositionPrimitive();
                        series.attachPrimitive(primitive);
                        primitive.updateData(positionData);
                        positionPrimitivesRef.current.set(drawingId, primitive);
                    }
                    return;
                }
            });
        }, [drawings, inProgressDrawing, dataWithWhitespace, hoveredDrawing, drawingDefaults]);


        useEffect(() => {
            const chart = chartRef.current;
            if (!chart) return;

            const timeFormatter = (time: UTCTimestamp) => {
                return formatInTimeZone(new Date(time * 1000), 'Etc/UTC', 
                    isDailyOrHigherTimeframe(timeframe) ? 'eee d MMM yy' : 'eee d MMM yy HH:mm'
                );
            };
           chart.applyOptions({
                localization: {
                    dateFormat: 'dd MMM \'yy',
                    timeFormatter: timeFormatter
                }
            });
        }, [timeframe, timezone]);

        useEffect(() => {
            if (!chartRef.current) return;
            chartRef.current.applyOptions({
                layout: {
                    background: { type: ColorType.Solid, color: chartAppearance.background },
                },
                grid: {
                    vertLines: { color: chartAppearance.vertGridColor },
                    horzLines: { color: chartAppearance.horzGridColor },
                }
            });
        }, [chartAppearance]);

        useEffect(() => {
            if (!seriesRef.current) return;
            seriesRef.current.applyOptions(candlestickColors);
        }, [candlestickColors]);

        useEffect(() => {
            const chart = chartRef.current;
            if (!chart) return;

            const currentSeriesIds = new Set(indicatorSeriesRef.current.keys());
            const activeIndicatorIds = new Set(activeIndicators.map(ind => ind.id));

            currentSeriesIds.forEach(id => {
                if (!activeIndicatorIds.has(id)) {
                    const series = indicatorSeriesRef.current.get(id);
                    if (series) {
                        chart.removeSeries(series);
                    }
                    indicatorSeriesRef.current.delete(id);
                }
            });

            activeIndicators.forEach(indicator => {
                let series = indicatorSeriesRef.current.get(indicator.id);
                const isVisible = indicator.isVisible ?? true;
                if (!series) {
                    series = chart.addSeries(LineSeries, {
                        color: indicator.color || '#2563eb',
                        lineWidth: 1,
                        lastValueVisible: false,
                        priceLineVisible: false,
                        visible: isVisible,
                        crosshairMarkerVisible: false,
                    });
                    indicatorSeriesRef.current.set(indicator.id, series);
                } else {
                    if (series.options().visible !== isVisible) {
                        series.applyOptions({ visible: isVisible });
                    }
                    if (series.options().color !== indicator.color) {
                        series.applyOptions({ color: indicator.color || '#2563eb' });
                    }
                }

                if (series) {
                    const displayIndicatorData = indicator.data.map(point => ({
                        ...point,
                        time: convertUTCToDisplayTime(point.time)
                    }));
                    series.setData(displayIndicatorData as LineData<UTCTimestamp>[]);
                }
            });
        }, [activeIndicators, convertUTCToDisplayTime]);


        useEffect(() => {
            const chart = chartRef.current;
            if (!chart || !replayScrollToTime || dataWithWhitespace.length === 0) return;
            const targetIndex = dataWithWhitespace.findIndex(d => d.time === convertUTCToDisplayTime(replayScrollToTime));
            if (targetIndex === -1) return;

            chart.applyOptions({ handleScroll: false, handleScale: false });

            const visibleRange = chart.timeScale().getVisibleLogicalRange();
            if (!visibleRange) return;
            const visibleWidth = visibleRange.to - visibleRange.from;
            const newFrom = targetIndex - visibleWidth / 2;
            const newTo = targetIndex + visibleWidth / 2;
            chart.timeScale().setVisibleLogicalRange({ from: newFrom, to: newTo });

            setTimeout(() => {
                chart.applyOptions({ handleScroll: true, handleScale: true });
                onReplayScrolled();
            }, 50);
        }, [replayScrollToTime, dataWithWhitespace, onReplayScrolled, convertUTCToDisplayTime]);

        useEffect(() => {
            const chart = chartRef.current;
            if (!chart) return;

            const handleClick = (param: MouseEventParams) => onChartClick(param);
            const handleCrosshair = (param: MouseEventParams) => onCrosshairMove(param);
            const handleRangeChange = (range: LogicalRange | null) => onVisibleLogicalRangeChange(range);

            chart.subscribeClick(handleClick);
            chart.subscribeCrosshairMove(handleCrosshair);
            chart.timeScale().subscribeVisibleLogicalRangeChange(handleRangeChange);

            return () => {
                if (chartRef.current) {
                    chart.unsubscribeClick(handleClick);
                    chart.unsubscribeCrosshairMove(handleCrosshair);
                    chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleRangeChange);
                }
            };
        }, [onVisibleLogicalRangeChange, onChartClick, onCrosshairMove]);

        useEffect(() => {
            chartRef.current?.applyOptions({
                crosshair: {
                    vertLine: { width: (isClickArmed ? 2 : 1) as LineWidth },
                    horzLine: { width: (isClickArmed ? 2 : 1) as LineWidth },
                }
            });
        }, [isClickArmed]);

        useEffect(() => {
            const chart = chartRef.current;
            if (!chart || !activeIndicators.length) return;

            const lastActualCandle = [...data].reverse().find(d => 'open' in d);

            if (!lastActualCandle) {
                activeIndicators.forEach(indicator => {
                    const series = indicatorSeriesRef.current.get(indicator.id);
                    if (series) {
                        const displayIndicatorData = indicator.data.map(point => ({
                            ...point,
                            time: convertUTCToDisplayTime(point.time)
                        }));
                        series.setData(displayIndicatorData as LineData<UTCTimestamp>[]);
                    }
                });
                return;
            }

            const lastVisibleTimestamp = lastActualCandle.time;

            if (replayState !== 'idle') {
                activeIndicators.forEach(indicator => {
                    const series = indicatorSeriesRef.current.get(indicator.id);
                    if (series) {
                        const slicedData = indicator.data.filter(point => point.time <= lastVisibleTimestamp);
                        const displayIndicatorData = slicedData.map(point => ({
                            ...point,
                            time: convertUTCToDisplayTime(point.time)
                        }));
                        series.setData(displayIndicatorData as LineData<UTCTimestamp>[]);
                    }
                });
            } else {
                activeIndicators.forEach(indicator => {
                    const series = indicatorSeriesRef.current.get(indicator.id);
                    if (series) {
                        const displayIndicatorData = indicator.data.map(point => ({
                            ...point,
                            time: convertUTCToDisplayTime(point.time)
                        }));
                        series.setData(displayIndicatorData as LineData<UTCTimestamp>[]);
                    }
                });
            }
        }, [activeIndicators, replayState, data, convertUTCToDisplayTime]);

        return (
            <div ref={chartContainerRef} className='w-full h-full relative cursor-crosshair'>
            </div>
        );
    }
);

export const ChartComponent = memo(ChartComponentImpl);
