import { useEffect, useRef, useCallback } from 'react';
import { useTradingProStore } from '../store/store';
import type { UTCTimestamp } from 'lightweight-charts';

export const useReplayEngine = () => {
    const {
        replayState,
        replaySpeed,
        setReplayState,
        stepReplayForward,
        stepReplayBackward,
        loadReplayData,
        setReplayScrollToTime,
        setReplayPreciseTimestamp,
        liveData,
        // THE FIX: Get the current replayData to determine the correct context
        replayData
    } = useTradingProStore();
    
    const playIntervalRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        if (playIntervalRef.current) clearInterval(playIntervalRef.current);

        if (replayState === 'active') {
            playIntervalRef.current = window.setInterval(() => {
                stepReplayForward();
            }, 1000 / replaySpeed);
        }

        return () => {
            if (playIntervalRef.current) clearInterval(playIntervalRef.current);
        };
    }, [replayState, replaySpeed, stepReplayForward]);

    const enterReplayMode = useCallback(() => setReplayState('standby'), [setReplayState]);

    const startArming = useCallback(() => {
        if (['standby', 'paused', 'active'].includes(replayState)) {
            setReplayState('arming');
        }
    }, [replayState, setReplayState]);

    const selectReplayStart = useCallback((time: UTCTimestamp) => {
        if (replayState === 'arming') {
            // THE FIX: Determine which dataset to use. If a replay is active, use its data.
            const sourceData = replayData.length > 0 ? replayData : liveData;
            const startIndex = sourceData.findIndex(d => d.time === time);

            if (startIndex !== -1) {
                // If using liveData, load it into the replay state.
                // If already in replay, this effectively just resets the index and timestamp.
                loadReplayData(sourceData, startIndex);
                setReplayState('paused');
                setReplayScrollToTime(time);
            } else {
                console.error("Could not find selected start time in the loaded data.");
                setReplayState('standby');
            }
        }
    }, [replayState, liveData, replayData, loadReplayData, setReplayState, setReplayScrollToTime]);

    const play = useCallback(() => {
        if (replayState === 'paused') setReplayState('active');
    }, [replayState, setReplayState]);

    const pause = useCallback(() => {
        if (replayState === 'active') setReplayState('paused');
    }, [replayState, setReplayState]);

    const exitReplay = useCallback(() => {
        setReplayState('idle');
        loadReplayData([], -1);
        setReplayPreciseTimestamp(null);
    }, [setReplayState, loadReplayData, setReplayPreciseTimestamp]);

    return { enterReplayMode, startArming, selectReplayStart, play, pause, exitReplay, stepForward: stepReplayForward, stepBackward: stepReplayBackward };
};