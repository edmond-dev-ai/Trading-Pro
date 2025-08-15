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

interface TrendlinePoint {
    time: UTCTimestamp;
    price: number;
}

export interface TrendlineData {
    id: string;
    points: TrendlinePoint[];
    color: string;
    width: number;
    lineStyle?: LineStyle; // MODIFIED: Added lineStyle property
    isHovered?: boolean;
    selectedPointIndex?: number | null;
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

class TrendlineRenderer implements IPrimitivePaneRenderer {
    private _data: TrendlineData;
    private _series: ISeriesApi<"Candlestick", Time>;
    private _chart: IChartApi;

    constructor(data: TrendlineData, series: ISeriesApi<"Candlestick", Time>, chart: IChartApi) {
        this._data = data;
        this._series = series;
        this._chart = chart;
    }

    draw(target: any) {
        target.useBitmapCoordinateSpace((scope: any) => {
            const ctx = scope.context;
            if (this._data.points.length < 2) return;

            const timeScale = this._chart.timeScale();
            const p1 = {
                x: timeScale.timeToCoordinate(this._data.points[0].time),
                y: this._series.priceToCoordinate(this._data.points[0].price),
            };
            const p2 = {
                x: timeScale.timeToCoordinate(this._data.points[1].time),
                y: this._series.priceToCoordinate(this._data.points[1].price),
            };

            if (p1.x !== null && p1.y !== null && p2.x !== null && p2.y !== null) {
                const hoverColor = '#FFC107'; // A bright yellow for hover
                
                // MODIFIED: Main line always uses its own color and style
                ctx.beginPath();
                ctx.strokeStyle = this._data.color;
                ctx.lineWidth = this._data.width;
                ctx.setLineDash(toLineStyle(this._data.lineStyle));
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
                
                // MODIFIED: Draw selection handles with hover color only when hovered
                if (this._data.isHovered) {
                    const handleStrokeStyle = hoverColor;

                    // Draw handle for point 1
                    ctx.beginPath();
                    ctx.fillStyle = this._data.selectedPointIndex === 0 ? hoverColor : 'white';
                    ctx.strokeStyle = handleStrokeStyle;
                    ctx.lineWidth = 1;
                    ctx.arc(p1.x, p1.y, 6, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.stroke();
                    
                    // Draw handle for point 2
                    ctx.beginPath();
                    ctx.fillStyle = this._data.selectedPointIndex === 1 ? hoverColor : 'white';
                    ctx.strokeStyle = handleStrokeStyle;
                    ctx.lineWidth = 1;
                    ctx.arc(p2.x, p2.y, 6, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.stroke();
                }
            }
        });
    }
}

class TrendlinePaneView implements IPrimitivePaneView {
    private _data: TrendlineData;
    private _series: ISeriesApi<"Candlestick", Time>;
    private _chart: IChartApi;

    constructor(data: TrendlineData, series: ISeriesApi<"Candlestick", Time>, chart: IChartApi) {
        this._data = data;
        this._series = series;
        this._chart = chart;
    }

    update(data: TrendlineData): void {
        this._data = data;
    }

    renderer(): IPrimitivePaneRenderer | null {
        return new TrendlineRenderer(this._data, this._series, this._chart);
    }

    zOrder(): PrimitivePaneViewZOrder {
        return 'top';
    }
}

export class TrendlinePrimitive implements ISeriesPrimitive {
    private _paneViews: TrendlinePaneView[] = [];
    private _data: TrendlineData | null = null;
    private _series: ISeriesApi<"Candlestick", Time> | null = null;
    private _chart: IChartApi | null = null;

    attached({ chart, series }: SeriesAttachedParameter): void {
        this._series = series as ISeriesApi<"Candlestick", Time>;
        this._chart = chart;
        this._updatePaneViews();
    }

    updateData(data: TrendlineData): void {
        this._data = data;
        this._updatePaneViews();
    }

    paneViews(): readonly IPrimitivePaneView[] {
        return this._paneViews;
    }

    _updatePaneViews() {
        if (!this._series || !this._data || !this._chart) return;
        this._paneViews = [new TrendlinePaneView(this._data, this._series, this._chart)];
    }
}
