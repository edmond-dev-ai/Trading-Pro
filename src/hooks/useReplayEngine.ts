import { useEffect, useRef, useCallback } from 'react';
import { useTradingProStore } from '../store/store';
import { useDataService } from './useDataService';
import type { UTCTimestamp } from 'lightweight-charts';

export const useReplayEngine = () => {
    const replayState = useTradingProStore((state) => state.replayState);
    const replayData = useTradingProStore((state) => state.replayData);
    const replayCurrentIndex = useTradingProStore((state) => state.replayCurrentIndex);
    const replaySpeed = useTradingProStore((state) => state.replaySpeed);
    const setReplayState = useTradingProStore((state) => state.setReplayState);
    const stepReplayForward = useTradingProStore((state) => state.stepReplayForward);
    const loadReplayData = useTradingProStore((state) => state.loadReplayData);
    const setShouldScrollToReplayStart = useTradingProStore((state) => state.setShouldScrollToReplayStart);

    const { fetchReplayData, fetchNextReplayChunk } = useDataService();
    
    // THE FIX: Initialize useRef with a value. 'undefined' is a valid initial value.
    const playIntervalRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        const isNearEndOfBuffer = replayCurrentIndex >= replayData.length - 50;
        if (replayState === 'active' && isNearEndOfBuffer && replayData.length > 0) {
            fetchNextReplayChunk();
        }
    }, [replayCurrentIndex, replayData.length, replayState, fetchNextReplayChunk]);

    useEffect(() => {
        if (playIntervalRef.current) clearInterval(playIntervalRef.current);

        if (replayState === 'active') {
            if (replayData.length === 0 || replayCurrentIndex >= replayData.length - 1) {
                setReplayState('paused');
                return;
            }
            playIntervalRef.current = window.setInterval(() => {
                stepReplayForward();
            }, 1000 / replaySpeed);
        }

        return () => {
            if (playIntervalRef.current) clearInterval(playIntervalRef.current);
        };
    }, [replayState, replaySpeed, replayData.length, replayCurrentIndex, setReplayState, stepReplayForward]);

    const enterReplayMode = useCallback(() => setReplayState('standby'), [setReplayState]);

    const startArming = useCallback(() => {
        if (['standby', 'paused', 'active'].includes(replayState)) {
            setReplayState('arming');
        }
    }, [replayState, setReplayState]);

    const selectReplayStart = useCallback(async (time: UTCTimestamp) => {
        if (replayState === 'arming') {
            await fetchReplayData(time);
            setReplayState('paused');
            setShouldScrollToReplayStart(true);
        }
    }, [replayState, fetchReplayData, setReplayState, setShouldScrollToReplayStart]);

    const play = useCallback(() => {
        if (replayState === 'paused') setReplayState('active');
    }, [replayState, setReplayState]);

    const pause = useCallback(() => {
        if (replayState === 'active') setReplayState('paused');
    }, [replayState, setReplayState]);

    const exitReplay = useCallback(() => {
        setReplayState('idle');
        loadReplayData([]);
    }, [setReplayState, loadReplayData]);

    return { enterReplayMode, startArming, selectReplayStart, play, pause, exitReplay };
};
