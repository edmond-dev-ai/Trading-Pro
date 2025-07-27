// src/hooks/useDrawingService.ts
import { useState, useCallback, useRef } from 'react';
import { useTradingProStore, type DrawingPoint, type TrendlineDrawing } from '../store/store';
import type { IChartApi, ISeriesApi, UTCTimestamp, MouseEventParams } from 'lightweight-charts';

export type InProgressDrawing = {
    type: 'trendline';
    points: [DrawingPoint, DrawingPoint];
};

export const useDrawingService = () => {
    const { activeDrawingTool, addDrawing, setActiveDrawingTool } = useTradingProStore();
    const [inProgressDrawing, setInProgressDrawing] = useState<InProgressDrawing | null>(null);

    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const isDrawingRef = useRef(false);

    const init = useCallback((chart: IChartApi, series: ISeriesApi<'Candlestick'>) => {
        chartRef.current = chart;
        seriesRef.current = series;
    }, []);

    const handleChartClick = useCallback((param: MouseEventParams) => {
        // --- FIX: Ensure param.time is a number (UTCTimestamp) ---
        if (!param.point || !param.time || typeof param.time !== 'number' || activeDrawingTool !== 'trendline') {
            return;
        }

        const chart = chartRef.current;
        const mainSeries = seriesRef.current;
        if (!chart || !mainSeries) return;

        const price = mainSeries.coordinateToPrice(param.point.y);
        if (price === null) return;

        const newPoint: DrawingPoint = { time: param.time, price };

        if (!isDrawingRef.current) {
            isDrawingRef.current = true;
            setInProgressDrawing({
                type: 'trendline',
                points: [newPoint, newPoint]
            });
        } else {
            if (inProgressDrawing) {
                const finalDrawing: TrendlineDrawing = {
                    id: `trend_${Date.now()}`,
                    type: 'trendline',
                    points: [inProgressDrawing.points[0], newPoint]
                };
                addDrawing(finalDrawing);
            }
            isDrawingRef.current = false;
            setInProgressDrawing(null);
            setActiveDrawingTool(null);
        }
    }, [activeDrawingTool, inProgressDrawing, addDrawing, setActiveDrawingTool]);

    const handleCrosshairMove = useCallback((param: MouseEventParams) => {
        // --- FIX: Ensure param.time is a number (UTCTimestamp) ---
        if (!isDrawingRef.current || !inProgressDrawing || !param.point || !param.time || typeof param.time !== 'number') {
            return;
        }
        
        const mainSeries = seriesRef.current;
        if (!mainSeries) return;

        const price = mainSeries.coordinateToPrice(param.point.y);
        if (price === null) return;

        const newPoint: DrawingPoint = { time: param.time, price };

        setInProgressDrawing(prev => prev ? { ...prev, points: [prev.points[0], newPoint] } : null);

    }, [inProgressDrawing]);

    return {
        init,
        handleChartClick,
        handleCrosshairMove,
        inProgressDrawing,
    };
};
