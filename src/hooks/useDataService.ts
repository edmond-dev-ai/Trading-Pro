import { useCallback, useRef } from 'react';
import { useTradingProStore, type AppData } from '../store/store';
import type { UTCTimestamp } from 'lightweight-charts';

const fetchChunk = async (
    symbol: string,
    timeframe: string,
    limit: number,
    endDate?: string,
    afterDate?: string,
    abortSignal?: AbortSignal
): Promise<AppData[]> => {
    let url = `http://127.0.0.1:8000/api/data?instrument=${symbol}&timeframe=${timeframe}&limit=${limit}`;
    if (endDate) url += `&end_date=${endDate}`;
    else if (afterDate) url += `&after_date=${afterDate}`;
    try {
        const response = await fetch(url, { signal: abortSignal });
        if (!response.ok) return [];
        const data = await response.json();
        if (data.error || !Array.isArray(data)) return [];
        return data.map((item: any) => ({
            time: (new Date(item.DateTime).getTime() / 1000) as UTCTimestamp,
            open: item.Open, high: item.High, low: item.Low, close: item.Close,
        }));
    } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
            console.error("Fetch error:", err.message);
        }
        return [];
    }
};

export const useDataService = () => {
    const isLoadingRef = useRef(false);

    const loadInitialDataForTimeframe = useCallback(async (tf: string, signal: AbortSignal) => {
        const { symbol, setLiveData, setHasMoreHistory } = useTradingProStore.getState();
        if (isLoadingRef.current) return;
        isLoadingRef.current = true;
        setHasMoreHistory(true);
        const initialData = await fetchChunk(symbol, tf, 2000, new Date().toISOString().split('T')[0], undefined, signal);
        if (!signal.aborted) {
            setLiveData(initialData);
            if (initialData.length < 2000) {
                setHasMoreHistory(false);
            }
        }
        isLoadingRef.current = false;
    }, []);

    // THE FIX: This function is now stable. It gets the latest state via getState()
    // and has no unstable dependencies in its useCallback array. This is the key to stopping the lag.
    const fetchMoreHistory = useCallback(async () => {
        const { hasMoreHistory, liveData, symbol, timeframe, appendHistory, setHasMoreHistory } = useTradingProStore.getState();
        if (isLoadingRef.current || !hasMoreHistory || liveData.length === 0) return;
        
        isLoadingRef.current = true;
        const oldestDataPoint = liveData[0];
        const endDate = new Date((oldestDataPoint.time as number) * 1000).toISOString().split('T')[0];
        const pastData = await fetchChunk(symbol, timeframe, 2000, endDate);
        if (pastData.length > 0) {
            appendHistory(pastData);
        } else {
            setHasMoreHistory(false);
        }
        isLoadingRef.current = false;
    }, []);

    const fetchReplayData = useCallback(async (startTime: UTCTimestamp) => {
        const { symbol, timeframe, loadReplayData } = useTradingProStore.getState();
        if (isLoadingRef.current) return;
        isLoadingRef.current = true;
        const endDate = new Date((startTime as number) * 1000).toISOString().split('T')[0];
        const initialReplayData = await fetchChunk(symbol, timeframe, 2000, endDate);
        loadReplayData(initialReplayData);
        isLoadingRef.current = false;
    }, []);
    
    const fetchNextReplayChunk = useCallback(async () => {
        const { replayData, symbol, timeframe } = useTradingProStore.getState();
        if (isLoadingRef.current || replayData.length === 0) return;
        isLoadingRef.current = true;
        const lastDataPoint = replayData[replayData.length - 1];
        const afterDate = new Date((lastDataPoint.time as number) * 1000).toISOString();
        const nextChunk = await fetchChunk(symbol, timeframe, 2000, undefined, afterDate);
        if (nextChunk.length > 0) {
            useTradingProStore.setState(state => ({ replayData: [...state.replayData, ...nextChunk] }));
        }
        isLoadingRef.current = false;
    }, []);

    return { loadInitialDataForTimeframe, fetchMoreHistory, fetchReplayData, fetchNextReplayChunk };
};
