import { useState, useEffect, useRef, useCallback } from 'react';
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
    <button onClick={onClick} className="absolute bottom-20 right-5 z-20 bg-gray-700 bg-opacity-80 backdrop-blur-sm p-2 rounded-full text-white hover:bg-gray-600 transition-colors duration-300" title="Scroll to the most recent bar">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
    </button>
);

function App() {
    const { loadInitialDataForTimeframe, fetchMoreHistory } = useDataService();
    const { selectReplayStart } = useReplayEngine();

    const {
        liveData, replayData, replayState, replayCurrentIndex, symbol, timeframe,
        hasMoreHistory, isAtLiveEdge, shouldScrollToReplayStart
    } = useTradingProStore();
    
    const {
        setTimeframe, setIsAtLiveEdge, setShouldScrollToReplayStart
    } = useTradingProStore();

    const chartComponentRef = useRef<ChartHandle>(null);
    const shouldRescaleRef = useRef(true);

    const [isTimeframeInputOpen, setIsTimeframeInputOpen] = useState(false);
    const [timeframeInputValue, setTimeframeInputValue] = useState('');

    useEffect(() => {
        const controller = new AbortController();
        loadInitialDataForTimeframe(timeframe, controller.signal);
        return () => controller.abort();
    }, [symbol, timeframe, loadInitialDataForTimeframe]);

    useEffect(() => {
        shouldRescaleRef.current = true;
    }, [symbol]);

    const dataForChart = 
        (replayState !== 'idle' && replayState !== 'standby') && replayData.length > 0
        ? replayData.slice(0, replayCurrentIndex + 1)
        : liveData;

    // THE FIX: This callback is now stable because its primary dependency (fetchMoreHistory) is stable.
    const handleVisibleLogicalRangeChange = useCallback((range: LogicalRange | null) => {
        if (!range || dataForChart.length === 0) return;
        const { replayState: currentReplayState, hasMoreHistory: currentHasMoreHistory } = useTradingProStore.getState();
        const isReplayRunning = currentReplayState === 'active' || currentReplayState === 'paused';
        if (!isReplayRunning) {
            const isAtEdge = range.to >= dataForChart.length - 1;
            setIsAtLiveEdge(isAtEdge);
            if (range.from < 50 && currentHasMoreHistory) {
                fetchMoreHistory();
            }
        } else {
            setIsAtLiveEdge(true);
        }
    }, [dataForChart.length, fetchMoreHistory, setIsAtLiveEdge]);

    const handleScrollToRecent = () => chartComponentRef.current?.scrollToRealtime();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLSelectElement) return;
            if (e.key >= '0' && e.key <= '9' && !isTimeframeInputOpen) {
                e.preventDefault();
                setTimeframeInputValue(e.key);
                setIsTimeframeInputOpen(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isTimeframeInputOpen]);
    
    useEffect(() => {
        if (shouldRescaleRef.current) {
            shouldRescaleRef.current = false;
        }
    }, [dataForChart]);

    return (
        <div className='bg-gray-900 w-screen h-screen relative overflow-hidden flex flex-col'>
            {isTimeframeInputOpen && (
                <FastTimeframeInput
                    inputValue={timeframeInputValue}
                    onInputChange={setTimeframeInputValue}
                    onConfirm={(tf) => { setTimeframe(tf); setIsTimeframeInputOpen(false); }}
                    onClose={() => setIsTimeframeInputOpen(false)}
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
                    shouldRescale={shouldRescaleRef.current}
                    onVisibleLogicalRangeChange={handleVisibleLogicalRangeChange}
                    shouldScrollToReplayStart={shouldScrollToReplayStart}
                    onReplayScrolled={() => setShouldScrollToReplayStart(false)}
                />
                {!isAtLiveEdge && replayState === 'idle' && (
                    <ScrollToRecentButton onClick={handleScrollToRecent} />
                )}
            </main>
            <ReplayControls />
        </div>
    );
}

export default App;
