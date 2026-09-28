import { Layout } from "@/components/Layout";
import { api } from "@/lib/api";
import { setDisplayTimeZone } from "@/lib/date";
import { ActivityLogPage } from "@/pages/ActivityLog";
import { DashboardPage } from "@/pages/Dashboard";
import { LeagueProfileDetailPage } from "@/pages/LeagueProfileDetail";
import { LeagueProfilesPage } from "@/pages/LeagueProfiles";
import { SettingsPage } from "@/pages/Settings";
import { TeamChannelDetailPage } from "@/pages/TeamChannelDetail";
import { TeamChannelsPage } from "@/pages/TeamChannels";
import { useQuery } from "@tanstack/react-query";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

function LegacyLogsRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/activity${search}`} replace />;
}

export default function App() {
  const settingsQ = useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
    staleTime: Infinity,
  });
  // Pages re-render with App, so every formatter picks up the new zone.
  setDisplayTimeZone(settingsQ.data?.timezone);

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/profiles" element={<LeagueProfilesPage />} />
        <Route path="/profiles/:id" element={<LeagueProfileDetailPage />} />
        <Route path="/teams" element={<TeamChannelsPage />} />
        <Route path="/teams/:id" element={<TeamChannelDetailPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/activity" element={<ActivityLogPage />} />
        <Route path="/logs" element={<LegacyLogsRedirect />} />
      </Routes>
    </Layout>
  );
}
