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
import type { DrawingPoint } from '../store/store';

export interface PositionDrawingData {
    id: string;
    type: 'long-position' | 'short-position';
    entryPoint: DrawingPoint;
    profitPoint: DrawingPoint;
    stopPoint: DrawingPoint;
    endPoint?: DrawingPoint; // Defines the end time of the box
    profitColor: string;
    stopColor: string;
    lineColor: string;
    lineWidth: number;
    isHovered?: boolean; // Kept for general selection state
    hoveredPart?: 'ENTIRE_POSITION' | 'PROFIT_LINE' | 'STOP_LINE' | 'ENTRY_LINE' | 'RIGHT_EDGE' | null;
}

class PositionRenderer implements IPrimitivePaneRenderer {
    private _data: PositionDrawingData;
    private _series: ISeriesApi<"Candlestick", Time>;
    private _chart: IChartApi;

    constructor(data: PositionDrawingData, series: ISeriesApi<"Candlestick", Time>, chart: IChartApi) {
        this._data = data;
        this._series = series;
        this._chart = chart;
    }

    draw(target: any) {
        target.useBitmapCoordinateSpace((scope: any) => {
            const ctx = scope.context;
            const timeScale = this._chart.timeScale();
            
            const entryY = this._series.priceToCoordinate(this._data.entryPoint.price);
            const profitY = this._series.priceToCoordinate(this._data.profitPoint.price);
            const stopY = this._series.priceToCoordinate(this._data.stopPoint.price);
            const entryX = timeScale.timeToCoordinate(this._data.entryPoint.time);
            
            // FIX: Check if endPoint exists before getting its time
            const endX = timeScale.timeToCoordinate(this._data.endPoint?.time ?? (Date.now() / 1000) as UTCTimestamp);

            if (entryY === null || profitY === null || stopY === null || entryX === null || endX === null) return;

            const boxWidth = endX - entryX;

            // FIX: Set global alpha for transparency
            ctx.globalAlpha = 0.2;

            // Draw Profit Zone with green fill
            ctx.fillStyle = this._data.profitColor;
            ctx.fillRect(entryX, Math.min(entryY, profitY), boxWidth, Math.abs(profitY - entryY));

            // Draw Stop Zone with red fill
            ctx.fillStyle = this._data.stopColor;
            ctx.fillRect(entryX, Math.min(entryY, stopY), boxWidth, Math.abs(stopY - entryY));
            
            // FIX: Reset global alpha before drawing solid lines and text
            ctx.globalAlpha = 1.0;

            // Draw lines and labels
            this._drawLines(ctx, entryX, endX, entryY, stopY, profitY);
            this._drawLabels(ctx, entryX, endX, entryY, stopY, profitY);
            this._drawHandlesAndHighlights(ctx, entryX, endX, entryY, stopY, profitY);
        });
    }

    private _drawLines(ctx: any, entryX: number, endX: number, entryY: number, stopY: number, profitY: number) {
        ctx.lineWidth = this._data.lineWidth;

        // Entry Line
        ctx.strokeStyle = this._data.lineColor;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(entryX, entryY);
        ctx.lineTo(endX, entryY);
        ctx.stroke();

        // Stop Loss Line
        ctx.strokeStyle = this._data.stopColor;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(entryX, stopY);
        ctx.lineTo(endX, stopY);
        ctx.stroke();

        // Take Profit Line
        ctx.strokeStyle = this._data.profitColor;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(entryX, profitY);
        ctx.lineTo(endX, profitY);
        ctx.stroke();

        // Right Edge (vertical line)
        ctx.strokeStyle = this._data.lineColor;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(endX, Math.min(stopY, profitY));
        ctx.lineTo(endX, Math.max(stopY, profitY));
        ctx.stroke();
    }
    
    private _drawHandlesAndHighlights(ctx: any, entryX: number, endX: number, entryY: number, stopY: number, profitY: number) {
        if (!this._data.isHovered) return;
        
        const hoverColor = '#FFC107';
        const handleRadius = 4;
        const bodyTop = Math.min(profitY, stopY);
        const bodyBottom = Math.max(profitY, stopY);

        // Draw border around the entire shape
        ctx.strokeStyle = hoverColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.strokeRect(entryX, bodyTop, endX - entryX, bodyBottom - bodyTop);

        // Highlight the specific hovered part
        ctx.fillStyle = 'rgba(255, 193, 7, 0.2)'; // Semi-transparent yellow
        ctx.strokeStyle = hoverColor;
        ctx.lineWidth = 2;
        ctx.setLineDash([]);

        switch(this._data.hoveredPart) {
            case 'PROFIT_LINE':
                ctx.beginPath();
                ctx.moveTo(entryX, profitY);
                ctx.lineTo(endX, profitY);
                ctx.stroke();
                break;
            case 'STOP_LINE':
                ctx.beginPath();
                ctx.moveTo(entryX, stopY);
                ctx.lineTo(endX, stopY);
                ctx.stroke();
                break;
            case 'ENTRY_LINE':
                ctx.beginPath();
                ctx.moveTo(entryX, bodyTop);
                ctx.lineTo(entryX, bodyBottom);
                ctx.stroke();
                break;
            case 'RIGHT_EDGE':
                ctx.beginPath();
                ctx.moveTo(endX, bodyTop);
                ctx.lineTo(endX, bodyBottom);
                ctx.stroke();
                break;
            case 'ENTIRE_POSITION':
                ctx.fillRect(entryX, bodyTop, endX - entryX, bodyBottom - bodyTop);
                break;
        }

        // Draw handles at key points
        const handles = [
            { x: entryX, y: entryY },
            { x: entryX, y: profitY },
            { x: entryX, y: stopY },
            { x: endX, y: profitY },
            { x: endX, y: stopY },
            { x: endX, y: entryY },
        ];
        
        ctx.fillStyle = 'white';
        ctx.strokeStyle = hoverColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        handles.forEach(handle => {
            ctx.beginPath();
            ctx.arc(handle.x, handle.y, handleRadius, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
        });
    }

    private _drawLabels(ctx: any, entryX: number, endX: number, entryY: number, stopY: number, profitY: number) {
        ctx.font = '12px Arial';
        ctx.textBaseline = 'middle';
        
        const priceFormatter = this._series.priceFormatter();
        
        const profitDistance = this._data.profitPoint.price !== null && this._data.entryPoint.price !== null
            ? Math.abs(this._data.profitPoint.price - this._data.entryPoint.price)
            : 0;
            
        const stopDistance = this._data.entryPoint.price !== null && this._data.stopPoint.price !== null
            ? Math.abs(this._data.entryPoint.price - this._data.stopPoint.price)
            : 0;
            
        const riskRewardRatio = stopDistance > 0 ? profitDistance / stopDistance : Infinity;
        
        // Position Labels
        ctx.textAlign = 'left';
        const labelX = entryX + 5;
        ctx.fillStyle = 'white';
        ctx.fillText(`Profit: ${priceFormatter.format(this._data.profitPoint.price)}`, labelX, profitY);
        ctx.fillText(`Stop: ${priceFormatter.format(this._data.stopPoint.price)}`, labelX, stopY);
        ctx.fillText(`Entry: ${priceFormatter.format(this._data.entryPoint.price)}`, labelX, entryY);

        // R:R Ratio Label
        ctx.textAlign = 'center';
        const rrColor = riskRewardRatio >= 1 ? '#22c55e' : '#ef4444';
        const rrText = isFinite(riskRewardRatio) ? `R/R: ${riskRewardRatio.toFixed(2)}` : 'R/R: ∞';
        const rrX = entryX + (endX - entryX) / 2;
        const rrY = entryY + (this._data.type === 'long-position' ? -15 : 15);
        ctx.fillStyle = rrColor;
        ctx.fillText(rrText, rrX, rrY);
    }
}

class PositionPaneView implements IPrimitivePaneView {
    private _data: PositionDrawingData;
    private _series: ISeriesApi<"Candlestick", Time>;
    private _chart: IChartApi;

    constructor(data: PositionDrawingData, series: ISeriesApi<"Candlestick", Time>, chart: IChartApi) {
        this._data = data;
        this._series = series;
        this._chart = chart;
    }

    update(data: PositionDrawingData): void {
        this._data = data;
    }

    renderer(): IPrimitivePaneRenderer | null {
        return new PositionRenderer(this._data, this._series, this._chart);
    }

    zOrder(): PrimitivePaneViewZOrder {
        return 'top';
    }
}

export class PositionPrimitive implements ISeriesPrimitive {
    private _paneViews: PositionPaneView[] = [];
    private _data: PositionDrawingData | null = null;
    private _series: ISeriesApi<"Candlestick", Time> | null = null;
    private _chart: IChartApi | null = null;

    attached({ chart, series }: SeriesAttachedParameter): void {
        this._series = series as ISeriesApi<"Candlestick", Time>;
        this._chart = chart;
        this._updatePaneViews();
    }

    updateData(data: PositionDrawingData): void {
        this._data = data;
        this._updatePaneViews();
    }

    paneViews(): readonly IPrimitivePaneView[] {
        return this._paneViews;
    }

    _updatePaneViews() {
        if (!this._series || !this._data || !this._chart) return;
        this._paneViews = [new PositionPaneView(this._data, this._series, this._chart)];
    }
}
