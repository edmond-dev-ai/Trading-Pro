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
import type { LineStyle } from '../store/store'; // Import LineStyle type

interface RectanglePoint {
    time: UTCTimestamp;
    price: number;
}

export interface RectangleData {
    id: string;
    points: [RectanglePoint, RectanglePoint]; // Two diagonal corners
    color: string; // Main color (used for border)
    width: number; // Border width
    lineStyle?: LineStyle;
    fillColor?: string; // Fill color from defaults/settings
    isHovered?: boolean;
    selectedPointIndex?: number | null; // To match your existing pattern
}

// Helper to convert lineStyle string to Lightweight Charts line style enum
const toLineStyle = (style: LineStyle = 'Solid'): number[] => {
    switch (style) {
        case 'Dashed': return [4, 4];
        case 'Dotted': return [1, 2];
        case 'Solid':
        default: return []; // Empty array means solid line
    }
};

class RectangleRenderer implements IPrimitivePaneRenderer {
    private _data: RectangleData;
    private _series: ISeriesApi<"Candlestick", Time>;
    private _chart: IChartApi;

    constructor(data: RectangleData, series: ISeriesApi<"Candlestick", Time>, chart: IChartApi) {
        this._data = data;
        this._series = series;
        this._chart = chart;
    }

    draw(target: any) {
        target.useBitmapCoordinateSpace((scope: any) => {
            const ctx = scope.context;
            if (this._data.points.length < 2) return;

            const timeScale = this._chart.timeScale();
            
            // Get coordinates for both points
            const p1 = {
                x: timeScale.timeToCoordinate(this._data.points[0].time),
                y: this._series.priceToCoordinate(this._data.points[0].price),
            };
            const p2 = {
                x: timeScale.timeToCoordinate(this._data.points[1].time),
                y: this._series.priceToCoordinate(this._data.points[1].price),
            };

            if (p1.x === null || p1.y === null || p2.x === null || p2.y === null) return;

            // Calculate rectangle bounds
            const left = Math.min(p1.x, p2.x);
            const right = Math.max(p1.x, p2.x);
            const top = Math.min(p1.y, p2.y);
            const bottom = Math.max(p1.y, p2.y);
            const width = right - left;
            const height = bottom - top;

            // Draw fill if specified
            if (this._data.fillColor) {
                ctx.fillStyle = this._data.fillColor;
                ctx.globalAlpha = 0.1; // Default opacity
                ctx.fillRect(left, top, width, height);
                ctx.globalAlpha = 1; // Reset alpha
            }

            // Draw border
            ctx.strokeStyle = this._data.color;
            ctx.lineWidth = this._data.width;
            ctx.setLineDash(toLineStyle(this._data.lineStyle));
            ctx.strokeRect(left, top, width, height);
            ctx.setLineDash([]); // Reset line dash

            // Draw selection handles when hovered
            if (this._data.isHovered) {
                const hoverColor = '#FFC107'; // Bright yellow for hover
                const handleSize = 6;
                
                // Corner handles
                const corners = [
                    { x: left, y: top },
                    { x: right, y: top },
                    { x: left, y: bottom },
                    { x: right, y: bottom },
                ];

                // Edge handles (midpoints)
                const edges = [
                    { x: left + width / 2, y: top },
                    { x: right, y: top + height / 2 },
                    { x: left + width / 2, y: bottom },
                    { x: left, y: top + height / 2 },
                ];

                // Draw corner handles
                corners.forEach(corner => {
                    ctx.beginPath();
                    ctx.fillStyle = 'white';
                    ctx.strokeStyle = hoverColor;
                    ctx.lineWidth = 1;
                    ctx.rect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize);
                    ctx.fill();
                    ctx.stroke();
                });

                // Draw edge handles
                edges.forEach(edge => {
                    ctx.beginPath();
                    ctx.fillStyle = 'white';
                    ctx.strokeStyle = hoverColor;
                    ctx.lineWidth = 1;
                    ctx.arc(edge.x, edge.y, handleSize / 2, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.stroke();
                });
            }
        });
    }
}

class RectanglePaneView implements IPrimitivePaneView {
    private _data: RectangleData;
    private _series: ISeriesApi<"Candlestick", Time>;
    private _chart: IChartApi;

    constructor(data: RectangleData, series: ISeriesApi<"Candlestick", Time>, chart: IChartApi) {
        this._data = data;
        this._series = series;
        this._chart = chart;
    }

    update(data: RectangleData): void {
        this._data = data;
    }

    renderer(): IPrimitivePaneRenderer | null {
        return new RectangleRenderer(this._data, this._series, this._chart);
    }

    zOrder(): PrimitivePaneViewZOrder {
        return 'top';
    }
}

export class RectanglePrimitive implements ISeriesPrimitive {
    private _paneViews: RectanglePaneView[] = [];
    private _data: RectangleData | null = null;
    private _series: ISeriesApi<"Candlestick", Time> | null = null;
    private _chart: IChartApi | null = null;

    attached({ chart, series }: SeriesAttachedParameter): void {
        this._series = series as ISeriesApi<"Candlestick", Time>;
        this._chart = chart;
        this._updatePaneViews();
    }

    updateData(data: RectangleData): void {
        this._data = data;
        this._updatePaneViews();
    }

    paneViews(): readonly IPrimitivePaneView[] {
        return this._paneViews;
    }

    _updatePaneViews() {
        if (!this._series || !this._data || !this._chart) return;
        this._paneViews = [new RectanglePaneView(this._data, this._series, this._chart)];
    }
}