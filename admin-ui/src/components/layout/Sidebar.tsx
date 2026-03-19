import {
  LayoutDashboard,
  Users,
  FolderOpen,
  Globe,
  BarChart3,
  Brain,
  Container,
  LogOut,
  X,
  Flag,
} from "lucide-react";

interface SidebarProps {
  currentPage: string;
  onNavigate: (path: string) => void;
  userEmail: string;
  badges: {
    users?: number;
    containers?: string;
  };
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  badge?: string | number;
}

export function Sidebar({
  currentPage,
  onNavigate,
  userEmail,
  badges,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const menuItems: NavItem[] = [
    { icon: LayoutDashboard, label: "Overview", path: "/" },
    { icon: Users, label: "Utenti", path: "/users", badge: badges.users },
    { icon: FolderOpen, label: "Progetti", path: "/projects" },
    { icon: Globe, label: "Siti Pubblicati", path: "/published" },
    { icon: Flag, label: "Task Board", path: "/tasks" },
  ];

  const analyticsItems: NavItem[] = [
    { icon: BarChart3, label: "Report", path: "/report" },
    { icon: Brain, label: "Comportamento", path: "/behavior" },
  ];

  const systemItems: NavItem[] = [
    {
      icon: Container,
      label: "Containers",
      path: "/containers",
      badge: badges.containers,
    },
  ];

  function handleNav(path: string) {
    onNavigate(path);
    onMobileClose?.();
  }

  function isActive(path: string) {
    if (path === "/") return currentPage === "/";
    return currentPage.startsWith(path);
  }

  function renderSection(title: string, items: NavItem[]) {
    return (
      <div className="mb-6">
        <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-3 mb-2">
          {title}
        </p>
        <div className="flex flex-col gap-0.5">
          {items.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => handleNav(item.path)}
                className={`flex items-center gap-3 w-full px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  active
                    ? "bg-purple-500/12 text-purple-400"
                    : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.badge !== undefined && item.badge !== 0 && (
                  <span
                    className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${
                      active
                        ? "bg-purple-500/20 text-purple-400"
                        : "bg-white/[0.06] text-zinc-400"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const sidebarContent = (
    <div className="flex flex-col h-full w-[260px] bg-black border-r border-white/[0.06]">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white font-bold text-sm">
          D
        </div>
        <span className="text-white font-semibold text-lg">Drape</span>
        <span className="text-[10px] font-semibold text-purple-400 bg-purple-500/15 px-2 py-0.5 rounded-full uppercase tracking-wide">
          Admin
        </span>

        {/* Mobile close button */}
        <button
          onClick={onMobileClose}
          className="ml-auto p-1 text-zinc-400 hover:text-white lg:hidden"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto">
        {renderSection("MENU", menuItems)}
        {renderSection("ANALYTICS", analyticsItems)}
        {renderSection("SISTEMA", systemItems)}
      </nav>

      {/* User info */}
      <div className="border-t border-white/[0.06] px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 text-xs font-bold uppercase">
            {userEmail?.charAt(0) || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white truncate">{userEmail}</p>
            <p className="text-xs text-zinc-500">Amministratore</p>
          </div>
          <button
            onClick={() => handleNav("/logout")}
            className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors rounded-md hover:bg-white/[0.04]"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block fixed top-0 left-0 h-screen z-40">
        {sidebarContent}
      </aside>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed top-0 left-0 h-screen z-50 lg:hidden transition-transform duration-200 ease-in-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
