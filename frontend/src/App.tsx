import { Layout } from "@/components/Layout";
import { ActivityLogPage } from "@/pages/ActivityLog";
import { DashboardPage } from "@/pages/Dashboard";
import { LeagueProfilesPage } from "@/pages/LeagueProfiles";
import { SettingsPage } from "@/pages/Settings";
import { TeamChannelsPage } from "@/pages/TeamChannels";
import { Route, Routes } from "react-router-dom";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/profiles" element={<LeagueProfilesPage />} />
        <Route path="/teams" element={<TeamChannelsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/logs" element={<ActivityLogPage />} />
      </Routes>
    </Layout>
  );
}
