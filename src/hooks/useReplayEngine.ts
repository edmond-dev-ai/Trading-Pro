import { useEffect, useRef, useCallback } from 'react';
import { useTradingProStore } from '../store/store';
import { useDataService } from './useDataService';
import type { UTCTimestamp } from 'lightweight-charts';
import { recalculateIndicators } from './useWebSocketService';
import { getTimezoneOffset } from 'date-fns-tz';

// Helper function to determine if the timeframe is daily or higher
const isDailyOrHigherTimeframe = (tf: string): boolean => {
    if (!tf) return false;
    const unitMatch = tf.match(/[a-zA-Z]+$/);
    if (!unitMatch) return false;
    const unitStr = unitMatch[0].toUpperCase();
    return unitStr === 'D' || unitStr === 'W' || unitStr === 'MO';
};


export const useReplayEngine = () => {
   const {
       replayState,
       replaySpeed,
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
           const futureData = await fetchFutureReplayChunk(currentTf, new Date((lastCandle.time as number) * 1000).toISOString());
           if (futureData && futureData.length > 0) {
               const lastTime = useTradingProStore.getState().replayData.slice(-1)[0].time;
               const cleanedData = futureData.filter(d => d.time > lastTime);
               if (cleanedData.length > 0) {
                   appendReplayData(cleanedData);
                   const updatedReplayData = useTradingProStore.getState().replayData;
                   recalculateIndicators(updatedReplayData);
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

    const selectReplayStart = useCallback(async (displayTime: UTCTimestamp) => {
        const { timeframe: currentGlobalTimeframe, timezone } = useTradingProStore.getState();

        if (useTradingProStore.getState().replayState === 'arming') {
            // --- TIME CORRECTION LOGIC ---
            // 1. Reverse the chart's internal timezone conversion to get true UTC
            const timezoneOffsetMilliseconds = getTimezoneOffset(timezone, new Date((displayTime as number) * 1000));
            const timezoneOffsetSeconds = timezoneOffsetMilliseconds / 1000;
            const trueUtcTime = (displayTime as number) - timezoneOffsetSeconds;

            // 2. Reverse the manual visual offset we added in App.tsx
            const manualOffsetSeconds = isDailyOrHigherTimeframe(currentGlobalTimeframe) ? 12 * 3600 : 3600;
            const serverTime = trueUtcTime - manualOffsetSeconds;
            // --- END OF TIME CORRECTION ---

            // --- MODIFIED: Pass the corrected time to the data fetching function ---
            const endDateForApi = new Date(serverTime * 1000).toISOString();
            const fullData = await fetchFullDatasetForTimeframe(currentGlobalTimeframe, endDateForApi);
            
            if (!fullData || fullData.length === 0) {
                console.error("Failed to fetch data for replay start.");
                setReplayState('idle');
                return;
            }

            // 3. Use the fully corrected serverTime to find the starting candle
            const startIndex = fullData.findIndex(d => d.time === serverTime);

            if (startIndex !== -1) {
                // 4. Use the corrected serverTime for the anchor and for scrolling
                const anchor = { time: serverTime as UTCTimestamp, timeframe: currentGlobalTimeframe };
                loadReplayData(fullData, startIndex, anchor);
                setReplayState('paused');
                setReplayScrollToTime(serverTime as UTCTimestamp);
                proactivelyFetchNextChunk();

                recalculateIndicators(fullData);
            } else {
                console.error("Could not find selected start time in the fetched data. Display time:", displayTime, "Calculated server time:", serverTime);
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
           const currentTimeframe = useTradingProStore.getState().timeframe;
           
           await loadInitialDataForTimeframe(currentTimeframe);
           
           setReplayState('idle');
           loadReplayData([], -1, null);
       } catch (error) {
           console.error("Failed to load live data after exiting replay:", error);
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
