import { useEffect, useRef, useCallback } from 'react';
import { useTradingProStore } from '../store/store';
import { useDataService } from './useDataService';
import type { UTCTimestamp } from 'lightweight-charts';
import { webSocketService, recalculateIndicators } from './useWebSocketService'; 
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

   const { fetchFutureReplayChunk, loadInitialDataForTimeframe } = useDataService();
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
        const { timeframe: currentGlobalTimeframe, timezone, symbol } = useTradingProStore.getState();

        if (useTradingProStore.getState().replayState === 'arming') {
            
            const timezoneOffsetMilliseconds = getTimezoneOffset(timezone, new Date((displayTime as number) * 1000));
            const timezoneOffsetSeconds = timezoneOffsetMilliseconds / 1000;
            const trueUtcTime = (displayTime as number) - timezoneOffsetSeconds;
            const manualOffsetSeconds = isDailyOrHigherTimeframe(currentGlobalTimeframe) ? 10 * 3600 : 0;
            const serverTime = trueUtcTime - manualOffsetSeconds;
            
            const endDate = new Date(serverTime * 1000).toISOString();
            console.log(`Requesting replay data for ${symbol} ending before ${endDate}`);

            const fullData = await webSocketService.requestData({
                action: 'get_replay_start_data',
                instrument: symbol,
                timeframe: currentGlobalTimeframe,
                limit: 10000, 
                end_date: endDate,
            });

            // --- START OF FIX ---
            // If the backend returns no data, exit gracefully.
            if (!fullData || fullData.length === 0) {
                console.error("Failed to fetch data for replay start (received empty dataset).");
                setReplayState('idle');
                return;
            }

            // Since the backend sends data *before* the end_date, the closest candle
            // to our click is simply the LAST one in the returned array.
            const startIndex = fullData.length - 1;
            const actualStartTime = fullData[startIndex].time as UTCTimestamp;
            
            console.log(`Target time was ${serverTime}. Found closest start time at ${actualStartTime}.`);

            const anchor = { time: actualStartTime, timeframe: currentGlobalTimeframe };
            
            loadReplayData(fullData, startIndex, anchor);
            setReplayState('paused');
            setReplayScrollToTime(actualStartTime); // Scroll to the actual candle we found
            proactivelyFetchNextChunk();
            recalculateIndicators(fullData);
            // --- END OF FIX ---
        }
    }, [setReplayState, loadReplayData, setReplayScrollToTime, proactivelyFetchNextChunk]);


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
