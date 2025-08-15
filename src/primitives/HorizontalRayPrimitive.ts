import {
    type ISeriesPrimitive,
    type IPrimitivePaneView,
    type PrimitivePaneViewZOrder,
    type IPrimitivePaneRenderer,
    type SeriesAttachedParameter,
    type Time,
    type UTCTimestamp,
    type ISeriesApi,
    type IChartApi,
} from 'lightweight-charts';
import type { LineStyle } from '../store/store'; // MODIFIED: Import LineStyle type

export interface HorizontalRayData {
    id: string;
    time: UTCTimestamp;
    price: number;
    color: string;
    width: number;
    lineStyle?: LineStyle; // MODIFIED: Added lineStyle property
    isHovered?: boolean;
    hoveredPointIndex?: number | null;
}

// MODIFIED: Helper to convert lineStyle string to Lightweight Charts line style enum
const toLineStyle = (style: LineStyle = 'Solid'): number[] => {
    switch (style) {
        case 'Dashed': return [4, 4];
        case 'Dotted': return [1, 2];
        case 'Solid':
        default: return []; // Empty array means solid line
    }
};

class HorizontalRayRenderer implements IPrimitivePaneRenderer {
    private _data: HorizontalRayData;
    private _series: ISeriesApi<"Candlestick", Time>;
    private _chart: IChartApi;

    constructor(data: HorizontalRayData, series: ISeriesApi<"Candlestick", Time>, chart: IChartApi) {
        this._data = data;
        this._series = series;
        this._chart = chart;
    }

    draw(target: any) {
        target.useBitmapCoordinateSpace((scope: any) => {
            const ctx = scope.context;
            
            const timeScale = this._chart.timeScale();
            const startX = timeScale.timeToCoordinate(this._data.time);
            const y = this._series.priceToCoordinate(this._data.price);
            
            if (startX === null || y === null) return;

            const hoverColor = '#FFC107'; // Bright yellow for hover

            // MODIFIED: Draw the horizontal ray with its own color and style
            ctx.beginPath();
            ctx.strokeStyle = this._data.color;
            ctx.lineWidth = this._data.width;
            ctx.setLineDash(toLineStyle(this._data.lineStyle));
            ctx.moveTo(startX, y);
            ctx.lineTo(scope.bitmapSize.width, y); // Extend to right edge
            ctx.stroke();

            // MODIFIED: Draw starting point marker with hover color only when hovered
            if (this._data.isHovered) {
                const handleStrokeStyle = hoverColor;
                // Draw starting point handle
                ctx.beginPath();
                ctx.fillStyle = 'white';
                ctx.strokeStyle = handleStrokeStyle;
                ctx.lineWidth = 2;
                ctx.arc(startX, y, 6, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();

                // If hovering over the starting point specifically, add extra visual feedback
                if (this._data.hoveredPointIndex === 0) {
                    ctx.beginPath();
                    ctx.fillStyle = handleStrokeStyle;
                    ctx.arc(startX, y, 3, 0, 2 * Math.PI);
                    ctx.fill();
                }
            }
        });
    }
}

class HorizontalRayPaneView implements IPrimitivePaneView {
    private _data: HorizontalRayData;
    private _series: ISeriesApi<"Candlestick", Time>;
    private _chart: IChartApi;

    constructor(data: HorizontalRayData, series: ISeriesApi<"Candlestick", Time>, chart: IChartApi) {
        this._data = data;
        this._series = series;
        this._chart = chart;
    }

    update(data: HorizontalRayData): void {
        this._data = data;
    }

    renderer(): IPrimitivePaneRenderer | null {
        return new HorizontalRayRenderer(this._data, this._series, this._chart);
    }

    zOrder(): PrimitivePaneViewZOrder {
        return 'top';
    }
}

export class HorizontalRayPrimitive implements ISeriesPrimitive {
    private _paneViews: HorizontalRayPaneView[] = [];
    private _data: HorizontalRayData | null = null;
    private _series: ISeriesApi<"Candlestick", Time> | null = null;
    private _chart: IChartApi | null = null;

    attached({ chart, series }: SeriesAttachedParameter): void {
        this._series = series as ISeriesApi<"Candlestick", Time>;
        this._chart = chart;
        this._updatePaneViews();
    }

    updateData(data: HorizontalRayData): void {
        this._data = data;
        this._updatePaneViews();
    }

    paneViews(): readonly IPrimitivePaneView[] {
        return this._paneViews;
    }

    _updatePaneViews() {
        if (!this._series || !this._data || !this._chart) return;
        this._paneViews = [new HorizontalRayPaneView(this._data, this._series, this._chart)];
    }
}
