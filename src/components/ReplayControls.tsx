import { useTradingProStore } from '../store/store';
import { Play, Pause, Rewind, SkipBack, SkipForward, X } from 'lucide-react';

interface ReplayControlsProps {
    startArming: () => void;
    play: () => void;
    pause: () => void;
    exitReplay: () => void;
    stepForward: () => void;
    stepBackward: () => void;
}

export const ReplayControls = ({ startArming, play, pause, exitReplay, stepForward, stepBackward }: ReplayControlsProps) => {
    const replayState = useTradingProStore((state) => state.replayState);
    const replaySpeed = useTradingProStore((state) => state.replaySpeed);
    const setReplaySpeed = useTradingProStore((state) => state.setReplaySpeed);

    const isPlaying = replayState === 'active';

    return (
        <div className="bg-[#0e0e0e] border-t-2 border-b-2 border-[#2D2D2D] px-4 h-10 flex items-center relative text-white">
            
            {/* Centered Navigation Controls */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center space-x-2">
                <button 
                    onClick={startArming} 
                    title="Select Replay Start Point" 
                    className={`flex items-center space-x-2 px-2 py-1 rounded-md text-xs transition-colors duration-300 ${replayState === 'arming' ? 'bg-yellow-500 text-white animate-pulse' : 'bg-gray-700 hover:bg-gray-600'}`}
                >
                    <Rewind size={14} />
                    <span>Select bar</span>
                </button>
                <button onClick={stepBackward} title="Step Backward" className="p-1.5 rounded-md bg-gray-700 hover:bg-gray-600 transition-colors">
                    <SkipBack size={16} />
                </button>
                <button onClick={isPlaying ? pause : play} className="p-1.5 rounded-md bg-blue-600 hover:bg-blue-700 transition-colors">
                    {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <button onClick={stepForward} title="Step Forward" className="p-1.5 rounded-md bg-gray-700 hover:bg-gray-600 transition-colors">
                    <SkipForward size={16} />
                </button>
                <select 
                    value={replaySpeed} 
                    onChange={e => setReplaySpeed(Number(e.target.value))} 
                    className="bg-gray-700 text-white rounded-md p-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                    {[10, 7, 5, 3, 1, 0.5, 0.2, 0.1].map(speed => (
                        <option key={speed} value={speed}>{speed}x</option>
                    ))}
                </select>
            </div>

            {/* Right Side: Trading Actions & Exit */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center space-x-2">
                <button className="bg-red-600 hover:bg-red-700 text-white font-semibold py-1 px-4 text-xs rounded-md transition-colors">Sell</button>
                <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1 px-4 text-xs rounded-md transition-colors">Buy</button>
                 <button onClick={exitReplay} title="Exit Replay Mode" className="p-1.5 rounded-md bg-gray-700 hover:bg-gray-600 transition-colors">
                    <X size={16} />
                </button>
            </div>
        </div>
    );
};
