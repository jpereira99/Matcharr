import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { ReactNode } from "react";

/** Small destructive-action confirmation (title, body, Cancel + red action). */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  pending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      className="max-w-[420px]"
      showClose={false}
    >
      <p className="text-sm text-pretty text-(--color-muted)">{children}</p>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={pending}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

export function removeTeamBody(channel: string) {
  return `Matcharr stops switching channel ${channel} for this team. The channel in Dispatcharr stays as it is, and any overrides for its games are removed.`;
}

export function deleteProfileBody(teamCount: number) {
  return teamCount
    ? `${teamCount} team channel${teamCount === 1 ? "" : "s"} use${teamCount === 1 ? "s" : ""} this profile and will stop switching. Their channels in Dispatcharr stay as they are.`
    : "No team channels use this profile.";
}
