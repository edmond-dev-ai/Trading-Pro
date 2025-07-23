import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Settings, Play, BarChartHorizontal } from 'lucide-react'; // --- MODIFIED: Imported new icon
import { SymbolSelect } from './components/SymbolSelect';
import { TimeframeSelect } from './components/TimeframeSelect';
import { ReplayControls } from './components/ReplayControls';
import { ChartComponent, type ChartHandle } from './components/ChartComponent';
import { IndicatorsPanel } from './components/IndicatorsPanel';
import { IndicatorStatus } from './components/IndicatorStatus'; // Import the new component
import { FastTimeframeInput } from './components/FastTimeframeInput';
import { useTradingProStore } from './store/store';
import type { Indicator } from './store/store';
import { useDataService } from './hooks/useDataService';
import { useReplayEngine } from './hooks/useReplayEngine';
import type { LogicalRange } from 'lightweight-charts';
import { SettingsPanel } from './components/SettingsPanel';
import { webSocketService } from './hooks/useWebSocketService';

const ScrollToRecentButton = ({ onClick }: { onClick: () => void }) => (
    <button
        onClick={onClick}
        className="absolute bottom-5 right-5 z-20 bg-gray-700 bg-opacity-80 backdrop-blur-sm p-2 rounded-full text-white hover:bg-gray-600 transition-colors duration-300"
        title="Scroll to the most recent bar"
    >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
        </svg>
    </button>
);

function App() {
    const { loadInitialDataForTimeframe, fetchMoreHistory, fetchMoreReplayHistory, fetchFullDatasetForTimeframe } = useDataService();
    const { proactivelyFetchNextChunk, stepForward, stepBackward, ...replayEngine } = useReplayEngine();

    const {
        liveData,
        replayData,
        replayState,
        replayCurrentIndex,
        symbol,
        timeframe,
        isAtLiveEdge,
        replayScrollToTime,
        replayAnchor,
        setReplayData,
        setTimeframe,
        setIsAtLiveEdge,
        setReplayScrollToTime,
        isChangingTimeframe
    } = useTradingProStore();

    const chartComponentRef = useRef<ChartHandle>(null);
    const [isIndicatorsPanelOpen, setIsIndicatorsPanelOpen] = useState(false);

    const shouldRescaleRef = useRef(true);
    const previousReplayStateRef = useRef(replayState);
    const isExitingReplayRef = useRef(false);
    // --- ADDED: Track current data to detect when it actually changes ---
    const previousDataRef = useRef<any[]>([]);

    const [isTimeframeInputOpen, setIsTimeframeInputOpen] = useState(false);
    const [timeframeInputValue, setTimeframeInputValue] = useState('');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    useEffect(() => {
        webSocketService.ensureConnected();
        return () => {
            webSocketService.disconnect();
        };
    }, []);

    useEffect(() => {
        if (previousReplayStateRef.current !== 'idle' && replayState === 'idle') {
            isExitingReplayRef.current = true;
            setTimeout(() => {
                isExitingReplayRef.current = false;
            }, 100);
        }
        previousReplayStateRef.current = replayState;
    }, [replayState]);

    useEffect(() => {
        const fetchData = async () => {
            if (isExitingReplayRef.current) {
                return;
            }

            if (replayState === 'idle') {
                await loadInitialDataForTimeframe(timeframe);
            }
            else if (replayAnchor) {
                const newReplayData = await fetchFullDatasetForTimeframe(timeframe);
                if (newReplayData.length > 0) {
                    const anchorTime = replayAnchor.time;
                    const newIndex = newReplayData.findIndex(candle => candle.time === anchorTime);
                    if (newIndex !== -1) {
                        setReplayData(newReplayData, newIndex);
                        setReplayScrollToTime(newReplayData[newIndex].time);
                        proactivelyFetchNextChunk();
                    }
                }
            }
        };

        fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [symbol, timeframe]);

    useEffect(() => {
        if (replayState === 'idle') {
            shouldRescaleRef.current = true;
        }
    }, [replayState, symbol]);

    const dataForChart = useMemo(() => {
        if (isChangingTimeframe) {
            return [];
        }
        const isReplayMode = replayState !== 'idle' && replayState !== 'standby';
        return isReplayMode && replayData.length > 0
            ? replayData.slice(0, replayCurrentIndex + 1)
            : liveData.sort((a, b) => a.time - b.time);
    }, [replayState, replayData, replayCurrentIndex, liveData, isChangingTimeframe]);

    // --- MODIFIED: Only recalculate indicators when data actually changes and NOT during active replay ---
    useEffect(() => {
        // --- FIX: Don't recalculate during timeframe changes, empty data, or active replay playback ---
        if (isChangingTimeframe || dataForChart.length === 0 || replayState === 'active') {
            return;
        }

        // --- FIX: Check if data has actually changed by comparing length and last item ---
        const hasDataChanged = 
            dataForChart.length !== previousDataRef.current.length ||
            (dataForChart.length > 0 && previousDataRef.current.length > 0 &&
             dataForChart[dataForChart.length - 1].time !== previousDataRef.current[previousDataRef.current.length - 1]?.time);

        if (!hasDataChanged) {
            return;
        }

        // Update the ref to track current data
        previousDataRef.current = dataForChart;

        const { activeIndicators } = useTradingProStore.getState();
        if (activeIndicators.length > 0) {
            const uniqueIndicators = new Map<string, Indicator>();
            activeIndicators.forEach(indicator => {
                const multiLineMatch = indicator.id.match(/(.+)_\d+$/);
                const baseId = multiLineMatch ? multiLineMatch[1] : indicator.id;
                if (!uniqueIndicators.has(baseId)) {
                    uniqueIndicators.set(baseId, indicator);
                }
            });

            uniqueIndicators.forEach(indicator => {
                const params = {
                    id: indicator.id,
                    name: indicator.name.toLowerCase(),
                    ...indicator.options
                };
                if ('color' in params) {
                    delete (params as { color?: string }).color;
                }
                webSocketService.sendMessage({
                    action: 'get_indicator',
                    params,
                    data: dataForChart
                });
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dataForChart, isChangingTimeframe, replayState]); // Add replayState dependency

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
    const isReplayActive = replayState !== 'idle';

    return (
        <div className='bg-gray-900 w-screen h-screen flex flex-col text-white'>
            {isSettingsOpen && <SettingsPanel onClose={() => setIsSettingsOpen(false)} />}
            {isIndicatorsPanelOpen && (
                <IndicatorsPanel onClose={() => setIsIndicatorsPanelOpen(false)} />)}

            {isTimeframeInputOpen && (
                <FastTimeframeInput
                    inputValue={timeframeInputValue}
                    onInputChange={setTimeframeInputValue}
                    onConfirm={handleTimeframeConfirm}
                    onClose={handleTimeframeInputClose}
                />
            )}

            {/* --- MODIFIED: Header layout updated --- */}
            <header className='flex-shrink-0 flex items-center justify-between h-10 px-2 border-b border-gray-700 bg-[#1e222d]'>
                {/* Left Section */}
                <div className="flex items-center space-x-2">
                    <button className="w-7 h-7 bg-purple-600 rounded-full flex items-center justify-center font-bold text-sm focus:outline-none ring-2 ring-transparent focus:ring-purple-400">
                        E
                    </button>
                    <SymbolSelect />
                    <TimeframeSelect />
                </div>

                {/* Center Section */}
                <div className="flex items-center space-x-2">
                     <button onClick={() => setIsIndicatorsPanelOpen(true)} className="flex items-center space-x-1.5 p-1.5 rounded-md hover:bg-gray-700 text-gray-300 hover:text-white text-xs" title="Indicators">
                        <BarChartHorizontal size={14} />
                        <span>Indicators</span>
                    </button>
                </div>

                {/* Right Section */}
                <div className="flex items-center space-x-2">
                    <button onClick={replayEngine.enterReplayMode} className="flex items-center space-x-1.5 p-1.5 rounded-md hover:bg-gray-700 text-gray-300 hover:text-white text-xs">
                        <Play size={14} />
                        <span>Replay</span>
                    </button>
                    <button onClick={() => setIsSettingsOpen(true)} className="p-1.5 rounded-md hover:bg-gray-700 text-gray-300 hover:text-white" title="Settings">
                        <Settings size={16} />
                    </button>
                </div>
            </header>

            <div className='flex flex-1 overflow-hidden'>
                <div className='flex-shrink-0 w-12 border-r border-gray-700 bg-[#1e222d]'></div>

                <main className='flex-1 relative'>
                    <IndicatorStatus /> {/* Add the status component here */}
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

                <div className='flex-shrink-0 w-12 border-l border-gray-700 bg-[#1e222d]'></div>
            </div>

            <footer className="flex-shrink-0">
                {isReplayActive && (
                    <ReplayControls
                        startArming={replayEngine.startArming}
                        play={replayEngine.play}
                        pause={replayEngine.pause}
                        exitReplay={replayEngine.exitReplay}
                        stepForward={stepForward}
                        stepBackward={stepBackward}
                    />
                )}
                <div className='h-8 border-t border-gray-700 bg-[#1e222d]'></div>
            </footer>
        </div>
    );
}

export default App;