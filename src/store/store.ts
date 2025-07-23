import { create } from 'zustand';
import type { CandlestickData, UTCTimestamp, LineData } from 'lightweight-charts';

export type AppData = Omit<CandlestickData<UTCTimestamp>, 'time'> & { time: UTCTimestamp };
export type ReplayState = 'idle' | 'standby' | 'arming' | 'active' | 'paused';
export interface ReplayAnchor {
  time: UTCTimestamp;
  timeframe: string;
}

// --- NEW: Type for a single active indicator ---
export interface Indicator {
    id: string; // e.g., 'SMA_20'
    name: string; // e.g., 'Moving Average'
    data: LineData<UTCTimestamp>[];
    options: Record<string, any>; // e.g., { color: '#ff0000', length: 20 }
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
  isIndicatorsPanelOpen: boolean;
  chartAppearance: ChartAppearanceSettings;
  candlestickColors: CandlestickColorSettings;
  activeIndicators: Indicator[]; // --- NEW: State to hold active indicators
  isChangingTimeframe: boolean;
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
  addIndicator: (indicator: Indicator) => void; // --- NEW ---
  removeIndicator: (id: string) => void; // --- NEW ---
  clearIndicators: () => void; // --- NEW ---
  setState: (partial: Partial<TradingProState>) => void; // Add this for internal state updates
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

export const useTradingProStore = create<TradingProState>((set, get) => ({
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
  isIndicatorsPanelOpen: false,
  activeIndicators: [], // --- NEW: Initial state ---
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
  isChangingTimeframe: false,
  // --- MODIFIED: setSymbol now clears indicators ---
  setSymbol: (symbol) => set({ symbol, liveData: [], hasMoreHistory: true, isAtLiveEdge: true, activeIndicators: [] }),
  // --- FIXED: setTimeframe now properly handles replay data ---
  setTimeframe: (timeframe) => {
  const state = get();
  
  set({ 
    timeframe, 
    isChangingTimeframe: true,
    // Clear live data to prevent flashing
    liveData: [],
    // DON'T clear replay data - let the data fetching logic handle it
    // Clear indicator data to prevent flashing old data
    activeIndicators: state.activeIndicators.map(indicator => ({
      ...indicator,
      data: [] 
    }))
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
  // --- NEW: Indicator action implementations ---
  addIndicator: (indicator) => set((state) => ({
    activeIndicators: [...state.activeIndicators.filter(i => i.id !== indicator.id), indicator]
  })),
  removeIndicator: (id) => set((state) => ({
    activeIndicators: state.activeIndicators.filter(i => i.id !== id)
  })),
  clearIndicators: () => set({ activeIndicators: [] }),
  // Add setState method for internal use
  setState: (partial) => set(partial),
}));