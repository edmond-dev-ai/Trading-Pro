import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CandlestickData, UTCTimestamp, LineData } from 'lightweight-charts';

// --- Drawing-related types ---
export interface DrawingPoint {
  time: UTCTimestamp;
  price: number;
}
export interface TrendlineDrawing {
  id: string;
  type: 'trendline';
  points: [DrawingPoint, DrawingPoint];
  // --- MODIFICATION: Added style properties ---
  color?: string;
  width?: number;
}
export type Drawing = TrendlineDrawing; // Add other drawing types here with | in the future
export type DrawingTool = 'trendline' | 'long-position' | 'short-position' | 'fib-retracement' | 'horizontal-ray' | 'vertical-line' | null;


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

  // --- Drawing state ---
  activeDrawingTool: DrawingTool;
  drawings: Drawing[];

  // Actions
  setSymbol: (symbol: string) => void;
  setTimeframe: (timeframe: string) => void;
  toggleFavorite: (timeframe: string) => void;
  addCustomTimeframe: (timeframe: string) => void;
  removeCustomTimeframe: (timeframe: string) => void;
  setLiveData: (data: AppData[]) => void;
  appendHistory: (pastData: AppData[]) => void;
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

  // --- Drawing actions ---
  setActiveDrawingTool: (tool: DrawingTool) => void;
  addDrawing: (drawing: Drawing) => void;
  removeDrawing: (id: string) => void;
  clearDrawings: () => void;
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
  
  // --- Initial state for drawings ---
  activeDrawingTool: null,
  drawings: [],

  setSymbol: (symbol) => set((state) => ({
    symbol,
    liveData: [],
    hasMoreHistory: true,
    isAtLiveEdge: true,
    activeIndicators: state.activeIndicators.map(indicator => ({ ...indicator, data: [] })),
    drawings: [], // Clear drawings on symbol change
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

  // --- Drawing action implementations ---
  setActiveDrawingTool: (tool) => set({ activeDrawingTool: tool }),
  addDrawing: (drawing) => set((state) => ({ drawings: [...state.drawings, drawing] })),
  removeDrawing: (id) => set((state) => ({ drawings: state.drawings.filter(d => d.id !== id) })),
  clearDrawings: () => set({ drawings: [] }),

}), {
  name: 'trading-pro-store',
  version: 2,
  partialize: (state) => ({
    activeIndicators: state.activeIndicators,
    favoriteTimeframes: state.favoriteTimeframes,
    customTimeframes: state.customTimeframes,
    candlestickColors: state.candlestickColors,
    chartAppearance: state.chartAppearance,
    drawings: state.drawings,
  }),
  onRehydrateStorage: () => (state, error) => {
    if (state) {
        state.setReplayState('idle');
        state.loadReplayData([], -1, null);
    }
  }
}));

useTradingProStore.getState().setReplayState('idle');
