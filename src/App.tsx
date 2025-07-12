import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { SymbolSelect } from './components/SymbolSelect';
import { TimeframeSelect } from './components/TimeframeSelect';
import { ReplayControls } from './components/ReplayControls';
import { ChartComponent, type ChartHandle } from './components/ChartComponent';
import { FastTimeframeInput } from './components/FastTimeframeInput';
import { useTradingProStore } from './store/store';
import { useDataService } from './hooks/useDataService';
import { useReplayEngine } from './hooks/useReplayEngine';
import type { LogicalRange, UTCTimestamp } from 'lightweight-charts';

const ScrollToRecentButton = ({ onClick }: { onClick: () => void }) => (
    <button
        onClick={onClick}
        className="absolute bottom-20 right-5 z-20 bg-gray-700 bg-opacity-80 backdrop-blur-sm p-2 rounded-full text-white hover:bg-gray-600 transition-colors duration-300"
        title="Scroll to the most recent bar"
    >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
        </svg>
    </button>
);

function App() {
    const { loadInitialDataForTimeframe, fetchMoreHistory, fetchMoreReplayHistory, fetchFullDatasetForTimeframe } = useDataService();
    // FIX: Get the new proactive fetch function from the hook.
    const { proactivelyFetchNextChunk, ...replayEngine } = useReplayEngine();

    const {
        liveData,
        replayData,
        replayState,
        replayCurrentIndex,
        symbol,
        timeframe,
        hasMoreHistory,
        isAtLiveEdge,
        replayScrollToTime,
        replayAnchor,
        setReplayData,
        setTimeframe,
        setIsAtLiveEdge,
        setReplayScrollToTime,
    } = useTradingProStore();

    const chartComponentRef = useRef<ChartHandle>(null);
    const shouldRescaleRef = useRef(true);

    const [isTimeframeInputOpen, setIsTimeframeInputOpen] = useState(false);
    const [timeframeInputValue, setTimeframeInputValue] = useState('');

    useEffect(() => {
        const controller = new AbortController();
        const fetchData = async () => {
            if (replayState === 'idle') {
                await loadInitialDataForTimeframe(timeframe, controller.signal);
            }
            else if (replayAnchor) {
                const newReplayData = await fetchFullDatasetForTimeframe(timeframe);
                if (newReplayData.length > 0) {
                    const newIndex = newReplayData.length - 1;
                    setReplayData(newReplayData, newIndex);
                    setReplayScrollToTime(newReplayData[newIndex].time);
                    // FIX: Immediately fetch the next chunk after a successful timeframe switch.
                    proactivelyFetchNextChunk();
                }
            }
        };

        fetchData();
        return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [symbol, timeframe]);

    useEffect(() => {
        if (replayState === 'idle') {
            shouldRescaleRef.current = true;
        }
    }, [symbol]);

    const dataForChart = useMemo(() => {
        const isReplayMode = replayState !== 'idle' && replayState !== 'standby';
        return isReplayMode && replayData.length > 0
            ? replayData.slice(0, replayCurrentIndex + 1)
            : liveData;
    }, [replayState, replayData, replayCurrentIndex, liveData]);

    const handleVisibleLogicalRangeChange = useCallback((range: LogicalRange | null) => {
        if (!range || dataForChart.length === 0) return;

        const {
            replayState: currentReplayState,
            hasMoreHistory: currentHasMoreHistory
        } = useTradingProStore.getState();

        const isAtEdge = range.to >= dataForChart.length;
        setIsAtLiveEdge(isAtEdge);

        if (range.from < 50 && currentHasMoreHistory) {
            if (currentReplayState === 'idle') {
                fetchMoreHistory();
            } else {
                fetchMoreReplayHistory();
            }
        }
    }, [dataForChart.length, fetchMoreHistory, fetchMoreReplayHistory, setIsAtLiveEdge]);

    const handleScrollToRecent = useCallback(() => {
        if (replayState === 'idle') {
            chartComponentRef.current?.scrollToRealtime();
        } else if (replayData.length > 0 && replayCurrentIndex >= 0) {
            const lastCandleTime = replayData[replayCurrentIndex].time;
            chartComponentRef.current?.scrollToTime(lastCandleTime);
        }
    }, [replayState, replayData, replayCurrentIndex]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (document.activeElement instanceof HTMLInputElement ||
                document.activeElement instanceof HTMLSelectElement) {
                return;
            }

            if (e.key >= '0' && e.key <= '9' && !isTimeframeInputOpen) {
                e.preventDefault();
                setTimeframeInputValue(e.key);
                setIsTimeframeInputOpen(true);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isTimeframeInputOpen]);

    const handleTimeframeConfirm = useCallback((tf: string) => {
        if (tf !== timeframe) {
           setTimeframe(tf);
        }
        setIsTimeframeInputOpen(false);
    }, [setTimeframe, timeframe]);

    const handleTimeframeInputClose = useCallback(() => {
        setIsTimeframeInputOpen(false);
    }, []);

    useEffect(() => {
        if (shouldRescaleRef.current) {
            shouldRescaleRef.current = false;
        }
    }, [dataForChart]);

    const handleReplayScrolled = useCallback(() => {
        setReplayScrollToTime(null);
    }, [setReplayScrollToTime]);

    const showScrollButton = !isAtLiveEdge;

    const shouldRescaleChart = shouldRescaleRef.current && replayState === 'idle';

    return (
        <div className='bg-gray-900 w-screen h-screen relative overflow-hidden flex flex-col'>
            {isTimeframeInputOpen && (
                <FastTimeframeInput
                    inputValue={timeframeInputValue}
                    onInputChange={setTimeframeInputValue}
                    onConfirm={handleTimeframeConfirm}
                    onClose={handleTimeframeInputClose}
                />
            )}

            <header className='absolute top-4 left-4 z-20 flex items-center space-x-4'>
                <SymbolSelect />
                <TimeframeSelect />
            </header>

            <main className='flex-grow pt-16 relative'>
                <ChartComponent
                    ref={chartComponentRef}
                    data={dataForChart}
                    onChartClick={replayEngine.selectReplayStart}
                    isClickArmed={replayState === 'arming'}
                    shouldRescale={shouldRescaleChart}
                    onVisibleLogicalRangeChange={handleVisibleLogicalRangeChange}
                    replayScrollToTime={replayScrollToTime}
                    onReplayScrolled={handleReplayScrolled}
                />

                {showScrollButton && (
                    <ScrollToRecentButton onClick={handleScrollToRecent} />
                )}
            </main>

            <ReplayControls
                enterReplayMode={replayEngine.enterReplayMode}
                startArming={replayEngine.startArming}
                play={replayEngine.play}
                pause={replayEngine.pause}
                exitReplay={replayEngine.exitReplay}
            />
        </div>
    );
}

export default App;