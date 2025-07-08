import {
    createChart, ColorType, CrosshairMode, CandlestickSeries,
    type IChartApi, type ISeriesApi, type CandlestickData, type UTCTimestamp,
    type LogicalRange, type MouseEventParams, type LineWidth,
    type CandlestickSeriesPartialOptions,
} from 'lightweight-charts';
import React, { useEffect, useImperativeHandle, useRef, useState, memo } from 'react';

interface ChartComponentProps {
    data: CandlestickData<UTCTimestamp>[];
    onVisibleLogicalRangeChange: (range: LogicalRange | null) => void;
    onChartClick: (time: UTCTimestamp) => void;
    isClickArmed: boolean;
    shouldRescale: boolean;
    shouldScrollToReplayStart: boolean;
    onReplayScrolled: () => void;
}

export type ChartHandle = {
    scrollToRealtime: () => void;
    scrollToTime: (time: UTCTimestamp) => void;
};

const chartOptions = {
    layout: { background: { type: ColorType.Solid, color: '#111827' }, textColor: '#d1d5db' },
    grid: { vertLines: { color: '#374151' }, horzLines: { color: '#374151' } },
    timeScale: { 
        timeVisible: true, 
        secondsVisible: false, 
        borderVisible: false,
        rightBarStaysOnScroll: false,
        fixRightEdge: false,
    },
    handleScroll: {
        horzDrag: true,
        mouseWheel: true,
        pressedMouseMove: true,
    },
    handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
    },
    crosshair: { 
        mode: CrosshairMode.Normal,
        horzLine: { labelVisible: false },
        vertLine: { labelVisible: false }
    },
};

const seriesOptions: CandlestickSeriesPartialOptions = {
    upColor: '#22c55e', downColor: '#ef4444', borderDownColor: '#ef4444',
    borderUpColor: '#22c55e', wickDownColor: '#ef4444', wickUpColor: '#22c55e',
};

const ChartComponentImpl = React.forwardRef<ChartHandle, ChartComponentProps>(
    ({ data, onVisibleLogicalRangeChange, onChartClick, isClickArmed, shouldRescale, shouldScrollToReplayStart, onReplayScrolled }, ref) => {
        const chartContainerRef = useRef<HTMLDivElement>(null);
        const chartRef = useRef<IChartApi | null>(null);
        const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
        const [tooltip, setTooltip] = useState<{ visible: boolean, x: number, y: number, content: string }>({ visible: false, x: 0, y: 0, content: '' });

        useImperativeHandle(ref, () => ({
            scrollToRealtime: () => chartRef.current?.timeScale().scrollToRealTime(),
            scrollToTime: (time) => {
                const chart = chartRef.current;
                if (!chart) return;
                const dataIndex = data.findIndex(d => d.time === time);
                if (dataIndex !== -1) {
                    chart.timeScale().scrollToPosition(dataIndex, true);
                }
            },
        }));

        useEffect(() => {
            if (!chartContainerRef.current) return;
            const chart = createChart(chartContainerRef.current, { ...chartOptions, width: chartContainerRef.current.clientWidth, height: chartContainerRef.current.clientHeight });
            chartRef.current = chart;
            const series = chart.addSeries(CandlestickSeries, seriesOptions);
            seriesRef.current = series;
            
            const handleResize = () => chart.resize(chartContainerRef.current!.clientWidth, chartContainerRef.current!.clientHeight);
            window.addEventListener('resize', handleResize);
            return () => {
                window.removeEventListener('resize', handleResize);
                chart.remove();
            };
        }, []);

        useEffect(() => {
            const chart = chartRef.current;
            if (!chart || !seriesRef.current) return;

            seriesRef.current.setData(data);
            
            // THE FIX: Only call fitContent when explicitly told to.
            if (shouldRescale && data.length > 0) {
                chart.timeScale().fitContent();
            }
            if (shouldScrollToReplayStart && data.length > 0) {
                chart.timeScale().scrollToRealTime();
                onReplayScrolled();
            }
        }, [data, shouldRescale, shouldScrollToReplayStart, onReplayScrolled]);

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
            if (chartContainerRef.current) {
                chartContainerRef.current.style.cursor = isClickArmed ? 'crosshair' : 'default';
            }
            chartRef.current?.applyOptions({
                crosshair: {
                    vertLine: { width: (isClickArmed ? 2 : 1) as LineWidth },
                    horzLine: { width: (isClickArmed ? 2 : 1) as LineWidth },
                }
            });
        }, [isClickArmed]);

        return (
            <div ref={chartContainerRef} className='w-full h-full relative'>
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
