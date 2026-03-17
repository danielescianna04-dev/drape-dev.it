interface ChipProps {
  label: string;
  count?: number;
  active?: boolean;
  onClick?: () => void;
}

export function Chip({ label, count, active = false, onClick }: ChipProps) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-purple-500 text-white border border-purple-500"
          : "bg-transparent border border-white/10 text-zinc-400 hover:border-purple-500/40 hover:text-zinc-300"
      }`}
    >
      {label}
      {count !== undefined && (
        <span className={active ? "text-white/70" : "text-zinc-500"}>
          {" "}({count})
        </span>
      )}
    </button>
  );
}
