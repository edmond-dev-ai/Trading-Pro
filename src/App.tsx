import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { SymbolSelect } from './components/SymbolSelect';
import { TimeframeSelect } from './components/TimeframeSelect';
import { ReplayControls } from './components/ReplayControls';
import { ChartComponent, type ChartHandle } from './components/ChartComponent';
import { FastTimeframeInput } from './components/FastTimeframeInput';
import { useTradingProStore } from './store/store';
import { useDataService } from './hooks/useDataService';
import { useReplayEngine } from './hooks/useReplayEngine';
import type { LogicalRange } from 'lightweight-charts';

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
    const { selectReplayStart } = useReplayEngine();

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
        replayPreciseTimestamp,
        setReplayData,
        setTimeframe, 
        setIsAtLiveEdge, 
        setReplayScrollToTime,
    } = useTradingProStore();

    const chartComponentRef = useRef<ChartHandle>(null);
    const shouldRescaleRef = useRef(true);

    const [isTimeframeInputOpen, setIsTimeframeInputOpen] = useState(false);
    const [timeframeInputValue, setTimeframeInputValue] = useState('');

    // Handle initial data loading and timeframe changes
    useEffect(() => {
        const controller = new AbortController();
        if (replayState === 'idle') {
            loadInitialDataForTimeframe(timeframe, controller.signal);
        } else if (replayPreciseTimestamp) {
            fetchFullDatasetForTimeframe(timeframe).then(newReplayData => {
                if (newReplayData.length > 0 && replayPreciseTimestamp) {
                    const newIndex = newReplayData.findIndex(d => d.time >= replayPreciseTimestamp)
                    if (newIndex !== -1) {
                        setReplayData(newReplayData, newIndex);
                    }
                }
            });
        }
        return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [symbol, timeframe]); 

    // THE FIX: Only trigger a full rescale when the symbol changes, not the timeframe.
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

    // THE FIX: Restore the stable callback for scrolling to prevent performance issues.
    const handleVisibleLogicalRangeChange = useCallback((range: LogicalRange | null) => {
        if (!range || dataForChart.length === 0) return;

        const { 
            replayState: currentReplayState, 
            hasMoreHistory: currentHasMoreHistory 
        } = useTradingProStore.getState();
        
        if (currentReplayState === 'idle') {
            const isAtEdge = range.to >= dataForChart.length - 1;
            setIsAtLiveEdge(isAtEdge);
            if (range.from < 50 && currentHasMoreHistory) {
                fetchMoreHistory();
            }
        } else {
            if (range.from < 50 && currentHasMoreHistory) {
                fetchMoreReplayHistory();
            }
            setIsAtLiveEdge(true);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dataForChart.length]);

    const handleScrollToRecent = useCallback(() => {
        chartComponentRef.current?.scrollToRealtime();
    }, []);

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
        setTimeframe(tf);
        setIsTimeframeInputOpen(false);
    }, [setTimeframe]);

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

    const showScrollButton = useMemo(() => {
        return !isAtLiveEdge && replayState === 'idle';
    }, [isAtLiveEdge, replayState]);
    
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
                    onChartClick={selectReplayStart}
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
            
            <ReplayControls />
        </div>
    );
}

export default App;