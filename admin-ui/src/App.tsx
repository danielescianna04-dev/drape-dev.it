import { useState } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./hooks/useAuth";
import { Layout } from "./components/layout/Layout";
import { apiCall } from "./lib/api";
import { Loader2, LogIn } from "lucide-react";

import OverviewPage from "./pages/OverviewPage";
import UsersPage from "./pages/UsersPage";
import ProjectsPage from "./pages/ProjectsPage";
import PublishedSitesPage from "./pages/PublishedSitesPage";
import ReportPage from "./pages/ReportPage";
import BehaviorPage from "./pages/BehaviorPage";
import ContainersPage from "./pages/ContainersPage";
import TasksPage from "./pages/TasksPage";

function LoginScreen({ onLogin, error }: { onLogin: (email: string, password: string) => Promise<void>; error: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    await onLogin(email, password);
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white font-bold text-2xl mx-auto mb-6">
            D
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Drape Admin</h1>
          <p className="text-zinc-400 text-sm">
            Accedi per continuare
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs text-zinc-500 uppercase tracking-wide mb-1.5">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@example.com"
              autoComplete="email"
              className="w-full px-4 py-3 bg-[#111] border border-white/[0.06] rounded-lg text-white placeholder-zinc-600 outline-none focus:border-purple-500/50 transition-colors"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-xs text-zinc-500 uppercase tracking-wide mb-1.5">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full px-4 py-3 bg-[#111] border border-white/[0.06] rounded-lg text-white placeholder-zinc-600 outline-none focus:border-purple-500/50 transition-colors"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting || !email || !password}
            className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            Accedi
          </button>
        </form>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
    </div>
  );
}

export default function App() {
  const { user, loading, isAdmin, signInWithEmail, signOut, error } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ["admin", "stats-overview"],
    queryFn: () => apiCall<{ totalUsers?: number }>("/admin/stats/overview"),
    enabled: !!user && isAdmin,
    refetchInterval: 60000,
  });

  const { data: diagnostics } = useQuery({
    queryKey: ["admin", "diagnostics"],
    queryFn: () => apiCall<{ runningContainers?: number; totalContainers?: number }>("/fly/diagnostics"),
    enabled: !!user && isAdmin,
    refetchInterval: 30000,
  });

  if (loading) return <LoadingScreen />;

  if (!user || !isAdmin) {
    return <LoginScreen onLogin={signInWithEmail} error={error} />;
  }

  function handleNavigate(path: string) {
    if (path === "/logout") {
      signOut();
      return;
    }
    navigate(path);
  }

  const currentPage = location.pathname;

  const badges = {
    users: stats?.totalUsers,
    containers:
      diagnostics?.runningContainers !== undefined && diagnostics?.totalContainers !== undefined
        ? `${diagnostics.runningContainers}/${diagnostics.totalContainers}`
        : undefined,
  };

  return (
    <Layout
      currentPage={currentPage}
      onNavigate={handleNavigate}
      userEmail={user.email || ""}
      badges={badges}
    >
      <Routes>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/published" element={<PublishedSitesPage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/behavior" element={<BehaviorPage />} />
        <Route path="/containers" element={<ContainersPage />} />
        <Route path="/tasks" element={<TasksPage />} />
      </Routes>
    </Layout>
  );
}
