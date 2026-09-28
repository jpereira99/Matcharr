import { cn } from "@/lib/utils";
import { Check, Plus, X } from "lucide-react";
import { useState } from "react";

type Tone = "danger" | "neutral";

const CHIP_TONES: Record<Tone, { chip: string; remove: string }> = {
  danger: {
    chip: "bg-(--color-danger)/15 text-(--color-danger)",
    remove:
      "text-(--color-danger) opacity-80 hover:bg-(--color-danger)/15 hover:opacity-100",
  },
  neutral: {
    chip: "bg-(--color-surface-raised) text-(--color-foreground)",
    remove:
      "text-(--color-muted) hover:bg-(--color-surface) hover:text-(--color-foreground)",
  },
};

export function Chip({
  term,
  tone,
  onRemove,
}: {
  term: string;
  tone: Tone;
  onRemove: () => void;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-(--radius-sm) py-1 pr-1.5 pl-2.5 font-mono text-xs whitespace-pre",
        CHIP_TONES[tone].chip,
      )}
    >
      {term}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${term}`}
        className={cn(
          "flex cursor-pointer rounded p-0.5 transition-colors duration-150",
          CHIP_TONES[tone].remove,
        )}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

const SUGGESTION_TONES = {
  danger:
    "border-(--color-danger)/45 hover:border-(--color-danger) hover:bg-(--color-danger)/10",
  accent:
    "border-(--color-accent)/50 hover:border-(--color-accent) hover:bg-(--color-accent)/10",
};

export function SuggestionChip({
  term,
  tone,
  title,
  onAdd,
  className,
}: {
  term: string;
  tone: keyof typeof SUGGESTION_TONES;
  title?: string;
  onAdd: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onAdd}
      title={title}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 rounded-(--radius-sm) border border-dashed py-[3px] pr-2.5 pl-2 font-mono text-xs whitespace-pre text-(--color-foreground) transition-colors duration-150",
        SUGGESTION_TONES[tone],
        className,
      )}
    >
      <Plus
        className={cn(
          "h-[11px] w-[11px]",
          tone === "accent" && "text-(--color-accent)",
        )}
      />
      {term}
    </button>
  );
}

/** Dashed "+ Add" chip that turns into an inline input. Enter/✓/blur commit, Esc cancels. */
export function AddChip({
  onAdd,
  placeholder,
  inputWidth = 90,
}: {
  onAdd: (term: string) => void;
  placeholder?: string;
  inputWidth?: number;
}) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");

  const close = () => {
    setAdding(false);
    setValue("");
  };
  const commit = () => {
    const v = value.trim();
    if (v) onAdd(v);
    close();
  };

  if (!adding)
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-(--radius-sm) border border-dashed border-(--color-border) py-[3px] pr-2.5 pl-2 text-xs font-medium text-(--color-muted) transition-colors duration-150 hover:border-(--color-muted) hover:text-(--color-foreground)"
      >
        <Plus className="h-[11px] w-[11px]" />
        Add
      </button>
    );

  return (
    <span className="inline-flex items-center gap-1 rounded-(--radius-sm) border border-(--color-accent) bg-(--color-surface) pr-1 pl-2 ring-2 ring-(--color-accent)/30">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            e.stopPropagation();
            close();
          }
        }}
        onBlur={commit}
        placeholder={placeholder}
        spellCheck={false}
        style={{ width: inputWidth }}
        className="border-none bg-transparent py-1 font-mono text-xs text-(--color-foreground) outline-none placeholder:text-(--color-muted) focus-visible:ring-0 focus-visible:ring-offset-0"
      />
      <button
        type="button"
        aria-label="Add"
        onMouseDown={(e) => {
          e.preventDefault();
          commit();
        }}
        className="flex cursor-pointer p-0.5 text-(--color-accent)"
      >
        <Check className="h-3 w-3" />
      </button>
    </span>
  );
}
