// Main drawing manager (this is what components should use)
export { useDrawingManager } from './useDrawingManager';

// Individual drawing services (for advanced usage or debugging)
export { useTrendlineService } from './useTrendlineService';
export { useVerticalLineService } from './useVerticalLineService';
export { useHorizontalRayService } from './useHorizontalRayService';
export { useFibRetracementService } from './useFibRetracementService';
export { useRectangleService } from './useRectangleService'; // NEW
export { usePositionService } from './usePositionService'; // NEW

// Types
export type { InProgressDrawing } from './useDrawingManager';
export type { InProgressTrendline } from './useTrendlineService';
export type { InProgressVerticalLine } from './useVerticalLineService';
export type { InProgressHorizontalRay } from './useHorizontalRayService';
export type { InProgressFibRetracement } from './useFibRetracementService';
export type { InProgressRectangle } from './useRectangleService'; // NEW
export type { InProgressPosition } from './usePositionService'; // NEW
