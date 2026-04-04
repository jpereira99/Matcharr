import { useSidebar } from "@/hooks/useSidebar";
import { cn } from "@/lib/utils";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Menu,
  Radio,
  Settings,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { NavLink } from "react-router-dom";
import { ThemeToggle } from "./ui/theme-toggle";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/profiles", label: "League Profiles", icon: Trophy },
  { to: "/teams", label: "Team Channels", icon: Users },
  { to: "/logs", label: "Activity Log", icon: Activity },
  { to: "/settings", label: "Settings", icon: Settings },
];

function SidebarContent({ collapsed }: { collapsed: boolean }) {
  return (
    <>
      {/* Brand */}
      <div
        className={cn(
          "flex items-center border-b border-(--color-border) px-4 py-5",
          collapsed ? "justify-center" : "gap-3",
        )}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-(--radius-lg) bg-(--color-accent) shadow-md">
          <Radio className="h-4.5 w-4.5 text-(--color-accent-foreground)" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="font-heading text-sm font-extrabold tracking-tight text-(--color-foreground)">
              Matcharr
            </div>
            <div className="text-[10px] text-(--color-muted)">
              Stream Router
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "group relative flex items-center rounded-(--radius-md) transition-colors duration-150",
                collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
                isActive
                  ? "bg-(--color-accent)/10 text-(--color-accent)"
                  : "text-(--color-muted) hover:bg-(--color-surface-raised) hover:text-(--color-foreground)",
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-(--color-accent)" />
                )}
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && (
                  <span className="text-sm font-medium">{label}</span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-(--color-border) p-2">
        <ThemeToggle collapsed={collapsed} />
      </div>
    </>
  );
}

export function Sidebar() {
  const { collapsed, toggle } = useSidebar();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-(--color-border) bg-(--color-sidebar) px-4 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-(--radius-md) p-1.5 text-(--color-muted) hover:bg-(--color-surface-raised) hover:text-(--color-foreground)"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-(--radius-md) bg-(--color-accent)">
            <Radio className="h-3.5 w-3.5 text-(--color-accent-foreground)" />
          </div>
          <span className="font-heading text-sm font-extrabold">Matcharr</span>
        </div>
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          />
          <aside className="relative z-10 flex h-full w-64 flex-col bg-(--color-sidebar)">
            <div className="flex items-center justify-end p-2">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-(--radius-md) p-1.5 text-(--color-muted) hover:bg-(--color-surface-raised)"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <SidebarContent collapsed={false} />
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen flex-col border-r border-(--color-border) bg-(--color-sidebar) transition-[width] duration-200 md:flex",
          collapsed ? "w-16" : "w-[260px]",
        )}
      >
        <SidebarContent collapsed={collapsed} />
        <button
          type="button"
          onClick={toggle}
          className="absolute top-7 -right-3 z-20 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-(--color-border) bg-(--color-surface) text-(--color-muted) shadow-sm transition-colors hover:text-(--color-foreground)"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronLeft className="h-3 w-3" />
          )}
        </button>
      </aside>
    </>
  );
}
