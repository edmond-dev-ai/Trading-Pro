import { useCallback, useRef } from 'react';
import { useTradingProStore, type AppData, type ReplayAnchor } from '../store/store';
import type { UTCTimestamp } from 'lightweight-charts';

const fetchChunk = async (
    symbol: string,
    timeframe: string,
    limit: number,
    abortSignal?: AbortSignal,
    endDate?: string, // Renamed 'date' to 'endDate' for clarity
    afterDate?: string, // FIX: Add afterDate parameter
    replayAnchor?: ReplayAnchor | null,
): Promise<AppData[]> => {
    let url = `http://127.0.0.1:8000/api/data?instrument=${symbol}&timeframe=${timeframe}&limit=${limit}`;

    if (replayAnchor) {
        const anchorDate = new Date(replayAnchor.time as number * 1000).toISOString();
        url += `&replay_anchor_time=${anchorDate}&replay_anchor_timeframe=${replayAnchor.timeframe}`;
    } else if (endDate) {
        url += `&end_date=${endDate}`;
    } else if (afterDate) {
        url += `&after_date=${afterDate}`;
    }

    try {
        const response = await fetch(url, { signal: abortSignal });
        if (!response.ok) {
            console.error(`Fetch failed with status: ${response.status}`);
            return [];
        }
        const data = await response.json();
        if (data.error || !Array.isArray(data)) return [];

        const mappedData = data.map((item: any) => ({
            time: (new Date(item.DateTime).getTime() / 1000) as UTCTimestamp,
            open: item.Open,
            high: item.High,
            low: item.Low,
            close: item.Close,
        }));

        return mappedData.sort((a, b) => (a.time as number) - (b.time as number));
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
        const initialData = await fetchChunk(symbol, tf, 5000, signal);
        if (!signal.aborted) {
            setLiveData(initialData);
            if (initialData.length < 5000) {
                setHasMoreHistory(false);
            }
        }
        isLoadingRef.current = false;
    }, []);

    const fetchMoreHistory = useCallback(async () => {
        const { hasMoreHistory, liveData, symbol, timeframe, appendHistory, setHasMoreHistory } = useTradingProStore.getState();
        if (isLoadingRef.current || !hasMoreHistory || liveData.length === 0) return;
        isLoadingRef.current = true;
        const oldestDataPoint = liveData[0];
        const endDate = new Date((oldestDataPoint.time as number) * 1000).toISOString();
        const pastData = await fetchChunk(symbol, timeframe, 5000, undefined, endDate);
        if (pastData.length > 0) {
            const currentOldestTime = liveData[0]?.time;
            const newPastData = pastData.filter(d => d.time !== currentOldestTime);
            if (newPastData.length > 0) {
                appendHistory(newPastData);
            }
            if (pastData.length < 5000) {
                setHasMoreHistory(false);
            }
        } else {
            setHasMoreHistory(false);
        }
        isLoadingRef.current = false;
    }, []);

    const fetchMoreReplayHistory = useCallback(async () => {
        const { hasMoreHistory, replayData, symbol, timeframe, prependReplayHistory, setHasMoreHistory } = useTradingProStore.getState();
        if (isLoadingRef.current || !hasMoreHistory || replayData.length === 0) return;
        isLoadingRef.current = true;
        const oldestDataPoint = replayData[0];
        const endDate = new Date((oldestDataPoint.time as number) * 1000).toISOString();
        const pastData = await fetchChunk(symbol, timeframe, 5000, undefined, endDate);
        if (pastData.length > 0) {
             const currentOldestTime = replayData[0]?.time;
             const newPastData = pastData.filter(d => d.time !== currentOldestTime);
            if (newPastData.length > 0) {
                prependReplayHistory(newPastData, pastData.length >= 5000);
            } else {
                 setHasMoreHistory(false);
            }
        } else {
            setHasMoreHistory(false);
        }
        isLoadingRef.current = false;
    }, []);

    const fetchFullDatasetForTimeframe = useCallback(async (tf: string): Promise<AppData[]> => {
        const { symbol, replayAnchor } = useTradingProStore.getState();
        if (isLoadingRef.current) return [];
        isLoadingRef.current = true;
        const data = await fetchChunk(symbol, tf, 10000, undefined, undefined, undefined, replayAnchor);
        isLoadingRef.current = false;
        return data;
    }, []);
    
    // FIX: Add a new function to fetch future data for continuous replay.
    const fetchFutureReplayChunk = useCallback(async (timeframe: string, afterDate: string): Promise<AppData[]> => {
        const { symbol } = useTradingProStore.getState();
        if (isLoadingRef.current) return [];
        isLoadingRef.current = true;
        const futureData = await fetchChunk(symbol, timeframe, 200, undefined, undefined, afterDate);
        isLoadingRef.current = false;
        return futureData;
    }, []);

    return {
        loadInitialDataForTimeframe,
        fetchMoreHistory,
        fetchMoreReplayHistory,
        fetchFullDatasetForTimeframe,
        fetchFutureReplayChunk, // FIX: Export the new function
    };
};