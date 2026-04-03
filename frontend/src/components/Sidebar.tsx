import { cn } from "@/lib/utils";
import { Activity, LayoutDashboard, Radio, Settings, Trophy, Users } from "lucide-react";
import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/profiles", label: "League profiles", icon: Trophy },
  { to: "/teams", label: "Team channels", icon: Users },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/logs", label: "Activity log", icon: Activity },
];

export function Sidebar() {
  return (
    <aside className="sticky top-0 flex h-screen w-64 flex-col border-r border-white/5 bg-[var(--color-sidebar)]/95 backdrop-blur-xl">
      <div className="flex items-center gap-3 border-b border-white/5 px-6 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-fuchsia-500/30">
          <Radio className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="text-sm font-semibold tracking-tight">Matcharr</div>
          <div className="text-xs text-[var(--color-muted)]">Dispatcharr router</div>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                isActive
                  ? "bg-white/10 text-white shadow-inner shadow-black/20"
                  : "text-[var(--color-muted)] hover:bg-white/5 hover:text-white",
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0 opacity-90" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/5 p-4 text-[10px] leading-relaxed text-[var(--color-muted)]">
        Streams are discovered via Dispatcharr&apos;s API. Patterns map ESPN schedules to stream names.
      </div>
    </aside>
  );
}
