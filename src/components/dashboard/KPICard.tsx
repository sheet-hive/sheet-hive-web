export interface KPICardProps {
  title: string;
  value: string | number;
  icon?: string;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  loading?: boolean;
}

export default function KPICard({
  title,
  value,
  subtitle,
  trend,
  loading = false,
}: KPICardProps) {
  return (
    <div className="bg-white dark:bg-neutral-800 p-6 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 transition-all hover:shadow-md">
      <div className="mb-2">
        <h3 className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
          {title}
        </h3>
      </div>

      {loading ? (
        <div className="animate-pulse">
          <div className="h-9 bg-neutral-200 dark:bg-neutral-700 rounded w-24 mb-2"></div>
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-16"></div>
        </div>
      ) : (
        <>
          <div className="text-3xl font-bold text-neutral-900 dark:text-white mb-1">
            {typeof value === "number" ? value.toLocaleString() : value}
          </div>

          <div className="flex items-center gap-2">
            {subtitle && (
              <div className="text-xs text-neutral-500">{subtitle}</div>
            )}
            {trend && (
              <div
                className={`text-xs font-medium ${
                  trend.isPositive
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
