// timeframeCalculator.ts

/**
 * Parses a timeframe string (e.g., "5M", "4H", "1D") into its equivalent in minutes.
 */
export const parseTimeframeToMinutes = (timeframe: string): number => {
    const tf = timeframe.toUpperCase();
    const value = parseInt(tf.replace(/[A-Z]/g, '')) || 1;

    if (tf.endsWith('MO')) return value * 30 * 24 * 60; // Approximation
    if (tf.endsWith('W')) return value * 7 * 24 * 60;
    if (tf.endsWith('D')) return value * 24 * 60;
    if (tf.endsWith('H')) return value * 60;
    if (tf.endsWith('M') || !isNaN(parseInt(tf))) return value;

    throw new Error(`Unsupported timeframe: ${timeframe}`);
};

/**
 * Calculates the end date for a replay data request based on the robust manual logic.
 */
export const calculateReplayEndDate = (
    anchorTime: number,
    anchorTimeframe: string,
    targetTimeframe: string
): string => {
    const anchorTimeMs = anchorTime * 1000;
    const anchorTfMinutes = parseTimeframeToMinutes(anchorTimeframe);
    const targetTfMinutes = parseTimeframeToMinutes(targetTimeframe);

    let endDateMs: number;

    // Rule 1: Switching to a HIGHER timeframe (e.g., 1H -> 4H)
    if (targetTfMinutes > anchorTfMinutes) {
        // Use the anchor candle's start time as the end date.
        const anchorDurationMs = anchorTfMinutes * 60 * 1000;
        // This fetches all candles that completed *after* the anchor.
        endDateMs = anchorTimeMs + anchorDurationMs + (60 * 60 * 1000);
    } 
    // Rule 2: Switching to a LOWER or SAME timeframe (e.g., 4H -> 1H)
    else {
        // DEBUG: Try setting end time much later to see what we get
        const anchorDurationMs = anchorTfMinutes * 60 * 1000;
        endDateMs = anchorTimeMs + anchorDurationMs + (60 * 60 * 1000); 
    }

    return new Date(endDateMs).toISOString();
};