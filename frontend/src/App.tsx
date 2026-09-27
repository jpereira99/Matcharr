import { Layout } from "@/components/Layout";
import { ActivityLogPage } from "@/pages/ActivityLog";
import { DashboardPage } from "@/pages/Dashboard";
import { LeagueProfileDetailPage } from "@/pages/LeagueProfileDetail";
import { LeagueProfilesPage } from "@/pages/LeagueProfiles";
import { SettingsPage } from "@/pages/Settings";
import { TeamChannelDetailPage } from "@/pages/TeamChannelDetail";
import { TeamChannelsPage } from "@/pages/TeamChannels";
import { Route, Routes } from "react-router-dom";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/profiles" element={<LeagueProfilesPage />} />
        <Route path="/profiles/:id" element={<LeagueProfileDetailPage />} />
        <Route path="/teams" element={<TeamChannelsPage />} />
        <Route path="/teams/:id" element={<TeamChannelDetailPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/logs" element={<ActivityLogPage />} />
      </Routes>
    </Layout>
  );
}
