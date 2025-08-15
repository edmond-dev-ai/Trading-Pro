import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UTCTimestamp as LwChartUTCTimestamp } from 'lightweight-charts';
import type { CandlestickData, LineData } from 'lightweight-charts';
import { getTimezoneOffset } from 'date-fns-tz';

// --- Drawing-related types ---

export type UTCTimestamp = LwChartUTCTimestamp;

export type LineStyle = 'Solid' | 'Dashed' | 'Dotted';

export interface DrawingPoint {
  time: UTCTimestamp;
  price: number;
}

export interface BaseDrawing {
    color?: string;
    width?: number;
    lineStyle?: LineStyle;
    fillColor?: string; // For rectangles
    profitColor?: string; // For position tools
    stopColor?: string; // For position tools
    lineColor?: string; // For position tools
    timezone?: string; // Track which timezone this drawing was created in
}

export interface TrendlineDrawing extends BaseDrawing {
  id: string;
  type: 'trendline';
  points: [DrawingPoint, DrawingPoint];
}
export interface VerticalLineDrawing extends BaseDrawing {
    id: string;
    type: 'vertical';
    time: UTCTimestamp;
    color: string;
    width: number;
}
export interface HorizontalRayDrawing extends BaseDrawing {
    id: string;
    type: 'horizontalRay';
    time: UTCTimestamp; 
    points: [DrawingPoint, DrawingPoint];
    price: number;
    color: string;
    width: number;
}

export interface FibRetracementDrawing extends BaseDrawing {
    id: string;
    type: 'fib-retracement';
    points: [DrawingPoint, DrawingPoint]; 
    showLabels?: boolean; 
    levels: { 
        value: number; 
        label: string; 
        color: string; 
        lineStyle: LineStyle;
    }[];
}

export interface RectangleDrawing extends BaseDrawing {
    id: string;
    type: 'rectangle';
    points: [DrawingPoint, DrawingPoint];
    // --- FIX START ---
    // Added the optional snappedPoints property to serve as the "anchor".
    snappedPoints?: [DrawingPoint, DrawingPoint];
    // --- FIX END ---
}

export interface PositionDrawing extends BaseDrawing {
    id: string;
    type: 'long-position' | 'short-position';
    entryPoint: DrawingPoint;
    profitPoint: DrawingPoint;
    stopPoint: DrawingPoint;
    endPoint?: DrawingPoint; 
    lineWidth: number;
    points?: DrawingPoint[];
}

export type Drawing = TrendlineDrawing | VerticalLineDrawing | HorizontalRayDrawing | FibRetracementDrawing | RectangleDrawing | PositionDrawing; 

export type DrawingTool = 'trendline' | 'fib-retracement' | 'horizontalRay' | 'vertical' | 'rectangle' | 'long-position' | 'short-position';

export type DrawingDefaults = {
    [key in DrawingTool]: BaseDrawing;
};


export type AppData = Omit<CandlestickData<UTCTimestamp>, 'time'> & { time: UTCTimestamp };
export type ReplayState = 'idle' | 'standby' | 'arming' | 'active' | 'paused';
export interface ReplayAnchor {
  time: UTCTimestamp;
  timeframe: string;
}

export interface Indicator {
    id: string; 
    name: string;
    data: LineData<UTCTimestamp>[];
    options: Record<string, any>;
    color?: string;
    isVisible?: boolean;
}

export interface ChartAppearanceSettings {
  background: string;
  vertGridColor: string;
  horzGridColor: string;
}

export interface CandlestickColorSettings {
    upColor: string;
    downColor:string;
    borderUpColor: string;
    borderDownColor: string;
    wickUpColor: string;
    wickDownColor: string;
}

export interface TradingProState {
  symbol: string;
  timeframe: string;
  favoriteTimeframes: string[];
  customTimeframes: string[];
  liveData: AppData[];
  hasMoreHistory: boolean;
  isAtLiveEdge: boolean;
  replayState: ReplayState;
  replayData: AppData[];
  replayCurrentIndex: number;
  replaySpeed: number;
  replayScrollToTime: UTCTimestamp | null;
  replayAnchor: ReplayAnchor | null;
  isChangingTimeframe: boolean;
  isIndicatorsPanelOpen: boolean;
  chartAppearance: ChartAppearanceSettings;
  candlestickColors: CandlestickColorSettings;
  activeIndicators: Indicator[];
  indicatorToEdit: Indicator[] | null;
  timezone: string;

  // --- Drawing state ---
  activeDrawingTool: DrawingTool | null;
  drawings: Drawing[];
  selectedDrawingId: string | null; 
  favoriteDrawingTools: DrawingTool[];
  isFavoriteToolbarVisible: boolean;
  isDrawingSettingsModalOpen: boolean;
  customColors: string[];
  drawingDefaults: DrawingDefaults;
  isMagnetModeActive: boolean; 

  // Actions
  setSymbol: (symbol: string) => void;
  setTimeframe: (timeframe: string) => void;
  toggleFavorite: (timeframe: string) => void;
  addCustomTimeframe: (timeframe: string) => void;
  removeCustomTimeframe: (timeframe: string) => void;
  setLiveData: (data: AppData[]) => void;
  appendHistory: (pastDatadata: AppData[]) => void;
  prependReplayHistory: (pastData: AppData[], hasMore: boolean) => void;
  setHasMoreHistory: (hasMore: boolean) => void;
  setIsAtLiveEdge: (isAtEdge: boolean) => void;
  setReplayState: (state: ReplayState) => void;
  loadReplayData: (fullData: AppData[], startIndex: number, anchor: ReplayAnchor | null) => void;
  setReplayData: (data: AppData[], newIndex: number) => void;
  stepReplayForward: () => void;
  stepReplayBackward: () => void;
  setReplaySpeed: (speed: number) => void;
  setReplayScrollToTime: (time: UTCTimestamp | null) => void;
  setReplayAnchor: (anchor: ReplayAnchor | null) => void;
  setIsIndicatorsPanelOpen: (isOpen: boolean) => void;
  appendReplayData: (futureData: AppData[]) => void;
  setChartAppearance: (newAppearance: Partial<ChartAppearanceSettings>) => void;
  setCandlestickColors: (newColors: Partial<CandlestickColorSettings>) => void;
  addIndicator: (indicator: Indicator) => void;
  removeIndicator: (id: string) => void;
  clearIndicators: () => void;
  setIndicatorToEdit: (indicatorGroup: Indicator[] | null) => void;
  setState: (partial: Partial<TradingProState>) => void;
  removeIndicatorsByIds: (ids: string[]) => void;
  toggleIndicatorVisibility: (ids: string[]) => void;
  updateIndicatorStyle: (id: string, newStyle: Partial<Pick<Indicator, 'color'>>) => void;
  addCustomColor: (color: string) => void;
  setTimezone: (timezone: string) => void;

  // --- Drawing actions ---
  setActiveDrawingTool: (tool: DrawingTool | null) => void;
  clearActiveTool: () => void;
  addDrawing: (drawing: Drawing) => void;
  removeDrawing: (id: string) => void;
  updateDrawing: (id: string, data: Partial<Drawing>) => void;
  clearDrawings: () => void;
  setSelectedDrawingId: (id: string | null) => void;
  toggleFavoriteDrawingTool: (tool: DrawingTool) => void;
  setFavoriteToolbarVisible: (isVisible: boolean) => void;
  setDrawingSettingsModalOpen: (isOpen: boolean) => void;
  setDrawingDefaults: (tool: DrawingTool, defaults: BaseDrawing) => void;
  setIsMagnetModeActive: (isActive: boolean) => void; 
}

export const timeframeToMinutes = (tf: string): number => {
    if (!tf) return 0;
    const unitMatch = tf.match(/[a-zA-Z]+$/);
    const valueMatch = tf.match(/^\d+/);
    if (!unitMatch || !valueMatch) return Infinity;
    const unit = unitMatch[0].toUpperCase();
    const value = parseInt(valueMatch[0], 10);
    switch (unit) {
        case 'M': return value;
        case 'H': return value * 60;
        case 'D': return value * 1440;
        case 'W': return value * 10080;
        case 'MO': return value * 43200;
        default: return Infinity;
    }
}

// --- FIX: Timezone conversion helper functions ---
const convertDrawingTimezone = (drawing: Drawing, fromTimezone: string, toTimezone: string): Drawing => {
    if (fromTimezone === toTimezone) return drawing;
    
    const fromOffset = getTimezoneOffset(fromTimezone, new Date()) / 1000;
    const toOffset = getTimezoneOffset(toTimezone, new Date()) / 1000;
    const offsetDiff = toOffset - fromOffset;
    
    const convertTime = (time: UTCTimestamp): UTCTimestamp => {
        return (time + offsetDiff) as UTCTimestamp;
    };
    
    const convertPoint = (point: DrawingPoint): DrawingPoint => ({
        ...point,
        time: convertTime(point.time)
    });
    
    switch (drawing.type) {
        case 'trendline': {
            const trendlineDrawing = drawing as TrendlineDrawing;
            return {
                ...trendlineDrawing,
                points: trendlineDrawing.points.map(convertPoint) as [DrawingPoint, DrawingPoint],
                timezone: toTimezone
            };
        }
        case 'vertical': {
            const verticalDrawing = drawing as VerticalLineDrawing;
            return {
                ...verticalDrawing,
                time: convertTime(verticalDrawing.time),
                timezone: toTimezone
            };
        }
        case 'horizontalRay': {
            const horizontalRayDrawing = drawing as HorizontalRayDrawing;
            return {
                ...horizontalRayDrawing,
                time: convertTime(horizontalRayDrawing.time),
                points: horizontalRayDrawing.points.map(convertPoint) as [DrawingPoint, DrawingPoint],
                timezone: toTimezone
            };
        }
        case 'fib-retracement': {
            const fibDrawing = drawing as FibRetracementDrawing;
            return {
                ...fibDrawing,
                points: fibDrawing.points.map(convertPoint) as [DrawingPoint, DrawingPoint],
                timezone: toTimezone
            };
        }
        case 'rectangle': {
            const rectangleDrawing = drawing as RectangleDrawing;
            return {
                ...rectangleDrawing,
                points: rectangleDrawing.points.map(convertPoint) as [DrawingPoint, DrawingPoint],
                snappedPoints: rectangleDrawing.snappedPoints?.map(convertPoint) as [DrawingPoint, DrawingPoint] | undefined,
                timezone: toTimezone
            };
        }
        case 'long-position':
        case 'short-position': {
            const positionDrawing = drawing as PositionDrawing;
            return {
                ...positionDrawing,
                entryPoint: convertPoint(positionDrawing.entryPoint),
                profitPoint: convertPoint(positionDrawing.profitPoint),
                stopPoint: convertPoint(positionDrawing.stopPoint),
                endPoint: positionDrawing.endPoint ? convertPoint(positionDrawing.endPoint) : undefined,
                points: positionDrawing.points?.map(convertPoint),
                timezone: toTimezone
            };
        }
        default: {
            const baseDrawing = drawing as any;
            return { ...baseDrawing, timezone: toTimezone };
        }
    }
};

export const useTradingProStore = create<TradingProState>()(persist((set, get) => ({
  symbol: 'XAUUSD',
  timeframe: '1H',
  favoriteTimeframes: ['1m', '5m', '15m', '1H', '4H', '1D'],
  customTimeframes: [],
  liveData: [],
  hasMoreHistory: true,
  isAtLiveEdge: true,
  replayState: 'idle',
  replayData: [],
  replayCurrentIndex: -1,
  replaySpeed: 1,
  replayScrollToTime: null,
  replayAnchor: null,
  isChangingTimeframe: false,
  isIndicatorsPanelOpen: false,
  activeIndicators: [],
  indicatorToEdit: null,
  chartAppearance: {
    background: '#111827',
    vertGridColor: '#374151',
    horzGridColor: '#374151',
  },
  candlestickColors: {
    upColor: '#22c55e',
    downColor: '#ef4444',
    borderUpColor: '#22c55e',
    borderDownColor: '#ef4444',
    wickUpColor: '#22c55e',
    wickDownColor: '#ef4444',
  },
  timezone: 'Etc/UTC',
  
  activeDrawingTool: null,
  drawings: [],
  selectedDrawingId: null,
  favoriteDrawingTools: ['trendline'],
  isFavoriteToolbarVisible: false,
  isDrawingSettingsModalOpen: false,
  customColors: [],
  drawingDefaults: {
    trendline: { color: '#2563eb', width: 2, lineStyle: 'Solid' },
    vertical: { color: '#2563eb', width: 2, lineStyle: 'Solid' },
    horizontalRay: { color: '#2563eb', width: 2, lineStyle: 'Solid' },
    'fib-retracement': { color: '#2563eb', width: 2, lineStyle: 'Solid' },
    rectangle: { color: '#888888', fillColor: 'rgba(136, 136, 136, 0.2)', width: 2, lineStyle: 'Solid' },
    'long-position': { profitColor: 'rgba(34, 197, 94, 0.2)', stopColor: 'rgba(239, 68, 68, 0.2)', lineColor: '#FFFFFF', width: 1 },
    'short-position': { profitColor: 'rgba(34, 197, 94, 0.2)', stopColor: 'rgba(239, 68, 68, 0.2)', lineColor: '#FFFFFF', width: 1 },
  },
  isMagnetModeActive: false,

  setSymbol: (symbol) => set((state) => ({
    symbol,
    liveData: [],
    hasMoreHistory: true,
    isAtLiveEdge: true,
    activeIndicators: state.activeIndicators.map(indicator => ({ ...indicator, data: [] })),
    drawings: [],
  })),
  setTimeframe: (timeframe) => {
    const state = get();
    set({ 
      timeframe, 
      isChangingTimeframe: true,
      liveData: [],
      activeIndicators: state.activeIndicators.map(indicator => ({ ...indicator, data: [] })),
    });
  },
  toggleFavorite: (tf) => set((state) => {
      const newFavorites = state.favoriteTimeframes.includes(tf)
          ? state.favoriteTimeframes.filter(fav => fav !== tf)
          : [...state.favoriteTimeframes, tf];
      return { favoriteTimeframes: newFavorites.sort((a, b) => timeframeToMinutes(a) - timeframeToMinutes(b)) };
  }),
  addCustomTimeframe: (tf) => set((state) => {
      if (state.customTimeframes.includes(tf)) return {};
      const newCustoms = [...state.customTimeframes, tf];
      return { customTimeframes: newCustoms.sort((a, b) => timeframeToMinutes(a) - timeframeToMinutes(b)) };
  }),
  removeCustomTimeframe: (tf) => set((state) => ({
      customTimeframes: state.customTimeframes.filter(custom => custom !== tf),
      favoriteTimeframes: state.favoriteTimeframes.filter(fav => fav !== tf),
  })),
  setLiveData: (data) => set({ liveData: data }),
  appendHistory: (pastData) => set((state) => ({ liveData: [...pastData, ...state.liveData] })),
  prependReplayHistory: (pastData, hasMore) => set((state) => ({
      replayData: [...pastData, ...state.replayData],
      replayCurrentIndex: state.replayCurrentIndex + pastData.length,
      hasMoreHistory: hasMore,
  })),
  setHasMoreHistory: (hasMore) => set({ hasMoreHistory: hasMore }),
  setIsAtLiveEdge: (isAtEdge) => set({ isAtLiveEdge: isAtEdge }),
  setReplayState: (state) => set({ replayState: state }),
  loadReplayData: (fullData, startIndex, anchor) => {
    set({
        replayData: fullData,
        replayCurrentIndex: startIndex,
        replayAnchor: anchor,
        hasMoreHistory: true,
    });
  },
  setReplayData: (data, newIndex) => set({
      replayData: data,
      replayCurrentIndex: newIndex,
      hasMoreHistory: true,
  }),
  stepReplayForward: () => {
    const { replayCurrentIndex, replayData, timeframe } = get();
    if (replayCurrentIndex < replayData.length - 1) {
        const newIndex = replayCurrentIndex + 1;
        const newCandle = replayData[newIndex];
        if (newCandle) {
            set({
                replayCurrentIndex: newIndex,
                replayAnchor: { time: newCandle.time, timeframe },
            });
        }
    }
  },
  stepReplayBackward: () => {
    const { replayCurrentIndex, replayData, timeframe } = get();
    const newIndex = Math.max(replayCurrentIndex - 1, 0);
    const newCandle = replayData[newIndex];
    if (newCandle) {
        set({
            replayCurrentIndex: newIndex,
            replayAnchor: { time: newCandle.time, timeframe },
        });
    }
  },
  setReplaySpeed: (speed) => set({ replaySpeed: speed }),
  setReplayScrollToTime: (time) => set({ replayScrollToTime: time }),
  setReplayAnchor: (anchor) => set({ replayAnchor: anchor }),
  appendReplayData: (futureData) => set((state) => ({
    replayData: [...state.replayData, ...futureData]
  })),
  setChartAppearance: (newAppearance) => set((state) => ({
    chartAppearance: { ...state.chartAppearance, ...newAppearance },
  })),
  setIsIndicatorsPanelOpen: (isOpen) => set({ isIndicatorsPanelOpen: isOpen }),
  setCandlestickColors: (newColors) => set((state) => ({
    candlestickColors: { ...state.candlestickColors, ...newColors },
  })),
  addIndicator: (indicator) => set((state) => {
    const indicatorBaseName = indicator.name.split('_')[0].toUpperCase();
    const otherIndicators = state.activeIndicators.filter(i => {
        const iBaseName = i.name.split('_')[0].toUpperCase();
        return iBaseName !== indicatorBaseName;
    });
    const color = indicator.options?.color ?? '#2563eb';
    const isVisible = indicator.options?.isVisible ?? true;
    return { activeIndicators: [ ...otherIndicators, { ...indicator, color, isVisible }] };
  }),
  removeIndicator: (id) => set((state) => ({
    activeIndicators: state.activeIndicators.filter(i => i.id !== id)
  })),
  clearIndicators: () => set({ activeIndicators: [] }),
  setIndicatorToEdit: (indicatorGroup) => set({ indicatorToEdit: indicatorGroup }),
  setState: (partial) => set(partial),
  removeIndicatorsByIds: (ids) => set((state) => ({
    activeIndicators: state.activeIndicators.filter(i => !ids.includes(i.id))
  })),
  toggleIndicatorVisibility: (ids) => set((state) => ({
    activeIndicators: state.activeIndicators.map(indicator =>
      ids.includes(indicator.id) ? { ...indicator, isVisible: !indicator.isVisible } : indicator
    )
  })),
  updateIndicatorStyle: (id, newStyle) => set((state) => ({
    activeIndicators: state.activeIndicators.map(indicator =>
      indicator.id === id ? { ...indicator, ...newStyle } : indicator
    )
  })),
  addCustomColor: (color) => set((state) => {
    if (!state.customColors.includes(color)) {
        return { customColors: [...state.customColors, color] };
    }
    return {};
  }),
  // --- FIX: Enhanced setTimezone with drawing migration ---
  setTimezone: (newTimezone) => set((state) => {
    const oldTimezone = state.timezone;
    
    // Convert all existing drawings to the new timezone
    const convertedDrawings = state.drawings.map(drawing => {
      const drawingTimezone = drawing.timezone || oldTimezone;
      return convertDrawingTimezone(drawing, drawingTimezone, newTimezone);
    });
    
    return { 
      timezone: newTimezone,
      drawings: convertedDrawings
    };
  }),

  // --- Drawing actions ---
  setActiveDrawingTool: (tool) => {
    set({ activeDrawingTool: tool, selectedDrawingId: null });
  },
  clearActiveTool: () => set({ activeDrawingTool: null, selectedDrawingId: null }),
  // --- FIX: Enhanced addDrawing to include current timezone ---
  addDrawing: (drawing) => set((state) => ({ 
    drawings: [...state.drawings, { ...drawing, timezone: state.timezone }] 
  })),
  removeDrawing: (id) => set((state) => ({ 
      drawings: state.drawings.filter(d => d.id !== id),
      selectedDrawingId: state.selectedDrawingId === id ? null : state.selectedDrawingId,
  })),
  updateDrawing: (id, data) => set((state) => ({
    drawings: state.drawings.map(d => {
      if (d.id !== id) return d;
      
      const typeProperties: Record<string, string[]> = {
        trendline: ['points', 'color', 'width', 'lineStyle'],
        vertical: ['time', 'color', 'width', 'lineStyle'],
        horizontalRay: ['time', 'price', 'color', 'width', 'lineStyle'],
        'fib-retracement': ['points', 'color', 'width', 'showLabels', 'levels', 'lineStyle'],
        // --- FIX START ---
        // Added 'snappedPoints' to the list of updatable properties for rectangles.
        rectangle: ['points', 'color', 'width', 'lineStyle', 'fillColor', 'snappedPoints'],
        // --- FIX END ---
        'long-position': ['entryPoint', 'profitPoint', 'stopPoint', 'endPoint', 'points'],
        'short-position': ['entryPoint', 'profitPoint', 'stopPoint', 'endPoint', 'points'],
      };

      const allowedProps = typeProperties[d.type as DrawingTool];
      if (!allowedProps) return d;
      
      const filteredData = Object.fromEntries(
        Object.entries(data).filter(([key]) => 
          allowedProps.includes(key)
        )
      );

      return Object.keys(filteredData).length > 0 ? { ...d, ...filteredData } : d;
    })
  })),
  clearDrawings: () => set({ drawings: [], selectedDrawingId: null }),
  setSelectedDrawingId: (id) => set({ selectedDrawingId: id, activeDrawingTool: null }),
  toggleFavoriteDrawingTool: (tool) => set((state) => {
      if (!tool) return {};
      const newFavorites = state.favoriteDrawingTools.includes(tool)
          ? state.favoriteDrawingTools.filter(fav => fav !== tool)
          : [...state.favoriteDrawingTools, tool];
      return { favoriteDrawingTools: newFavorites };
  }),
  setFavoriteToolbarVisible: (isVisible) => set({ isFavoriteToolbarVisible: isVisible }),
  setDrawingSettingsModalOpen: (isOpen) => set({ isDrawingSettingsModalOpen: isOpen }),
  setDrawingDefaults: (tool, defaults) => set((state) => ({
    drawingDefaults: {
        ...state.drawingDefaults,
        [tool]: { ...state.drawingDefaults[tool], ...defaults },
    },
  })),
  setIsMagnetModeActive: (isActive) => set({ isMagnetModeActive: isActive }), 
}), {
  name: 'trading-pro-store',
  version: 9, // Incremented version for migration
  partialize: (state) => ({
    activeIndicators: state.activeIndicators,
    favoriteTimeframes: state.favoriteTimeframes,
    customTimeframes: state.customTimeframes,
    candlestickColors: state.candlestickColors,
    chartAppearance: state.chartAppearance,
    drawings: state.drawings,
    favoriteDrawingTools: state.favoriteDrawingTools,
    selectedDrawingId: state.selectedDrawingId,
    isFavoriteToolbarVisible: state.isFavoriteToolbarVisible,
    customColors: state.customColors,
    drawingDefaults: state.drawingDefaults,
    isMagnetModeActive: state.isMagnetModeActive,
    timezone: state.timezone,
  }),
  onRehydrateStorage: () => (state, _error) => {
    if (state) {
        state.setReplayState('idle');
        state.loadReplayData([], -1, null);
        state.setSelectedDrawingId(null);
        state.setFavoriteToolbarVisible(false);
        state.setDrawingSettingsModalOpen(false);
        
        // --- FIX: Migration for existing drawings without timezone ---
        const currentTimezone = state.timezone || 'Etc/UTC';
        const migratedDrawings = state.drawings.map(drawing => ({
          ...drawing,
          timezone: drawing.timezone || currentTimezone
        }));
        
        if (migratedDrawings.some((_, i) => !state.drawings[i].timezone)) {
          state.setState({ drawings: migratedDrawings });
        }
    }
  }
}));

useTradingProStore.getState().setReplayState('idle');