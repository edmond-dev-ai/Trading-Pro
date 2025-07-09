import { create } from 'zustand';
import type { CandlestickData, UTCTimestamp } from 'lightweight-charts';

export type AppData = Omit<CandlestickData<UTCTimestamp>, 'time'> & { time: UTCTimestamp };
export type ReplayState = 'idle' | 'standby' | 'arming' | 'active' | 'paused';

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
  replayPreciseTimestamp: UTCTimestamp | null;
  
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
  loadReplayData: (fullData: AppData[], startIndex: number) => void;
  setReplayData: (data: AppData[], newIndex: number) => void;
  stepReplayForward: () => void;
  stepReplayBackward: () => void;
  setReplaySpeed: (speed: number) => void;
  setReplayScrollToTime: (time: UTCTimestamp | null) => void;
  setReplayPreciseTimestamp: (time: UTCTimestamp | null) => void;
}

const timeframeToMinutes = (tf: string): number => {
    const unitMatch = tf.match(/[a-zA-Z]+$/);
    const valueMatch = tf.match(/^\d+/);
    if (!unitMatch || !valueMatch) return Infinity;
    const unit = unitMatch[0];
    const value = parseInt(valueMatch[0], 10);
    switch (unit) {
        case 'm': return value;
        case 'H': return value * 60;
        case 'D': return value * 1440;
        case 'W': return value * 10080;
        case 'Mo': return value * 43200;
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
  replayPreciseTimestamp: null,
  setSymbol: (symbol) => set({ symbol, liveData: [], hasMoreHistory: true, isAtLiveEdge: true }),
  setTimeframe: (timeframe) => set({ timeframe, hasMoreHistory: true, isAtLiveEdge: true }),
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
  loadReplayData: (fullData, startIndex) => {
    const startTime = fullData[startIndex]?.time;
    set({ 
        replayData: fullData, 
        replayCurrentIndex: startIndex,
        replayPreciseTimestamp: startTime ?? null,
        hasMoreHistory: true, 
    });
  },
  setReplayData: (data, newIndex) => set({
      replayData: data,
      replayCurrentIndex: newIndex,
      hasMoreHistory: true, 
  }),
  stepReplayForward: () => {
    const { replayCurrentIndex, replayData } = get();
    if (replayCurrentIndex >= replayData.length - 1) {
        set({ replayState: 'paused' });
        return;
    }
    const newIndex = replayCurrentIndex + 1;
    const newTime = replayData[newIndex]?.time;
    set({ 
        replayCurrentIndex: newIndex,
        replayPreciseTimestamp: newTime ?? null,
    });
  },
  stepReplayBackward: () => {
    const { replayCurrentIndex, replayData } = get();
    const newIndex = Math.max(replayCurrentIndex - 1, 0);
    const newTime = replayData[newIndex]?.time;
    set({ 
        replayCurrentIndex: newIndex,
        replayPreciseTimestamp: newTime ?? null,
    });
  },
  setReplaySpeed: (speed) => set({ replaySpeed: speed }),
  setReplayScrollToTime: (time) => set({ replayScrollToTime: time }),
  setReplayPreciseTimestamp: (time) => set({ replayPreciseTimestamp: time }),
}));