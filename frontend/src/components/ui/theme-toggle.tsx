import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import type { ThemePreference } from "@/lib/theme";
import { Monitor, Moon, Sun } from "lucide-react";

const cycle: ThemePreference[] = ["dark", "light", "system"];
const icons: Record<ThemePreference, typeof Sun> = {
  dark: Moon,
  light: Sun,
  system: Monitor,
};
const labels: Record<ThemePreference, string> = {
  dark: "Dark",
  light: "Light",
  system: "System",
};

export function ThemeToggle({ collapsed }: { collapsed?: boolean }) {
  const { preference, setTheme } = useTheme();
  const Icon = icons[preference];

  function next() {
    const idx = cycle.indexOf(preference);
    setTheme(cycle[(idx + 1) % cycle.length]);
  }

  return (
    <button
      type="button"
      onClick={next}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-(--radius-md) px-2.5 py-2 text-xs font-medium transition-colors",
        "text-(--color-muted) hover:bg-(--color-surface-raised) hover:text-(--color-foreground)",
      )}
      title={`Theme: ${labels[preference]}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{labels[preference]}</span>}
    </button>
  );
}
