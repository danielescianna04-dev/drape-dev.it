import { type ReactNode } from "react";
import { Search } from "lucide-react";

export interface FilterDef {
  key: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}

interface FilterBarProps {
  search?: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
  };
  filters?: FilterDef[];
  children?: ReactNode;
}

export function FilterBar({ search, filters, children }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {search && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder ?? "Search..."}
            className="pl-9 pr-4 py-2 text-sm text-white placeholder-zinc-500 bg-[#111] border border-white/[0.06] rounded-lg outline-none focus:border-purple-500/40 transition-colors w-64"
          />
        </div>
      )}

      {filters?.map((f) => (
        <select
          key={f.key}
          value={f.value}
          onChange={(e) => f.onChange(e.target.value)}
          className="px-3 py-2 text-sm text-white bg-[#111] border border-white/[0.06] rounded-lg outline-none focus:border-purple-500/40 transition-colors appearance-none cursor-pointer"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 10px center",
            paddingRight: "2rem",
          }}
        >
          <option value="" className="bg-[#111]">
            {f.label}
          </option>
          {f.options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[#111]">
              {opt.label}
            </option>
          ))}
        </select>
      ))}

      {children}
    </div>
  );
}
