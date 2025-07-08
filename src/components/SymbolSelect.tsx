import { useState, useRef, useEffect } from 'react';
import { useTradingProStore } from '../store/store';

// This component no longer needs props.
// It gets its state directly from the Zustand store.
export const SymbolSelect = () => {
  const selectedSymbol = useTradingProStore((state) => state.symbol);
  const onSelect = useTradingProStore((state) => state.setSymbol);

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // A list of available symbols. This could also come from the store or an API.
  const symbols = ["XAUUSD", "EURUSD", "GBPUSD", "AUDCAD", "USDJPY"];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (symbol: string) => {
    onSelect(symbol);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-1 px-3 rounded-md text-sm transition-colors duration-300"
      >
        {selectedSymbol}
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 w-48 bg-gray-800 rounded-md shadow-lg z-30">
          <ul className="p-1">
            {symbols.map(symbol => (
              <li key={symbol}>
                <button
                  onClick={() => handleSelect(symbol)}
                  // The logic to disable non-XAUUSD symbols is temporary for development
                  disabled={symbol !== "XAUUSD"}
                  className={`w-full text-left px-3 py-2 text-sm rounded-md ${
                    symbol === selectedSymbol 
                      ? 'bg-blue-600 text-white' 
                      : 'text-gray-300 hover:bg-gray-700'
                  } ${
                    symbol !== "XAUUSD" ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {symbol}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
