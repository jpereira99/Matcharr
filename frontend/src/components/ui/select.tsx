import { cn } from "@/lib/utils";
import { Check, ChevronDown, Search } from "lucide-react";
import {
  Children,
  Fragment,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type OptionItem = {
  value: string;
  label: ReactNode;
  text: string;
  disabled: boolean;
};

function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean")
    return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node))
    return textOf((node.props as { children?: ReactNode }).children);
  return "";
}

/** Flatten `<option>` children (including fragments and conditionals). */
function collectOptions(children: ReactNode): OptionItem[] {
  const out: OptionItem[] = [];
  const walk = (nodes: ReactNode) =>
    Children.forEach(nodes, (child) => {
      if (!isValidElement(child)) return;
      const el = child as ReactElement<{
        value?: string | number;
        disabled?: boolean;
        children?: ReactNode;
      }>;
      if (el.type === "option") {
        const text = textOf(el.props.children);
        out.push({
          value: String(el.props.value ?? text),
          label: el.props.children,
          text,
          disabled: !!el.props.disabled,
        });
      } else if (el.type === Fragment) walk(el.props.children);
    });
  walk(children);
  return out;
}

type Props = {
  id?: string;
  value?: string | number | null;
  /** Mirrors a native select so handlers can keep reading `e.target.value`. */
  onChange?: (e: { target: { value: string } }) => void;
  disabled?: boolean;
  mono?: boolean;
  /** Defaults to on for lists longer than 10 options. */
  searchable?: boolean;
  className?: string;
  wrapperClassName?: string;
  "aria-label"?: string;
  children: ReactNode;
};

const LIST_MAX_HEIGHT = 288;

export function Select({
  id,
  value,
  onChange,
  disabled,
  mono,
  searchable,
  className,
  wrapperClassName,
  "aria-label": ariaLabel,
  children,
}: Props) {
  const listId = useId();
  const options = collectOptions(children);
  const selected = options.find((o) => o.value === String(value ?? ""));
  const canSearch = searchable ?? options.length > 10;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const q = query.trim().toLowerCase();
  const shown = q
    ? options.filter((o) => o.text.toLowerCase().includes(q))
    : options;

  function openList() {
    if (disabled || !triggerRef.current) return;
    setRect(triggerRef.current.getBoundingClientRect());
    setQuery("");
    setActive(Math.max(0, options.indexOf(selected as OptionItem)));
    setOpen(true);
  }

  function close(refocus = true) {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }

  function choose(o: OptionItem | undefined) {
    if (!o || o.disabled) return;
    if (o.value !== String(value ?? ""))
      onChange?.({ target: { value: o.value } });
    close();
  }

  function move(delta: number) {
    if (!shown.length) return;
    let i = active;
    for (let step = 0; step < shown.length; step++) {
      i = (i + delta + shown.length) % shown.length;
      if (!shown[i].disabled) break;
    }
    setActive(i);
  }

  function onListKey(e: KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        move(-1);
        break;
      case "Home":
        if (!canSearch) {
          e.preventDefault();
          setActive(0);
        }
        break;
      case "End":
        if (!canSearch) {
          e.preventDefault();
          setActive(shown.length - 1);
        }
        break;
      case "Enter":
        e.preventDefault();
        choose(shown[active]);
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        close();
        break;
      case "Tab":
        close(false);
        break;
      default:
        if (!canSearch && e.key.length === 1) {
          const k = e.key.toLowerCase();
          const start = active + 1;
          const hit = [...shown.slice(start), ...shown.slice(0, start)].find(
            (o) => !o.disabled && o.text.toLowerCase().startsWith(k),
          );
          if (hit) setActive(shown.indexOf(hit));
        }
    }
  }

  // Close on outside press; follow the trigger when the page scrolls or resizes.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!popRef.current?.contains(t) && !triggerRef.current?.contains(t))
        close(false);
    };
    const reposition = (e: Event) => {
      if (e.target instanceof Node && popRef.current?.contains(e.target))
        return;
      if (triggerRef.current)
        setRect(triggerRef.current.getBoundingClientRect());
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);

  useEffect(() => {
    if (open && !canSearch) listRef.current?.focus();
  }, [open, canSearch]);

  useLayoutEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, active, query]);

  let popStyle: CSSProperties | undefined;
  if (rect) {
    const below = window.innerHeight - rect.bottom;
    const above = below < Math.min(LIST_MAX_HEIGHT, 200) && rect.top > below;
    popStyle = {
      position: "fixed",
      left: rect.left,
      minWidth: rect.width,
      maxWidth: Math.max(
        rect.width,
        Math.min(640, window.innerWidth - rect.left - 8),
      ),
      ...(above
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    };
  }

  const activeId = shown[active] ? `${listId}-${active}` : undefined;

  return (
    <div className={cn("relative", wrapperClassName)}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={(e) => {
          if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
            e.preventDefault();
            openList();
          }
        }}
        className={cn(
          "flex w-full cursor-pointer items-center justify-between gap-2 rounded-(--radius-md) border border-(--color-border) bg-(--color-surface) px-3 py-2 text-left text-(--color-foreground) transition-all duration-150 outline-none",
          "focus-visible:border-(--color-accent) focus-visible:ring-2 focus-visible:ring-(--color-accent)/30 focus-visible:ring-offset-0",
          "disabled:cursor-not-allowed disabled:opacity-50",
          open && "border-(--color-accent) ring-2 ring-(--color-accent)/30",
          mono ? "font-mono text-xs" : "text-sm",
          className,
        )}
      >
        <span
          className={cn(
            "min-w-0 truncate",
            !selected && "text-(--color-muted)",
          )}
        >
          {selected?.label ?? options[0]?.label ?? "\u00a0"}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 flex-none text-(--color-muted) transition-transform duration-150",
            open && "rotate-180",
          )}
        />
      </button>

      {open &&
        popStyle &&
        createPortal(
          <div
            ref={popRef}
            style={popStyle}
            className="z-[70] flex flex-col overflow-hidden rounded-(--radius-md) border border-(--color-border) bg-(--color-surface) shadow-(--shadow-dropdown)"
          >
            {canSearch && (
              <div className="flex items-center gap-2 border-b border-(--color-border) px-3 py-2">
                <Search className="h-3.5 w-3.5 flex-none text-(--color-muted)" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  onKeyDown={onListKey}
                  placeholder="Search…"
                  role="searchbox"
                  aria-controls={listId}
                  aria-activedescendant={activeId}
                  className="min-w-0 flex-1 border-none bg-transparent text-sm text-(--color-foreground) outline-none placeholder:text-(--color-muted) focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
            )}
            <div
              ref={listRef}
              id={listId}
              role="listbox"
              tabIndex={-1}
              aria-activedescendant={activeId}
              onKeyDown={onListKey}
              className="overflow-y-auto p-1 outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
              style={{ maxHeight: LIST_MAX_HEIGHT }}
            >
              {shown.length === 0 && (
                <div className="px-2.5 py-2 text-xs text-(--color-muted)">
                  No matches
                </div>
              )}
              {shown.map((o, i) => {
                const isSelected = o === selected;
                return (
                  <div
                    key={`${o.value}-${i}`}
                    id={`${listId}-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={o.disabled || undefined}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(o)}
                    className={cn(
                      "flex cursor-pointer items-start gap-2 rounded-(--radius-sm) px-2.5 py-1.5 text-(--color-foreground)",
                      mono ? "font-mono text-xs" : "text-sm",
                      i === active && "bg-(--color-surface-raised)",
                      o.disabled && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <span className="min-w-0 flex-1 break-words">
                      {o.label}
                    </span>
                    <Check
                      className={cn(
                        "mt-0.5 h-3.5 w-3.5 flex-none text-(--color-accent)",
                        !isSelected && "invisible",
                      )}
                    />
                  </div>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
