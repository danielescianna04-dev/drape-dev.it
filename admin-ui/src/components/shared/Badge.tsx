interface BadgeProps {
  variant: "plan" | "funnel" | "status" | "provider";
  value: string;
}

const planStyles: Record<string, string> = {
  free: "bg-zinc-500/15 text-zinc-400",
  go: "bg-blue-500/15 text-blue-400",
  pro: "bg-purple-500/15 text-purple-400",
};

const funnelStyles: Record<string, string> = {
  registered: "bg-zinc-500/15 text-zinc-400",
  onboarded: "bg-blue-500/15 text-blue-400",
  project: "bg-purple-500/15 text-purple-400",
  engaged: "bg-green-500/15 text-green-400",
  paid: "bg-amber-500/15 text-amber-400",
};

const statusStyles: Record<string, string> = {
  running: "bg-green-500/15 text-green-400",
  creating: "bg-amber-500/15 text-amber-400",
  stopped: "bg-zinc-500/15 text-zinc-400",
  exited: "bg-zinc-500/15 text-zinc-400",
};

const providerIcons: Record<string, string> = {
  apple: "\uF8FF",
  google: "\uD83D\uDD35",
  email: "\u2709\uFE0F",
};

const providerStyles: Record<string, string> = {
  apple: "bg-zinc-500/15 text-zinc-300",
  google: "bg-blue-500/15 text-blue-400",
  email: "bg-zinc-500/15 text-zinc-300",
};

const variantMap: Record<string, Record<string, string>> = {
  plan: planStyles,
  funnel: funnelStyles,
  status: statusStyles,
  provider: providerStyles,
};

export function Badge({ variant, value }: BadgeProps) {
  const lower = value.toLowerCase();
  const styles = variantMap[variant]?.[lower] ?? "bg-zinc-500/15 text-zinc-400";
  const icon = variant === "provider" ? providerIcons[lower] : null;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold leading-tight ${styles}`}
    >
      {icon && <span className="text-xs">{icon}</span>}
      {value}
    </span>
  );
}
