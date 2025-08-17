import { useTradingProStore, type AppData, type Indicator } from '../store/store';
import type { UTCTimestamp, LineData } from 'lightweight-charts';

export const recalculateIndicators = (chartData: AppData[]) => {
    const { activeIndicators } = useTradingProStore.getState();
    if (activeIndicators.length === 0 || chartData.length === 0) return;

    const uniqueIndicators = new Map<string, Indicator>();
    activeIndicators.forEach(indicator => {
        const multiLineMatch = indicator.id.match(/(.+)_\d+$/);
        const baseId = multiLineMatch ? multiLineMatch[1] : indicator.id;
        if (!uniqueIndicators.has(baseId)) {
            uniqueIndicators.set(baseId, indicator);
        }
    });

    uniqueIndicators.forEach(indicator => {
        // *** THE BUG FIX IS HERE ***
        // We must include the top-level color and isVisible properties in the request
        // so they are preserved during recalculation.
        const params = {
            id: indicator.id,
            name: indicator.name.toLowerCase(),
            ...indicator.options,
            color: indicator.color, // Preserve color
            isVisible: indicator.isVisible // Preserve visibility
        };
        
        // This check is no longer needed here as it's handled in the params
        // if ('color' in params) {
        //     delete (params as { color?: string }).color;
        // }

        webSocketService.sendMessage({
            action: 'get_indicator',
            params,
            data: chartData
        });
    });
};


const transformData = (serverData: any[]): AppData[] => {
    if (!Array.isArray(serverData)) return [];
    return serverData.map(item => ({
        time: (new Date(item.DateTime).getTime() / 1000) as UTCTimestamp,
        open: item.Open,
        high: item.High,
        low: item.Low,
        close: item.Close,
    }));
};

const deduplicateAndSort = (data: AppData[]): AppData[] => {
    const timeMap = new Map<number, AppData>();
    data.forEach(item => {
        timeMap.set(item.time as number, item);
    });
    return Array.from(timeMap.values()).sort((a, b) => (a.time as number) - (b.time as number));
};

const mergeAndDeduplicate = (existingData: AppData[], newData: AppData[]): AppData[] => {
    const combined = [...existingData, ...newData];
    return deduplicateAndSort(combined);
};

type PendingRequest = {
    resolve: (data: AppData[]) => void;
    reject: (error: Error) => void;
};

interface WebSocketRequest {
    action: string;
    requestId?: string;
    [key: string]: any;
}

interface WebSocketResponse {
    action: string;
    requestId?: string;
    data: any[];
    indicator_id?: string;
    params?: any;
    lines?: Array<{
        indicator_id: string;
        line_name: string;
        data: Array<{ time: number; value: number }>;
        params?: any;
    }>;
}

class WebSocketService {
    private socket: WebSocket | null = null;
    private connectionPromise: Promise<void> | null = null;
    private isConnecting = false;
    private pendingRequests = new Map<string, PendingRequest>();

    private connectSocket(): Promise<void> {
        if (this.connectionPromise) return this.connectionPromise;

        this.isConnecting = true;
        this.connectionPromise = new Promise((resolve, reject) => {
            this.socket = new WebSocket('ws://3.71.70.69:8000/ws');
            this.socket.onopen = () => {
                console.log('WebSocket connection established.');
                this.isConnecting = false;
                resolve();
            };
            this.socket.onmessage = (event) => this.handleMessage(event);
            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.isConnecting = false;
                this.connectionPromise = null;
                reject(error);
            };
            this.socket.onclose = () => {
                console.log('WebSocket connection closed.');
                this.socket = null;
                this.connectionPromise = null;
            };
        });
        return this.connectionPromise;
    }

    public async ensureConnected(): Promise<void> {
        if (!this.socket && !this.isConnecting) {
            await this.connectSocket();
        } else if (this.connectionPromise) {
            await this.connectionPromise;
        }
    }

    public sendMessage(request: WebSocketRequest) {
        this.ensureConnected().then(() => {
            if (this.socket?.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify(request));
            } else {
                console.error('WebSocket is not connected or ready.');
            }
        }).catch(error => {
            console.error("Failed to ensure WebSocket connection:", error);
        });
    }

    public requestData(request: Omit<WebSocketRequest, 'requestId'>): Promise<AppData[]> {
        return new Promise((resolve, reject) => {
            this.ensureConnected().then(() => {
                const requestId = `${request.action}_${Date.now()}_${Math.random()}`;
                this.pendingRequests.set(requestId, { resolve, reject });

                const message: WebSocketRequest = {
                    ...request,
                    requestId
                } as WebSocketRequest;

                this.socket!.send(JSON.stringify(message));

                setTimeout(() => {
                    if (this.pendingRequests.has(requestId)) {
                        this.pendingRequests.delete(requestId);
                        reject(new Error(`Request timed out for action: ${request.action}`));
                    }
                }, 15000);
            }).catch(reject);
        });
    }

    private handleMessage(event: MessageEvent) {
        try {
            const response: WebSocketResponse = JSON.parse(event.data);
            const {
                setLiveData,
                setHasMoreHistory,
                loadReplayData,
                liveData,
                replayData,
                addIndicator
            } = useTradingProStore.getState();

            const transformedData = transformData(response.data);

            if (response.requestId && this.pendingRequests.has(response.requestId)) {
                const pending = this.pendingRequests.get(response.requestId)!;
                pending.resolve(deduplicateAndSort(transformedData));
                this.pendingRequests.delete(response.requestId);
                return;
            }

            switch (response.action) {
                case 'indicator_data': {
                    // Handle bundled indicator lines
                    if (response.lines && Array.isArray(response.lines)) {
                        response.lines.forEach(line => {
                            const newIndicator: Indicator = {
                                id: line.indicator_id,
                                name: line.line_name,
                                data: line.data as LineData<UTCTimestamp>[],
                                options: line.params || {}
                            };
                            addIndicator(newIndicator);
                        });
                    }
                    // Backward compatibility for single indicator line
                    else if (response.indicator_id && response.data) {
                        const newIndicator: Indicator = {
                            id: response.indicator_id,
                            name: response.indicator_id.split('_')[0],
                            data: response.data,
                            options: response.params || {}
                        };
                        addIndicator(newIndicator);
                    }
                    break;
                }

                case 'get_more_history':
                    if (transformedData.length > 0) {
                        const mergedData = mergeAndDeduplicate(transformedData, liveData);
                        setLiveData(mergedData);
                        recalculateIndicators(mergedData);
                    }
                    if (transformedData.length < 5000) {
                        setHasMoreHistory(false);
                    }
                    break;

                case 'get_more_replay_history':
                    if (transformedData.length > 0) {
                        const mergedReplayData = mergeAndDeduplicate(transformedData, replayData);
                        const hasMore = transformedData.length >= 5000;

                        const originalLength = replayData.length;
                        const newLength = mergedReplayData.length;
                        const addedCount = newLength - originalLength;

                        const currentState = useTradingProStore.getState();
                        const newCurrentIndex = currentState.replayCurrentIndex + addedCount;

                        currentState.setReplayData(mergedReplayData, newCurrentIndex);
                        setHasMoreHistory(hasMore);
                        recalculateIndicators(mergedReplayData);
                    } else {
                        setHasMoreHistory(false);
                    }
                    break;

                case 'get_full_dataset':
                    loadReplayData(deduplicateAndSort(transformedData), 0, null);
                    break;

                case 'get_future_replay_chunk':
                    if (transformedData.length > 0) {
                        const mergedReplayData = mergeAndDeduplicate(replayData, transformedData);
                        const currentState = useTradingProStore.getState();
                        currentState.setReplayData(mergedReplayData, currentState.replayCurrentIndex);
                        recalculateIndicators(mergedReplayData);
                    }
                    break;

                default:
                    console.warn('Unknown WebSocket action:', response.action);
            }
        } catch (error) {
            console.error('Error handling WebSocket message:', error);
        }
    }

    public disconnect() {
        if (this.socket) {
            this.socket.close();
        }
    }
}

export const webSocketService = new WebSocketService();