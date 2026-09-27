import { LeagueBadge } from "@/components/LeagueBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Toggle } from "@/components/ui/toggle";
import { api } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, Trophy } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

export function LeagueProfilesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["profiles"], queryFn: api.listProfiles });

  const remove = useMutation({
    mutationFn: api.deleteProfile,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["profiles"] }),
  });

  const toggleEnabled = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      api.updateProfile(id, { enabled }),
    onSuccess: (p) => {
      qc.setQueryData(["profile", p.id], p);
      void qc.invalidateQueries({ queryKey: ["profiles"] });
    },
  });

  if (q.isLoading)
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight">
            League Profiles
          </h1>
          <p className="mt-1 text-sm text-(--color-muted)">
            How Matcharr reads your provider&apos;s stream titles for each
            league.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => navigate("/profiles/new")}
        >
          <Plus className="h-3.5 w-3.5" />
          Create Profile
        </Button>
      </header>

      {!q.data?.length ? (
        <EmptyState
          icon={Trophy}
          title="No league profiles"
          description="Create a profile to start mapping ESPN schedules to your Dispatcharr streams."
          action={
            <Button size="sm" onClick={() => navigate("/profiles/new")}>
              <Plus className="h-3.5 w-3.5" /> Create Profile
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {q.data.map((p) => (
            <Card key={p.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <Link
                  to={`/profiles/${p.id}`}
                  className="flex min-w-0 items-center gap-2 hover:text-(--color-accent)"
                >
                  <LeagueBadge league={p.espn_league} />
                  <h3 className="truncate text-sm font-semibold">{p.name}</h3>
                </Link>
                <Toggle
                  checked={p.enabled}
                  onChange={(v) =>
                    toggleEnabled.mutate({ id: p.id, enabled: v })
                  }
                  label={p.enabled ? "Enabled" : "Disabled"}
                />
              </div>

              <div className="mt-3 rounded-(--radius-sm) bg-(--color-surface-raised) px-3 py-2 font-mono text-xs break-all text-(--color-foreground)">
                {p.stream_pattern || "—"}
              </div>

              {(p.stream_name_filter || p.exclude_terms.length > 0) && (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-(--color-muted)">
                  {p.stream_name_filter && (
                    <span>
                      Title contains{" "}
                      <span className="font-mono text-(--color-foreground)">
                        {p.stream_name_filter}
                      </span>
                    </span>
                  )}
                  {p.exclude_terms.length > 0 && (
                    <span>
                      Skips{" "}
                      <span className="font-mono text-(--color-danger)">
                        {p.exclude_terms.join(" ")}
                      </span>
                    </span>
                  )}
                </div>
              )}

              <div className="mt-auto flex items-center justify-between pt-4">
                <Badge variant="muted">
                  {p.team_channel_count ?? 0} team
                  {(p.team_channel_count ?? 0) !== 1 ? "s" : ""} mapped
                </Badge>
                <div className="flex gap-1">
                  <Link
                    to={`/profiles/${p.id}`}
                    className="cursor-pointer rounded-(--radius-sm) p-1.5 text-(--color-muted) transition-colors hover:bg-(--color-surface-raised) hover:text-(--color-foreground)"
                    aria-label="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete "${p.name}"?`)) remove.mutate(p.id);
                    }}
                    className="cursor-pointer rounded-(--radius-sm) p-1.5 text-(--color-muted) transition-colors hover:bg-(--color-danger)/10 hover:text-(--color-danger)"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
