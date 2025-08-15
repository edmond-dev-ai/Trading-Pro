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

export interface VerticalLineData {
    id: string;
    time: UTCTimestamp;
    color: string;
    width: number;
    lineStyle?: LineStyle; // MODIFIED: Added lineStyle property
    isHovered?: boolean;
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

class VerticalLineRenderer implements IPrimitivePaneRenderer {
    private _data: VerticalLineData;
    private _series: ISeriesApi<"Candlestick", Time>;
    private _chart: IChartApi;

    constructor(data: VerticalLineData, series: ISeriesApi<"Candlestick", Time>, chart: IChartApi) {
        this._data = data;
        this._series = series;
        this._chart = chart;
    }

    draw(target: any) {
        target.useBitmapCoordinateSpace((scope: any) => {
            const ctx = scope.context;
            
            const timeScale = this._chart.timeScale();
            const x = timeScale.timeToCoordinate(this._data.time);
            
            if (x === null) return;

            const hoverColor = '#FFC107'; // Bright yellow for hover

            // MODIFIED: Draw the vertical line with its own color and style
            ctx.beginPath();
            ctx.strokeStyle = this._data.color;
            ctx.lineWidth = this._data.width;
            ctx.setLineDash(toLineStyle(this._data.lineStyle));
            ctx.moveTo(x, 0);
            ctx.lineTo(x, scope.bitmapSize.height);
            ctx.stroke();

            // MODIFIED: Draw selection handle with hover color only when hovered
            if (this._data.isHovered) {
                const midY = scope.bitmapSize.height / 2;
                
                ctx.beginPath();
                ctx.fillStyle = 'white';
                ctx.strokeStyle = hoverColor;
                ctx.lineWidth = 2;
                ctx.arc(x, midY, 6, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
            }
        });
    }
}

class VerticalLinePaneView implements IPrimitivePaneView {
    private _data: VerticalLineData;
    private _series: ISeriesApi<"Candlestick", Time>;
    private _chart: IChartApi;

    constructor(data: VerticalLineData, series: ISeriesApi<"Candlestick", Time>, chart: IChartApi) {
        this._data = data;
        this._series = series;
        this._chart = chart;
    }

    update(data: VerticalLineData): void {
        this._data = data;
    }

    renderer(): IPrimitivePaneRenderer | null {
        return new VerticalLineRenderer(this._data, this._series, this._chart);
    }

    zOrder(): PrimitivePaneViewZOrder {
        return 'top';
    }
}

export class VerticalLinePrimitive implements ISeriesPrimitive {
    private _paneViews: VerticalLinePaneView[] = [];
    private _data: VerticalLineData | null = null;
    private _series: ISeriesApi<"Candlestick", Time> | null = null;
    private _chart: IChartApi | null = null;

    attached({ chart, series }: SeriesAttachedParameter): void {
        this._series = series as ISeriesApi<"Candlestick", Time>;
        this._chart = chart;
        this._updatePaneViews();
    }

    updateData(data: VerticalLineData): void {
        this._data = data;
        this._updatePaneViews();
    }

    paneViews(): readonly IPrimitivePaneView[] {
        return this._paneViews;
    }

    _updatePaneViews() {
        if (!this._series || !this._data || !this._chart) return;
        this._paneViews = [new VerticalLinePaneView(this._data, this._series, this._chart)];
    }
}
