import { useEffect, useRef, useCallback } from 'react';
import { useTradingProStore } from '../store/store';
import { useDataService } from './useDataService';
import type { UTCTimestamp } from 'lightweight-charts';

export const useReplayEngine = () => {
    const {
        replayState,
        replaySpeed,
        timeframe,
        setReplayState,
        stepReplayForward,
        stepReplayBackward,
        loadReplayData,
        setReplayScrollToTime,
        appendReplayData,
    } = useTradingProStore();

    const { fetchFullDatasetForTimeframe, fetchFutureReplayChunk, loadInitialDataForTimeframe } = useDataService();
    const playIntervalRef = useRef<number | undefined>(undefined);
    const isFetchingFuture = useRef(false);

    const proactivelyFetchNextChunk = useCallback(async () => {
        if (isFetchingFuture.current) return;

        const { replayData, timeframe: currentTf } = useTradingProStore.getState();
        const lastCandle = replayData[replayData.length - 1];
        if (!lastCandle) return;

        isFetchingFuture.current = true;
        try {
            const futureData = await fetchFutureReplayChunk(currentTf, new Date(lastCandle.time as number * 1000).toISOString());
            if (futureData && futureData.length > 0) {
                const lastTime = useTradingProStore.getState().replayData.slice(-1)[0].time;
                const cleanedData = futureData.filter(d => d.time > lastTime);
                if (cleanedData.length > 0) {
                    appendReplayData(cleanedData);
                }
            }
        } catch (error) {
            console.error("Failed to fetch future replay chunk:", error);
        } finally {
            isFetchingFuture.current = false;
        }
    }, [fetchFutureReplayChunk, appendReplayData]);

    useEffect(() => {
        if (playIntervalRef.current) {
            clearInterval(playIntervalRef.current);
        }

        if (replayState === 'active') {
            const intervalId = window.setInterval(() => {
                const { replayCurrentIndex, replayData } = useTradingProStore.getState();
                const canStepForward = replayCurrentIndex < replayData.length - 1;
                
                if (canStepForward) {
                    stepReplayForward();
                } else {
                    proactivelyFetchNextChunk();
                }

                const isNearEnd = replayCurrentIndex >= replayData.length - 20;
                if(isNearEnd){
                    proactivelyFetchNextChunk();
                }

            }, 1000 / replaySpeed);
            playIntervalRef.current = intervalId;
        }

        return () => {
            if (playIntervalRef.current) {
                clearInterval(playIntervalRef.current);
            }
        };
    }, [replayState, replaySpeed, stepReplayForward, proactivelyFetchNextChunk]);

    const enterReplayMode = useCallback(() => setReplayState('standby'), [setReplayState]);

    const startArming = useCallback(() => {
        const { replayState: currentState, replayData } = useTradingProStore.getState();
        if (currentState === 'arming') {
            setReplayState(replayData.length > 0 ? 'paused' : 'standby');
        } else if (['standby', 'paused', 'active'].includes(currentState)) {
            setReplayState('arming');
        }
    }, [setReplayState]);

    const selectReplayStart = useCallback(async (time: UTCTimestamp) => {
        const currentGlobalTimeframe = useTradingProStore.getState().timeframe;

        if (useTradingProStore.getState().replayState === 'arming') {
            const fullData = await fetchFullDatasetForTimeframe(currentGlobalTimeframe);
            if (!fullData || fullData.length === 0) {
                console.error("Failed to fetch data for replay start.");
                setReplayState('idle');
                return;
            }
            const startIndex = fullData.findIndex(d => d.time === time);

            if (startIndex !== -1) {
                const anchor = { time, timeframe: currentGlobalTimeframe };
                loadReplayData(fullData, startIndex, anchor);
                setReplayState('paused');
                setReplayScrollToTime(time);
                proactivelyFetchNextChunk();
            } else {
                console.error("Could not find selected start time in the fetched data.");
                setReplayState('idle');
            }
        }
    }, [fetchFullDatasetForTimeframe, setReplayState, loadReplayData, setReplayScrollToTime, proactivelyFetchNextChunk]);

    const play = useCallback(() => {
        if (useTradingProStore.getState().replayState === 'paused') {
            setReplayState('active');
        }
    }, [setReplayState]);

    const pause = useCallback(() => {
        if (useTradingProStore.getState().replayState === 'active') {
            setReplayState('paused');
        }
    }, [setReplayState]);

    const exitReplay = useCallback(async () => {
        try {
            // Get the current timeframe before clearing replay data
            const currentTimeframe = useTradingProStore.getState().timeframe;
            
            // Load the new data first
            const controller = new AbortController();
            await loadInitialDataForTimeframe(currentTimeframe, controller.signal);
            
            // Only after new data is loaded, clear replay state
            setReplayState('idle');
            loadReplayData([], -1, null);
        } catch (error) {
            console.error("Failed to load live data after exiting replay:", error);
            // On error, still exit replay mode to prevent getting stuck
            setReplayState('idle');
            loadReplayData([], -1, null);
        }
    }, [setReplayState, loadReplayData, loadInitialDataForTimeframe]);

    return { 
        enterReplayMode, 
        startArming, 
        selectReplayStart, 
        play, 
        pause, 
        exitReplay, 
        stepForward: stepReplayForward, 
        stepBackward: stepReplayBackward, 
        proactivelyFetchNextChunk 
    };
};