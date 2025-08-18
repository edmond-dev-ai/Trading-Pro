import { useCallback, useRef } from 'react';
import { useTradingProStore, type AppData } from '../store/store';
import { webSocketService, recalculateIndicators } from './useWebSocketService';
import { calculateReplayEndDate } from '../utils/timeframeCalculator';

export const useDataService = () => {
    const isLoadingRef = useRef(false);

    const loadInitialDataForTimeframe = useCallback(async (tf: string) => {
        const { setState } = useTradingProStore;
        const { symbol, setLiveData, setHasMoreHistory } = useTradingProStore.getState();
        
        setLiveData([]);
        setHasMoreHistory(true);

        const initialData = await webSocketService.requestData({
            action: 'get_initial_data',
            instrument: symbol,
            timeframe: tf,
            limit: 5000,
        });

        setLiveData(initialData);
        setHasMoreHistory(initialData.length >= 5000);
        setState({ isChangingTimeframe: false });
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

    // --- MODIFIED: This function now accepts an optional 'customEndDate' ---
    const fetchFullDatasetForTimeframe = useCallback(async (tf: string, customEndDate?: string): Promise<AppData[]> => {
        const { symbol, replayAnchor } = useTradingProStore.getState();
        if (isLoadingRef.current) return [];
        isLoadingRef.current = true;
        
        let endDate: string | undefined = customEndDate;

        // If a specific date wasn't passed (i.e., we're not starting a new replay),
        // check if we need to calculate it from the replay anchor. This handles
        // changing the timeframe while a replay is already active.
        if (!endDate && replayAnchor?.time && replayAnchor?.timeframe) {
            endDate = calculateReplayEndDate(
                replayAnchor.time as number, 
                replayAnchor.timeframe, 
                tf // tf is the target timeframe we're switching to
            );
        }
        
        const data = await webSocketService.requestData({
            action: 'get_full_dataset',
            instrument: symbol,
            timeframe: tf,
            limit: 10000,
            // This will now be the specific date from the user's click,
            // the date from the replay anchor, or undefined (for the latest data).
            end_date: endDate,
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