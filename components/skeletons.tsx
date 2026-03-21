// Skeleton Loading Components

const BRAND = '#BE1E2D'
const BRAND_LIGHT = '#fef2f2'

export function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border p-4 animate-fadeIn">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-slate-200 animate-shimmer" />
        <div className="h-3 w-16 bg-slate-200 rounded animate-shimmer" />
      </div>
      <div className="h-8 w-16 bg-slate-200 rounded mb-1 animate-shimmer" />
      <div className="h-2.5 w-12 bg-slate-200 rounded animate-shimmer" />
    </div>
  )
}

export function ChartSkeleton() {
  return (
    <div className="bg-white rounded-2xl border p-5 animate-fadeIn">
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 w-24 bg-slate-200 rounded animate-shimmer" />
        <div className="h-3 w-32 bg-slate-200 rounded animate-shimmer" />
      </div>
      <div className="flex items-end gap-[3px] h-32">
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 bg-slate-200 rounded-t animate-shimmer"
            style={{
              height: `${Math.random() * 80 + 20}px`,
              animationDelay: `${i * 0.05}s`
            }}
          />
        ))}
      </div>
      <div className="flex justify-between mt-2">
        <div className="h-2 w-12 bg-slate-200 rounded animate-shimmer" />
        <div className="h-2 w-12 bg-slate-200 rounded animate-shimmer" />
      </div>
    </div>
  )
}

export function CityTableSkeleton() {
  return (
    <div className="bg-white rounded-2xl border overflow-hidden animate-fadeIn">
      <div className="px-5 py-4 border-b bg-slate-50">
        <div className="flex items-center justify-between">
          <div className="h-4 w-48 bg-slate-200 rounded animate-shimmer" />
          <div className="h-3 w-16 bg-slate-200 rounded animate-shimmer" />
        </div>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-12 px-5 py-2.5 border-b bg-slate-50/50">
        <div className="col-span-4 h-3 w-12 bg-slate-200 rounded animate-shimmer" />
        <div className="col-span-3 h-3 w-16 bg-slate-200 rounded mx-auto animate-shimmer" />
        <div className="col-span-2 h-3 w-12 bg-slate-200 rounded mx-auto animate-shimmer" />
        <div className="col-span-2 h-3 w-12 bg-slate-200 rounded mx-auto animate-shimmer" />
        <div className="col-span-1 h-3 w-8 bg-slate-200 rounded mx-auto animate-shimmer" />
      </div>

      {/* Table rows */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="grid grid-cols-12 px-5 py-3 items-center border-b">
          <div className="col-span-4 flex items-center gap-2">
            <div className="w-3.5 h-3.5 bg-slate-200 rounded animate-shimmer" />
            <div className="h-3.5 w-24 bg-slate-200 rounded animate-shimmer" />
          </div>
          <div className="col-span-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-slate-200 rounded-full h-2 animate-shimmer" />
              <div className="h-3.5 w-8 bg-slate-200 rounded animate-shimmer" />
            </div>
          </div>
          <div className="col-span-2 mx-auto h-3.5 w-6 bg-slate-200 rounded animate-shimmer" />
          <div className="col-span-2 mx-auto h-3.5 w-6 bg-slate-200 rounded animate-shimmer" />
          <div className="col-span-1 mx-auto h-3.5 w-4 bg-slate-200 rounded animate-shimmer" />
        </div>
      ))}
    </div>
  )
}

export function ReservationCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border overflow-hidden animate-fadeIn">
      <div className="px-5 py-3 bg-slate-50 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-slate-200 rounded animate-shimmer" />
          <div className="h-4 w-24 bg-slate-200 rounded animate-shimmer" />
        </div>
        <div className="h-5 w-16 bg-slate-200 rounded-full animate-shimmer" />
      </div>
      <div className="divide-y">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-2 h-2 rounded-full bg-slate-200 animate-shimmer" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-24 bg-slate-200 rounded animate-shimmer" />
                <div className="h-3 w-48 bg-slate-200 rounded animate-shimmer" />
              </div>
            </div>
            <div className="space-y-2 text-right">
              <div className="h-3 w-16 bg-slate-200 rounded ml-auto animate-shimmer" />
              <div className="h-3 w-12 bg-slate-200 rounded ml-auto animate-shimmer" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function DateInfoSkeleton() {
  return (
    <div className="bg-white rounded-2xl border p-5 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-3.5 w-20 bg-slate-200 rounded animate-shimmer" />
          <div className="h-5 w-64 bg-slate-200 rounded animate-shimmer" />
        </div>
        <div className="text-right space-y-2">
          <div className="h-3.5 w-24 bg-slate-200 rounded ml-auto animate-shimmer" />
          <div className="h-8 w-16 bg-slate-200 rounded ml-auto animate-shimmer" />
        </div>
      </div>
    </div>
  )
}

export function OverviewSkeleton() {
  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Detail cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border p-3 sm:p-4 flex items-center gap-2 sm:gap-3 animate-fadeIn">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-200 shrink-0 animate-shimmer" />
            <div className="space-y-2">
              <div className="h-6 w-12 bg-slate-200 rounded animate-shimmer" />
              <div className="h-3 w-16 bg-slate-200 rounded animate-shimmer" />
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <ChartSkeleton />

      {/* City table */}
      <CityTableSkeleton />

      {/* Summary card */}
      <div className="bg-white rounded-2xl border p-5 flex items-center justify-between animate-fadeIn">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-200 animate-shimmer" />
          <div className="space-y-2">
            <div className="h-3.5 w-24 bg-slate-200 rounded animate-shimmer" />
            <div className="h-3 w-32 bg-slate-200 rounded animate-shimmer" />
          </div>
        </div>
        <div className="h-9 w-16 bg-slate-200 rounded animate-shimmer" />
      </div>
    </div>
  )
}

export function TransfersSkeleton() {
  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="h-11 bg-white border rounded-xl animate-shimmer" />

      {/* Date selector */}
      <div className="flex flex-wrap items-center gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-9 w-24 bg-white border rounded-xl animate-shimmer" />
        ))}
      </div>

      {/* Date info */}
      <DateInfoSkeleton />

      {/* Reservation cards */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <ReservationCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}