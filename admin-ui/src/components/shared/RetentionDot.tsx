interface RetentionDotProps {
  status: "active" | "dormant" | "churned" | "bounced";
  label: string;
}

const dotColors: Record<RetentionDotProps["status"], string> = {
  active: "bg-green-500",
  dormant: "bg-amber-500",
  churned: "bg-red-500",
  bounced: "bg-zinc-500",
};

export function RetentionDot({ status, label }: RetentionDotProps) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColors[status]}`} />
      <span className="text-xs text-zinc-400">{label}</span>
    </span>
  );
}
