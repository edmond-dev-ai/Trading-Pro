import type {
    PrimitivePaneViewZOrder,
    ISeriesPrimitive,
    IPrimitivePaneView,
    Time,
    UTCTimestamp,
    IChartApi,
    LogicalRange
} from 'lightweight-charts';
import { formatInTimeZone } from 'date-fns-tz';

export interface TimezoneOverlayData {
    timezone: string;
    timeframe: string;
    chart: IChartApi;
    chartData: Array<{ time: UTCTimestamp; [key: string]: any }>;
}

class TimezoneOverlayPaneView implements IPrimitivePaneView {
    private _data: TimezoneOverlayData;

    constructor(data: TimezoneOverlayData) {
        this._data = data;
    }

    updateData(data: TimezoneOverlayData): void {
        this._data = data;
    }

    zOrder(): PrimitivePaneViewZOrder {
        return 'top'; // Literal for verbatimModuleSyntax
    }

    renderer() {
        return new TimezoneOverlayRenderer(this._data);
    }
}

class TimezoneOverlayRenderer {
    private _data: TimezoneOverlayData;

    constructor(data: TimezoneOverlayData) {
        this._data = data;
    }

    draw(target: any): void {
        target.useMediaCoordinateSpace((scope: any) => {
            const ctx: CanvasRenderingContext2D = scope.context;
            const mediaSize = scope.mediaSize;

            const timeScale = this._data.chart.timeScale();
            const visibleRange = timeScale.getVisibleLogicalRange();
            if (!visibleRange) return;

            // Detect the height of the time axis (usually ~30px)
            const timeAxisHeight = 30;
            const overlayHeight = 18;
            const yPosition = mediaSize.height - timeAxisHeight - overlayHeight;

            // Background
            ctx.fillStyle = '#1e222d';
            ctx.fillRect(0, yPosition, mediaSize.width, overlayHeight);

            // Draw timezone labels
            this.drawTimezoneLabels(ctx, mediaSize, timeScale, visibleRange, yPosition, overlayHeight);
        });
    }

    private drawTimezoneLabels(
        ctx: CanvasRenderingContext2D,
        mediaSize: any,
        timeScale: any,
        visibleRange: LogicalRange,
        y: number,
        height: number
    ): void {
        ctx.font = '11px "Trebuchet MS", Roboto, Ubuntu, sans-serif';
        ctx.fillStyle = '#d1d5db';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const textY = y + height / 2;
        const minSpacing = 80;
        const maxTicks = Math.floor(mediaSize.width / minSpacing);

        const ticks = this.generateTicks(visibleRange, timeScale, maxTicks);

        for (const { time, coordinate } of ticks) {
            const label = this.formatTimeForTimezone(time);
            ctx.fillText(label, coordinate, textY);
        }
    }

    private generateTicks(
        visibleRange: LogicalRange,
        timeScale: any,
        maxTicks: number
    ): Array<{ time: UTCTimestamp; coordinate: number }> {
        const ticks: Array<{ time: UTCTimestamp; coordinate: number }> = [];
        const rangeSize = visibleRange.to - visibleRange.from;
        const step = Math.max(1, Math.ceil(rangeSize / maxTicks));

        for (let logical = Math.ceil(visibleRange.from); logical <= visibleRange.to; logical += step) {
            const coordinate = timeScale.logicalToCoordinate(logical);
            if (coordinate != null) {
                const time = this.getTimeAtLogical(logical);
                if (time) ticks.push({ time, coordinate });
            }
        }
        return ticks;
    }

    private getTimeAtLogical(logicalIndex: number): UTCTimestamp | null {
        const chartData = this._data.chartData;
        if (!chartData.length) return null;

        const idx = Math.round(logicalIndex);
        if (idx < 0 || idx >= chartData.length) return null;

        return chartData[idx].time;
    }

    private formatTimeForTimezone(time: UTCTimestamp): string {
        const date = new Date(time * 1000);
        const formatString = this.isDailyOrHigherTimeframe(this._data.timeframe)
            ? 'eee d MMM yy'
            : 'HH:mm zzz';
        return formatInTimeZone(date, this._data.timezone, formatString);
    }

    private isDailyOrHigherTimeframe(tf: string): boolean {
        if (!tf) return false;
        const match = tf.match(/[a-zA-Z]+$/);
        if (!match) return false;
        const unit = match[0].toUpperCase();
        return unit === 'D' || unit === 'W' || unit === 'MO';
    }
}

export class TimezoneOverlayPrimitive implements ISeriesPrimitive<Time> {
    private _paneViews: TimezoneOverlayPaneView[] = [];
    private _data: TimezoneOverlayData | null = null;

    updateData(data: TimezoneOverlayData): void {
        this._data = data;
        if (!this._paneViews.length) {
            this._paneViews.push(new TimezoneOverlayPaneView(data));
        } else {
            this._paneViews[0].updateData(data);
        }
    }

    paneViews() {
        return this._paneViews;
    }

    updateAllViews(): void {
        if (this._data) {
            this._paneViews.forEach(view => view.updateData(this._data!));
        }
    }

    hitTest?(): null {
        return null;
    }
}
