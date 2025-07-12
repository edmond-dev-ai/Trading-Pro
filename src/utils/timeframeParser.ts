export const parseTimeframeInput = (input: string): { api: string, display: string } | null => {
    if (!input) return null;

    const sanitized = input.toLowerCase().trim();
    // Regex to capture a number followed by an optional unit character (h,d,w,m)
    const match = sanitized.match(/^(\d+)([hdwmyo])?$/i); 

    // This block handles cases where the user types only numbers (e.g., "120")
    if (/^\d+$/.test(sanitized)) {
        const minutes = parseInt(sanitized, 10);
        if (minutes === 0) return null;
        
        if (minutes >= 43200 && minutes % 43200 === 0) {
            const months = minutes / 43200;
            return { api: `${months}Mo`, display: `${months} Month${months > 1 ? 's' : ''}` };
        }
        if (minutes >= 10080 && minutes % 10080 === 0) {
            const weeks = minutes / 10080;
            return { api: `${weeks}W`, display: `${weeks} Week${weeks > 1 ? 's' : ''}` };
        }
        if (minutes >= 1440 && minutes % 1440 === 0) {
            const days = minutes / 1440;
            return { api: `${days}D`, display: `${days} Day${days > 1 ? 's' : ''}` };
        }
        if (minutes >= 60 && minutes % 60 === 0) {
            const hours = minutes / 60;
            return { api: `${hours}H`, display: `${hours} Hour${hours > 1 ? 's' : ''}` };
        }
        return { api: `${minutes}m`, display: `${minutes} Minute${minutes > 1 ? 's' : ''}` };
    }


    if (!match) return null;

    const value = parseInt(match[1], 10);
    const unit = match[2];

    if (value === 0) return null;

    switch (unit) {
        case 'h':
            return { api: `${value}H`, display: `${value} Hour${value > 1 ? 's' : ''}` };
        case 'd':
            return { api: `${value}D`, display: `${value} Day${value > 1 ? 's' : ''}` };
        case 'w':
            return { api: `${value}W`, display: `${value} Week${value > 1 ? 's' : ''}` };
        case 'm':
             return { api: `${value}Mo`, display: `${value} Month${value > 1 ? 's' : ''}` };
        default:
           return null;
    }
};