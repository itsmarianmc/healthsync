/**
 * Module-level Set that persists across React component mount/unmount cycles.
 * Used to suppress entry animations on revisit.
 */
export const visitedRoutes = new Set<string>();
