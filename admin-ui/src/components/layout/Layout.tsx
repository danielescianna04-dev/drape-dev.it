import { useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";

interface LayoutProps {
  currentPage: string;
  onNavigate: (path: string) => void;
  userEmail: string;
  badges: {
    users?: number;
    containers?: string;
  };
  children: React.ReactNode;
}

export function Layout({
  currentPage,
  onNavigate,
  userEmail,
  badges,
  children,
}: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-black">
      <Sidebar
        currentPage={currentPage}
        onNavigate={onNavigate}
        userEmail={userEmail}
        badges={badges}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Mobile header */}
      <div className="fixed top-0 left-0 right-0 h-14 bg-black/80 backdrop-blur-md border-b border-white/[0.06] flex items-center px-4 z-30 lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 -ml-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.04]"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 ml-3">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white font-bold text-[10px]">
            D
          </div>
          <span className="text-white font-semibold text-sm">Drape Admin</span>
        </div>
      </div>

      {/* Main content */}
      <main className="lg:ml-[260px] min-h-screen pt-14 lg:pt-0">
        <div className="p-6 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
