import { useState, useRef, useEffect } from 'react';
import { Search, X, TrendingUp, Coins, Building2, Globe } from 'lucide-react';
import { useTradingProStore } from '../store/store';

interface SymbolData {
  symbol: string;
  name: string;
  category: 'forex' | 'indices' | 'commodities' | 'crypto';
  icon: string;
}

export const SymbolSelect = () => {
  const selectedSymbol = useTradingProStore((state) => state.symbol);
  const onSelect = useTradingProStore((state) => state.setSymbol);

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const symbolData: SymbolData[] = [
    { symbol: "EURUSD", name: "EUR/USD", category: "forex", icon: "🇪🇺" },
    { symbol: "GBPUSD", name: "GBP/USD", category: "forex", icon: "🇬🇧" },
    { symbol: "USDJPY", name: "USD/JPY", category: "forex", icon: "🇯🇵" },
    { symbol: "AUDUSD", name: "AUD/USD", category: "forex", icon: "🇦🇺" },
    { symbol: "USDCAD", name: "USD/CAD", category: "forex", icon: "🇨🇦" },
    { symbol: "USDCHF", name: "USD/CHF", category: "forex", icon: "🇨🇭" },
    { symbol: "EURGBP", name: "EUR/GBP", category: "forex", icon: "🇪🇺" },
    { symbol: "EURJPY", name: "EUR/JPY", category: "forex", icon: "🇪🇺" },
    { symbol: "GBPJPY", name: "GBP/JPY", category: "forex", icon: "🇬🇧" },
    { symbol: "AUDCAD", name: "AUD/CAD", category: "forex", icon: "🇦🇺" },
    { symbol: "NAS100USD", name: "US NAS 100", category: "indices", icon: "📈" },
    { symbol: "US30USD", name: "US Wall St 30", category: "indices", icon: "📊" },
    { symbol: "SPX500USD", name: "US SPX 500", category: "indices", icon: "📈" },
    { symbol: "UK100GBP", name: "UK 100", category: "indices", icon: "🇬🇧" },
    { symbol: "XAUUSD", name: "GOLD", category: "commodities", icon: "🥇" },
    { symbol: "XAGUSD", name: "SILVER", category: "commodities", icon: "🥈" },
    { symbol: "BTCUSD", name: "BITCOIN / US DOLLAR", category: "crypto", icon: "₿" },
  ];

  const categories = [
    { key: 'All', name: 'All', icon: Globe, color: 'text-blue-400' },
    { key: 'forex', name: 'Forex', icon: TrendingUp, color: 'text-green-400' },
    { key: 'indices', name: 'Indices', icon: Building2, color: 'text-purple-400' },
    { key: 'commodities', name: 'Commodities', icon: Coins, color: 'text-yellow-400' },
    { key: 'crypto', name: 'Crypto', icon: Coins, color: 'text-orange-400' },
  ];

  const filteredSymbols = symbolData.filter(item => {
    const matchesSearch = 
      item.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = 
      activeCategory === 'All' || item.category === activeCategory;
    
    return matchesSearch && matchesCategory;
  });

  const currentSymbolData = symbolData.find(item => item.symbol === selectedSymbol);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && searchRef.current) {
      setTimeout(() => {
        searchRef.current?.focus();
      }, 100);
    } else {
      setSearchTerm('');
      setHoveredIndex(-1);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      switch (event.key) {
        case 'Escape':
          setIsOpen(false);
          buttonRef.current?.focus();
          break;
        case 'ArrowDown':
          event.preventDefault();
          setHoveredIndex(prev => 
            prev < filteredSymbols.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          setHoveredIndex(prev => prev > 0 ? prev - 1 : prev);
          break;
        case 'Enter':
          event.preventDefault();
          if (hoveredIndex >= 0 && hoveredIndex < filteredSymbols.length) {
            handleSelect(filteredSymbols[hoveredIndex].symbol);
          }
          break;
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, filteredSymbols, hoveredIndex]);

  const handleSelect = (symbol: string) => {
    onSelect(symbol);
    setIsOpen(false);
  };

  const clearSearch = () => {
    setSearchTerm('');
    searchRef.current?.focus();
  };

  return (
    <div className="relative">
      <button 
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-1 px-2 rounded-md text-xs transition-colors duration-300"
      >
        {selectedSymbol}
      </button>

      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity duration-200"
          onClick={() => setIsOpen(false)}
        />
      )}

      {isOpen && (
        <div 
          ref={dropdownRef}
          className="fixed top-4 left-1/2 transform -translate-x-1/2 w-[600px] max-w-[90vw] max-h-[70vh] bg-[#0e0e0e]/95 backdrop-blur-xl rounded-xl shadow-2xl z-50 border border-[#2D2D2D]/50 animate-in slide-in-from-top-4 fade-in duration-300"
        >
          <div className="flex items-center justify-between p-4 border-b border-[#2D2D2D]/50">
            <h3 className="text-lg font-semibold text-white">Symbol Search</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-gray-700/50 rounded-lg transition-colors duration-200"
            >
              <X size={18} className="text-gray-400 hover:text-white" />
            </button>
          </div>

          <div className="p-4 border-b border-[#2D2D2D]/50">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search symbols..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setHoveredIndex(-1);
                }}
                className="w-full pl-10 pr-10 py-3 bg-gray-800/50 border border-[#2D2D2D]/50 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
              />
              {searchTerm && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-600/50 rounded-full transition-colors duration-200"
                >
                  <X size={14} className="text-gray-400 hover:text-white" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-1 px-4 py-3 border-b border-[#2D2D2D]/50 overflow-x-auto">
            {categories.map((category) => {
              const IconComponent = category.icon;
              const isActive = activeCategory === category.key;
              
              return (
                <button
                  key={category.key}
                  onClick={() => {
                    setActiveCategory(category.key);
                    setHoveredIndex(-1);
                  }}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-600/90 text-white shadow-lg'
                      : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
                  }`}
                >
                  <IconComponent size={14} className={isActive ? 'text-white' : category.color} />
                  <span>{category.name}</span>
                  {isActive && (
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="overflow-y-auto max-h-80">
            {filteredSymbols.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Search size={32} className="mb-2 opacity-50" />
                <p className="text-sm">No symbols match your search</p>
                <p className="text-xs mt-1">Try adjusting your search terms or category</p>
              </div>
            ) : (
              <div className="p-2">
                {filteredSymbols.map((item, index) => {
                  const isSelected = selectedSymbol === item.symbol;
                  const isHovered = index === hoveredIndex;
                  
                  return (
                    <button
                      key={item.symbol}
                      onClick={() => handleSelect(item.symbol)}
                      onMouseEnter={() => setHoveredIndex(index)}
                      onMouseLeave={() => setHoveredIndex(-1)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-all duration-200 group ${
                        isSelected
                          ? 'bg-gradient-to-r from-blue-600/90 to-blue-500/90 text-white shadow-lg transform scale-[1.02]'
                          : isHovered
                          ? 'bg-gray-700/70 text-white transform scale-[1.01]'
                          : 'text-gray-300 hover:bg-gray-700/50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg transition-all duration-200 ${
                          isSelected 
                            ? 'bg-white/20 backdrop-blur-sm' 
                            : 'bg-gray-700/50 group-hover:bg-gray-600/70'
                        }`}>
                          {item.icon}
                        </div>
                        
                        <div className="flex flex-col">
                          <span className="font-bold text-sm tracking-wide">
                            {item.symbol}
                          </span>
                          <span className={`text-xs transition-all duration-200 ${
                            isSelected 
                              ? 'text-blue-100' 
                              : isHovered
                              ? 'text-gray-300'
                              : 'text-gray-400'
                          }`}>
                            {item.name}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className={`text-xs px-2 py-1 rounded-full transition-all duration-200 ${
                          isSelected
                            ? 'bg-white/20 text-blue-100'
                            : 'bg-gray-600/50 text-gray-300 group-hover:bg-gray-600/70'
                        }`}>
                          {item.category}
                        </span>
                        
                        {isSelected && (
                          <div className="flex items-center space-x-1">
                            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                            <div className="w-1.5 h-1.5 bg-white/70 rounded-full animate-pulse delay-75" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {filteredSymbols.length > 0 && (
            <div className="p-3 border-t border-[#2D2D2D]/50 bg-[#0e0e0e]/30">
              <div className="text-xs text-gray-400 text-center">
                Use ↑↓ arrows to navigate • Enter to select • Esc to close
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
