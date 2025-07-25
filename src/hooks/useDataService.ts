import { useCallback, useRef } from 'react';
import { useTradingProStore, type AppData } from '../store/store';
import { webSocketService, recalculateIndicators } from './useWebSocketService';

export const useDataService = () => {
    const isLoadingRef = useRef(false);

    const loadInitialDataForTimeframe = useCallback(async (tf: string) => {
        const { setState } = useTradingProStore;
        const { symbol, setLiveData, setHasMoreHistory } = useTradingProStore.getState();
        
        // --- FIX: Clear data immediately to prevent flashing ---
        setLiveData([]);
        setHasMoreHistory(true); // Assume there's more history until the fetch proves otherwise

        // Use the promise-based requestData to wait for the data
        const initialData = await webSocketService.requestData({
            action: 'get_initial_data',
            instrument: symbol,
            timeframe: tf,
            limit: 5000,
        });

        // Once data is received, update the store
        setLiveData(initialData);
        setHasMoreHistory(initialData.length >= 5000);
        setState({ isChangingTimeframe: false });
        // Recalculate indicators after new data is set
        recalculateIndicators(initialData);
    }, []);

    const fetchMoreHistory = useCallback(() => {
        const { hasMoreHistory, liveData, symbol, timeframe } = useTradingProStore.getState();
        if (isLoadingRef.current || !hasMoreHistory || liveData.length === 0) return;
        
        const oldestDataPoint = liveData[0];
        const endDate = new Date((oldestDataPoint.time as number) * 1000).toISOString();
        
        webSocketService.sendMessage({
            action: 'get_more_history',
            instrument: symbol,
            timeframe: timeframe,
            limit: 5000,
            end_date: endDate,
        });
    }, []);

    const fetchMoreReplayHistory = useCallback(() => {
        const { hasMoreHistory, replayData, symbol, timeframe } = useTradingProStore.getState();
        if (isLoadingRef.current || !hasMoreHistory || replayData.length === 0) return;
        
        const oldestDataPoint = replayData[0];
        const endDate = new Date((oldestDataPoint.time as number) * 1000).toISOString();
        
        webSocketService.sendMessage({
            action: 'get_more_replay_history',
            instrument: symbol,
            timeframe: timeframe,
            limit: 5000,
            end_date: endDate,
        });
    }, []);

    const fetchFullDatasetForTimeframe = useCallback(async (tf: string): Promise<AppData[]> => {
        const { symbol, replayAnchor } = useTradingProStore.getState();
        if (isLoadingRef.current) return [];
        isLoadingRef.current = true;
        
        const data = await webSocketService.requestData({
            action: 'get_full_dataset',
            instrument: symbol,
            timeframe: tf,
            limit: 10000,
            replay_anchor_time: replayAnchor?.time ? new Date(replayAnchor.time as number * 1000).toISOString() : undefined,
            replay_anchor_timeframe: replayAnchor?.timeframe,
        });

        isLoadingRef.current = false;
        return data;
    }, []);
    
    const fetchFutureReplayChunk = useCallback(async (timeframe: string, afterDate: string): Promise<AppData[]> => {
        const { symbol } = useTradingProStore.getState();
        if (isLoadingRef.current) return [];
        isLoadingRef.current = true;

        const futureData = await webSocketService.requestData({
            action: 'get_future_replay_chunk',
            instrument: symbol,
            timeframe: timeframe,
            limit: 200,
            after_date: afterDate
        });
        
        isLoadingRef.current = false;
        return futureData;
    }, []);

    return {
        loadInitialDataForTimeframe,
        fetchMoreHistory,
        fetchMoreReplayHistory,
        fetchFullDatasetForTimeframe,
        fetchFutureReplayChunk,
    };
};