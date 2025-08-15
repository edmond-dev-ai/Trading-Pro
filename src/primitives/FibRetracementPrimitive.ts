import type {
    ISeriesPrimitive,
    IPrimitivePaneView,
    PrimitivePaneViewZOrder,
    IPrimitivePaneRenderer,
    SeriesAttachedParameter,
    Time,
    ISeriesApi,
    IChartApi,
} from 'lightweight-charts';
import type { DrawingPoint, LineStyle } from '../store/store';

export interface FibRetracementLevel {
    value: number;
    label: string;
    color: string;
    lineStyle: LineStyle;
}

export interface FibRetracementData {
    id: string;
    points: [DrawingPoint, DrawingPoint];
    color: string;
    width: number;
    lineStyle?: LineStyle;
    showLabels: boolean;
    levels: FibRetracementLevel[];
    isHovered?: boolean;
    selectedPointIndex?: number | null;
}

const toLineStyle = (style: LineStyle = 'Solid'): number[] => {
    switch (style) {
        case 'Dashed': return [4, 4];
        case 'Dotted': return [1, 2];
        case 'Solid':
        default: return [];
    }
};

class FibRetracementRenderer implements IPrimitivePaneRenderer {
    private _data: FibRetracementData;
    private _series: ISeriesApi<"Candlestick", Time>;
    private _chart: IChartApi;

    constructor(data: FibRetracementData, series: ISeriesApi<"Candlestick", Time>, chart: IChartApi) {
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

            if (p1.x === null || p1.y === null || p2.x === null || p2.y === null) return;

            const hoverColor = '#FFC107';

            ctx.beginPath();
            ctx.strokeStyle = this._data.color;
            ctx.lineWidth = this._data.width;
            ctx.setLineDash(toLineStyle(this._data.lineStyle));
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();

            const isLeftToRight = p1.x < p2.x;

            this._data.levels.forEach(level => {
                const priceRange = this._data.points[0].price - this._data.points[1].price;
                const levelPrice = this._data.points[0].price - (priceRange * level.value);
                const levelY = this._series.priceToCoordinate(levelPrice);

                if (levelY === null) return;

                ctx.beginPath();
                ctx.strokeStyle = level.color;
                ctx.lineWidth = this._data.width;
                ctx.setLineDash(toLineStyle(level.lineStyle));
                ctx.moveTo(p1.x!, levelY);
                ctx.lineTo(p2.x!, levelY); // MODIFIED: Added non-null assertion
                ctx.stroke();

                if (this._data.showLabels) {
                    ctx.fillStyle = level.color;
                    ctx.font = '10px Arial';
                    ctx.textBaseline = 'middle';

                    const labelPadding = 5;
                    const labelX = isLeftToRight ? p2.x! + labelPadding : p2.x! - labelPadding; // MODIFIED: Added non-null assertion
                    ctx.textAlign = isLeftToRight ? 'left' : 'right';

                    const priceFormatter = this._series.priceFormatter();
                    const formattedPrice = priceFormatter.format(levelPrice);

                    ctx.fillText(level.label, p1.x! + (isLeftToRight ? labelPadding : -labelPadding), levelY); // MODIFIED: Added non-null assertion
                    ctx.fillText(formattedPrice, labelX, levelY);
                }
            });

            if (this._data.isHovered) {
                const handleRadius = 6;
                const handleFillColor = 'white';
                const handleStrokeColor = hoverColor;

                ctx.beginPath();
                ctx.fillStyle = this._data.selectedPointIndex === 0 ? hoverColor : handleFillColor;
                ctx.strokeStyle = handleStrokeColor;
                ctx.lineWidth = 1.5;
                ctx.arc(p1.x!, p1.y!, handleRadius, 0, 2 * Math.PI); // MODIFIED: Added non-null assertion
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.fillStyle = this._data.selectedPointIndex === 1 ? hoverColor : handleFillColor;
                ctx.strokeStyle = handleStrokeColor;
                ctx.lineWidth = 1.5;
                ctx.arc(p2.x!, p2.y!, handleRadius, 0, 2 * Math.PI); // MODIFIED: Added non-null assertion
                ctx.fill();
                ctx.stroke();
            }
        });
    }
}

class FibRetracementPaneView implements IPrimitivePaneView {
    private _data: FibRetracementData;
    private _series: ISeriesApi<"Candlestick", Time>;
    private _chart: IChartApi;

    constructor(data: FibRetracementData, series: ISeriesApi<"Candlestick", Time>, chart: IChartApi) {
        this._data = data;
        this._series = series;
        this._chart = chart;
    }

    update(data: FibRetracementData): void {
        this._data = data;
    }

    renderer(): IPrimitivePaneRenderer | null {
        return new FibRetracementRenderer(this._data, this._series, this._chart);
    }

    zOrder(): PrimitivePaneViewZOrder {
        return 'top';
    }
}

export class FibRetracementPrimitive implements ISeriesPrimitive {
    private _paneViews: FibRetracementPaneView[] = [];
    private _data: FibRetracementData | null = null;
    private _series: ISeriesApi<"Candlestick", Time> | null = null;
    private _chart: IChartApi | null = null;

    attached({ chart, series }: SeriesAttachedParameter): void {
        this._series = series as ISeriesApi<"Candlestick", Time>;
        this._chart = chart;
        this._updatePaneViews();
    }

    updateData(data: FibRetracementData): void {
        this._data = data;
        this._updatePaneViews();
    }

    paneViews(): readonly IPrimitivePaneView[] {
        return this._paneViews;
    }

    _updatePaneViews() {
        if (!this._series || !this._data || !this._chart) return;
        this._paneViews = [new FibRetracementPaneView(this._data, this._series, this._chart)];
    }
}
