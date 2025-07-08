import { useTradingProStore } from '../store/store';
// THE FIX: Import the correct hook
import { useReplayEngine } from '../hooks/useReplayEngine';

const RewindIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" /></svg>;
const StepBackwardIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>;
const PlayIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg>;
const PauseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" /></svg>;
const StepForwardIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>;
const ExitIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;

export const ReplayControls = () => {
    const replayState = useTradingProStore((state) => state.replayState);
    const replaySpeed = useTradingProStore((state) => state.replaySpeed);
    const setReplaySpeed = useTradingProStore((state) => state.setReplaySpeed);
    const stepReplayForward = useTradingProStore((state) => state.stepReplayForward);
    const stepReplayBackward = useTradingProStore((state) => state.stepReplayBackward);

    // THE FIX: Destructure from the correct hook
    const { enterReplayMode, startArming, play, pause, exitReplay } = useReplayEngine();

    if (replayState === 'idle') {
        return (
            <div className="absolute top-4 right-4 z-20">
                <button onClick={enterReplayMode} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-md text-sm transition-colors duration-300">
                    Replay
                </button>
            </div>
        );
    }

    return (
        <>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-gray-800 bg-opacity-80 backdrop-blur-sm p-2 rounded-lg shadow-lg flex items-center space-x-2">
                <button onClick={startArming} title="Select Replay Start Point" className={`p-2 rounded-md text-sm transition-colors duration-300 ${replayState === 'arming' ? 'bg-yellow-500 text-white animate-pulse' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}>
                    <RewindIcon />
                </button>
                <button onClick={stepReplayBackward} title="Step Backward" className="bg-gray-700 hover:bg-gray-600 text-white font-bold p-2 rounded-md text-sm transition-colors duration-300">
                    <StepBackwardIcon />
                </button>
                <button onClick={replayState === 'active' ? pause : play} className="bg-blue-600 hover:bg-blue-700 text-white font-bold p-2 rounded-md text-sm transition-colors duration-300 w-10 h-10 flex items-center justify-center">
                    {replayState === 'active' ? <PauseIcon /> : <PlayIcon />}
                </button>
                <button onClick={stepReplayForward} title="Step Forward" className="bg-gray-700 hover:bg-gray-600 text-white font-bold p-2 rounded-md text-sm transition-colors duration-300">
                    <StepForwardIcon />
                </button>
                <select value={replaySpeed} onChange={e => setReplaySpeed(Number(e.target.value))} className="bg-gray-700 text-white rounded-md p-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {[10, 7, 5, 3, 1, 0.5, 0.2, 0.1].map(speed => (
                        <option key={speed} value={speed}>{speed}x</option>
                    ))}
                </select>
                <button onClick={exitReplay} title="Exit Replay Mode" className="bg-red-600 hover:bg-red-700 text-white font-bold p-2 rounded-md text-sm transition-colors duration-300">
                    <ExitIcon />
                </button>
            </div>
            <div className="absolute bottom-4 right-4 z-20 flex items-center space-x-2">
                <button className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-6 rounded-md transition-colors duration-300">Sell</button>
                <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-md transition-colors duration-300">Buy</button>
            </div>
        </>
    );
};
