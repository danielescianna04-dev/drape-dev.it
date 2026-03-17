import { TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: number;
  trendLabel?: string;
  sparkline?: number[];
  onClick?: () => void;
}

export function StatCard({
  label,
  value,
  trend,
  trendLabel,
  sparkline,
  onClick,
}: StatCardProps) {
  const isPositive = trend !== undefined && trend >= 0;

  const maxVal = sparkline ? Math.max(...sparkline, 1) : 1;
  const barWidth = sparkline ? Math.max(4, Math.floor(60 / sparkline.length)) : 4;
  const barGap = 2;
  const chartHeight = 32;
  const chartWidth = sparkline
    ? sparkline.length * (barWidth + barGap) - barGap
    : 0;

  return (
    <div
      onClick={onClick}
      className={`bg-[#111] border border-white/[0.06] rounded-xl p-5 transition-colors ${
        onClick ? "cursor-pointer hover:border-purple-500/30 hover:bg-white/[0.02]" : ""
      }`}
    >
      <p className="text-xs text-zinc-500 uppercase tracking-wide mb-3">
        {label}
      </p>

      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-2xl font-bold text-white truncate">{value}</p>

          {trend !== undefined && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
                  isPositive ? "text-green-500" : "text-red-500"
                }`}
              >
                {isPositive ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
                {Math.abs(trend)}%
              </span>
              {trendLabel && (
                <span className="text-xs text-zinc-500">{trendLabel}</span>
              )}
            </div>
          )}
        </div>

        {sparkline && sparkline.length > 0 && (
          <svg
            width={chartWidth}
            height={chartHeight}
            className="flex-shrink-0"
          >
            {sparkline.map((v, i) => {
              const h = Math.max(2, (v / maxVal) * chartHeight);
              return (
                <rect
                  key={i}
                  x={i * (barWidth + barGap)}
                  y={chartHeight - h}
                  width={barWidth}
                  height={h}
                  rx={1}
                  fill="#a855f7"
                  fillOpacity={0.6}
                />
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}
