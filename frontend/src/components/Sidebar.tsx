import { useSidebar } from "@/hooks/useSidebar";
import { cn } from "@/lib/utils";
import {
  Activity,
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Brand } from "./Brand";
import { ThemeToggle } from "./ui/theme-toggle";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/profiles", label: "League Profiles", icon: Trophy },
  { to: "/teams", label: "Team Channels", icon: Users },
  { to: "/activity", label: "Activity Log", icon: Activity },
  { to: "/settings", label: "Settings", icon: Settings },
];

function SidebarContent({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  /** Desktop only: collapse/expand control in the bottom bar. */
  onToggle?: () => void;
}) {
  return (
    <>
      {/* Brand */}
      <div
        className={cn(
          "flex items-center border-b border-(--color-border) px-4 py-5",
          collapsed ? "justify-center" : "gap-3",
        )}
      >
        {collapsed ? (
          <Brand markOnly className="h-[21px]" />
        ) : (
          <div className="flex h-9 items-center">
            <Brand className="h-6" />
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

      <div
        className={cn(
          "pb-2 text-[10px] text-(--color-muted) tabular-nums",
          collapsed ? "text-center" : "px-5",
        )}
        title={`Matcharr v${__APP_VERSION__}`}
      >
        v{__APP_VERSION__}
      </div>

      {/* Bottom */}
      <div
        className={cn(
          "flex border-t border-(--color-border) p-2",
          collapsed ? "flex-col items-center gap-0.5" : "items-center",
        )}
      >
        <ThemeToggle collapsed={collapsed} />
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            className={cn(
              "flex cursor-pointer rounded-(--radius-md) p-2 text-(--color-muted) transition-colors hover:bg-(--color-surface-raised) hover:text-(--color-foreground)",
              !collapsed && "ml-auto",
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        )}
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
        <Brand className="h-5" />
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
          <aside className="relative z-10 flex h-full w-[214px] flex-col bg-(--color-sidebar)">
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
          // Expanded width = the brand lockup (h-6) plus the brand row's px-4.
          collapsed ? "w-16" : "w-[214px]",
        )}
      >
        <SidebarContent collapsed={collapsed} onToggle={toggle} />
      </aside>
    </>
  );
}
