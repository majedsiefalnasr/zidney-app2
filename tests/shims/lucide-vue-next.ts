// Test shim for `lucide-vue-next`.
// Export minimal component objects to satisfy imports during tests.

const asComponent = () => ({ render: () => null })

export const AlertCircle = asComponent() as any
export const Award = asComponent() as any
export const BarChart3 = asComponent() as any
export const Check = asComponent() as any
export const CheckCircle = asComponent() as any
export const Download = asComponent() as any
export const Globe = asComponent() as any
export const Info = asComponent() as any
export const Loader = asComponent() as any
export const RefreshCw = asComponent() as any
export const TrendingUp = asComponent() as any
export const TrendingDown = asComponent() as any
export const Activity = asComponent() as any
export const Users = asComponent() as any
export const WifiOff = asComponent() as any
export const LineChart = asComponent() as any

export default {}
