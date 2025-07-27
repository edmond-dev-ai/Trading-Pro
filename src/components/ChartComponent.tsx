import {
    createChart, ColorType, CrosshairMode,
    type IChartApi, type ISeriesApi, type CandlestickData, type UTCTimestamp,
    type LogicalRange, type MouseEventParams, type LineWidth,
    type LineData,
    type WhitespaceData, // --- MODIFICATION: Imported WhitespaceData type ---
    CandlestickSeries,
    LineSeries
} from 'lightweight-charts';
import React, { useEffect, useImperativeHandle, useRef, memo } from 'react';
import { format, addHours } from 'date-fns';
import { useTradingProStore } from '../store/store';

interface ChartComponentProps {
    // --- MODIFICATION: Updated data prop to accept WhitespaceData ---
    data: (CandlestickData<UTCTimestamp> | WhitespaceData<UTCTimestamp>)[];
    onVisibleLogicalRangeChange: (range: LogicalRange | null) => void;
    onChartClick: (time: UTCTimestamp) => void;
    isClickArmed: boolean;
    shouldRescale: boolean;
    replayScrollToTime: UTCTimestamp | null;
    onReplayScrolled: () => void;
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
        horzLine: { labelVisible: true, labelBackgroundColor: '#374151' },
        vertLine: { labelVisible: true, labelBackgroundColor: '#374151' }
    },
    autoSize: true,
};

const ChartComponentImpl = React.forwardRef<ChartHandle, ChartComponentProps>(
    ({ data, onVisibleLogicalRangeChange, onChartClick, isClickArmed, shouldRescale, replayScrollToTime, onReplayScrolled }, ref) => {
        const chartContainerRef = useRef<HTMLDivElement>(null);
        const chartRef = useRef<IChartApi | null>(null);
        const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

        const indicatorSeriesRef = useRef(new Map<string, ISeriesApi<'Line'>>());

        const chartAppearance = useTradingProStore((state) => state.chartAppearance);
        const candlestickColors = useTradingProStore((state) => state.candlestickColors);
        const activeIndicators = useTradingProStore((state) => state.activeIndicators);
        const replayState = useTradingProStore((state) => state.replayState);
        const timeframe = useTradingProStore((state) => state.timeframe);

        useImperativeHandle(ref, () => ({
            scrollToRealtime: () => chartRef.current?.timeScale().scrollToRealTime(),
            scrollToTime: (time) => {
                const chart = chartRef.current;
                if (!chart) return;
                // --- MODIFICATION: findIndex now works on a mixed-type array ---
                const dataIndex = data.findIndex(d => d.time === time);
                if (dataIndex !== -1) {
                    chart.timeScale().scrollToPosition(dataIndex, false);
                }
            },
        }));

        useEffect(() => {
            if (!chartContainerRef.current) return;
            const chart = createChart(chartContainerRef.current, {
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
                    timeFormatter: (time: UTCTimestamp) => {
                        const originalDate = new Date(time * 1000);
                        
                        // Only adjust display for daily and higher timeframes
                        const isDailyOrHigher = timeframe && ['1D', '1W', '1M'].includes(timeframe);
                        
                        if (isDailyOrHigher) {
                            // For daily+ timeframes, add 12 hours to show the actual trading day
                            // This is only for display purposes, not changing the actual data
                            // Show only date without time for daily and higher timeframes
                            const displayDate = addHours(originalDate, 12);
                            return format(displayDate, 'eee d MMM yy');
                        } else {
                            // For intraday timeframes, show the exact timestamp with time
                            return format(originalDate, 'eee d MMM yy HH:mm');
                        }
                    }
                }
            });
            chartRef.current = chart;
            const series = chart.addSeries(CandlestickSeries, candlestickColors);
            seriesRef.current = series;

            return () => {
                indicatorSeriesRef.current.forEach(series => chart.removeSeries(series));
                chart.remove();
            };
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);

        // Update timeFormatter when timeframe changes
        useEffect(() => {
            const chart = chartRef.current;
            if (!chart) return;

            chart.applyOptions({
                localization: {
                    dateFormat: 'dd MMM \'yy',
                    timeFormatter: (time: UTCTimestamp) => {
                        const originalDate = new Date(time * 1000);
                        
                        // Only adjust display for daily and higher timeframes
                        const isDailyOrHigher = timeframe && ['1D', '1W', '1M'].includes(timeframe);
                        
                        if (isDailyOrHigher) {
                            // For daily+ timeframes, add 12 hours to show the actual trading day
                            // This is only for display purposes, not changing the actual data
                            // Show only date without time for daily and higher timeframes
                            const displayDate = addHours(originalDate, 12);
                            return format(displayDate, 'eee d MMM yy');
                        } else {
                            // For intraday timeframes, show the exact timestamp with time
                            return format(originalDate, 'eee d MMM yy HH:mm');
                        }
                    }
                }
            });
        }, [timeframe]);

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
                    series.setData(indicator.data as LineData<UTCTimestamp>[]);
                }
            });
        }, [activeIndicators]);


        useEffect(() => {
            const chart = chartRef.current;
            if (!chart || !seriesRef.current) return;

            seriesRef.current.setData(data);

            if (shouldRescale && data.length > 0) {
                chart.timeScale().fitContent();
            }
        }, [data, shouldRescale]);

        useEffect(() => {
            const chart = chartRef.current;
            if (!chart || !replayScrollToTime || data.length === 0) return;

            const targetIndex = data.findIndex(d => d.time === replayScrollToTime);
            if (targetIndex === -1) return;

            const visibleRange = chart.timeScale().getVisibleLogicalRange();
            if (!visibleRange) return;

            const visibleWidth = visibleRange.to - visibleRange.from;
            const newFrom = targetIndex - visibleWidth / 2;
            const newTo = targetIndex + visibleWidth / 2;

            chart.timeScale().setVisibleLogicalRange({ from: newFrom, to: newTo });

            onReplayScrolled();

        }, [replayScrollToTime, data, onReplayScrolled]);

        useEffect(() => {
            const chart = chartRef.current;
            if (!chart) return;

            const handleClick = (param: MouseEventParams) => {
                if (isClickArmed && param.time && typeof param.time === 'number') {
                    onChartClick(param.time);
                }
            }
            const rangeChangeHandler = (range: LogicalRange | null) => onVisibleLogicalRangeChange(range);
            chart.subscribeClick(handleClick);
            chart.timeScale().subscribeVisibleLogicalRangeChange(rangeChangeHandler);
            return () => {
                if (chartRef.current) {
                    chart.unsubscribeClick(handleClick);
                    chart.timeScale().unsubscribeVisibleLogicalRangeChange(rangeChangeHandler);
                }
            };
        }, [isClickArmed, onChartClick, onVisibleLogicalRangeChange]);

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

            if (replayState !== 'idle') {
                if (data.length === 0) {
                    activeIndicators.forEach(indicator => {
                        const series = indicatorSeriesRef.current.get(indicator.id);
                        if (series) {
                            series.setData([]);
                        }
                    });
                    return;
                }
                const lastVisibleCandleIndex = data.length - 1;
                const lastVisibleTimestamp = data[lastVisibleCandleIndex].time;

                activeIndicators.forEach(indicator => {
                    const series = indicatorSeriesRef.current.get(indicator.id);
                    if (series) {
                        const slicedData = indicator.data.filter(point => point.time <= lastVisibleTimestamp);
                        series.setData(slicedData as LineData<UTCTimestamp>[]);
                    }
                });
            } else {
                activeIndicators.forEach(indicator => {
                    const series = indicatorSeriesRef.current.get(indicator.id);
                    if (series) {
                        series.setData(indicator.data as LineData<UTCTimestamp>[]);
                    }
                });
            }
        }, [activeIndicators, replayState, data]);

        return (
            <div ref={chartContainerRef} className='w-full h-full relative cursor-crosshair'>
            </div>
        );
    }
);

export const ChartComponent = memo(ChartComponentImpl);
