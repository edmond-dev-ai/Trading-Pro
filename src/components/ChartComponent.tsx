import {
    createChart, ColorType, CrosshairMode, CandlestickSeries,
    type IChartApi, type ISeriesApi, type CandlestickData, type UTCTimestamp,
    type LogicalRange, type MouseEventParams, type LineWidth,
    type CandlestickSeriesPartialOptions,
} from 'lightweight-charts';
import React, { useEffect, useImperativeHandle, useRef, useState, memo } from 'react';
import { useTradingProStore } from '../store/store';

interface ChartComponentProps {
    data: CandlestickData<UTCTimestamp>[];
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
        vertLine: { labelVisible: false }
    },
    autoSize: true,
};

// This is no longer a constant, it will be derived from the store.
// const seriesOptions: CandlestickSeriesPartialOptions = { ... };

const ChartComponentImpl = React.forwardRef<ChartHandle, ChartComponentProps>(
    ({ data, onVisibleLogicalRangeChange, onChartClick, isClickArmed, shouldRescale, replayScrollToTime, onReplayScrolled }, ref) => {
        const chartContainerRef = useRef<HTMLDivElement>(null);
        const chartRef = useRef<IChartApi | null>(null);
        const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
        const [tooltip, setTooltip] = useState<{ visible: boolean, x: number, y: number, content: string }>({ visible: false, x: 0, y: 0, content: '' });

        const chartAppearance = useTradingProStore((state) => state.chartAppearance);
        // --- NEW: Get candlestick colors from the store ---
        const candlestickColors = useTradingProStore((state) => state.candlestickColors);

        useImperativeHandle(ref, () => ({
            scrollToRealtime: () => chartRef.current?.timeScale().scrollToRealTime(),
            scrollToTime: (time) => {
                const chart = chartRef.current;
                if (!chart) return;
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
                }
            });
            chartRef.current = chart;
            // --- MODIFIED: Use initial candlestick colors from the store ---
            const series = chart.addSeries(CandlestickSeries, candlestickColors);
            seriesRef.current = series;
            
            return () => {
                chart.remove();
            };
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);

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

        // --- NEW: Add a useEffect to apply candlestick color changes ---
        useEffect(() => {
            if (!seriesRef.current) return;
            seriesRef.current.applyOptions(candlestickColors);
        }, [candlestickColors]);


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
            const handleCrosshairMove = (param: MouseEventParams) => {
              if (!param.point || !param.time || !seriesRef.current || !param.seriesData.has(seriesRef.current)) {
                  setTooltip(prev => ({ ...prev, visible: false }));
                  return;
              }
              const date = new Date((param.time as number) * 1000);
              const options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false };
              const formattedTime = new Intl.DateTimeFormat('en-GB', options).format(date).replace(/,/g, '');
              setTooltip({ visible: true, x: param.point.x, y: param.point.y, content: formattedTime });
            };

            const handleClick = (param: MouseEventParams) => {
              if (isClickArmed && param.time && typeof param.time === 'number') {
                  onChartClick(param.time);
              }
            }
            const rangeChangeHandler = (range: LogicalRange | null) => onVisibleLogicalRangeChange(range);
            chart.subscribeCrosshairMove(handleCrosshairMove);
            chart.subscribeClick(handleClick);
            chart.timeScale().subscribeVisibleLogicalRangeChange(rangeChangeHandler);
            return () => {
                if (chartRef.current) {
                    chart.unsubscribeCrosshairMove(handleCrosshairMove);
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

        return (
            <div ref={chartContainerRef} className='w-full h-full relative cursor-crosshair'>
                {tooltip.visible && (
                    <div 
                        className='absolute z-10 py-1 px-2 bg-gray-700 bg-opacity-80 backdrop-blur-sm text-white text-[11px] rounded-md pointer-events-none' 
                        style={{ bottom: '2px', left: `${tooltip.x}px`, transform: 'translateX(-50%)' }}
                    >
                        {tooltip.content}
                    </div>
                )}
            </div>
        );
    }
);

export const ChartComponent = memo(ChartComponentImpl);