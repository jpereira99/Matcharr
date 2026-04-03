import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useState } from "react";

type Props = {
  pattern: string;
};

export function PatternTester({ pattern }: Props) {
  const [sample, setSample] = useState(
    "MLB 1 | Twins x Royals start:2026-04-02 19:10:00 stop:2026-04-03 02:23:20",
  );
  const [result, setResult] = useState<string | null>(null);
  const [groups, setGroups] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setResult(null);
    setGroups(null);
    try {
      const r = await api.testPattern(pattern, sample);
      if (r.error) {
        setResult(`Error: ${r.error}`);
      } else if (r.matched) {
        setGroups(r.groups);
        setResult("Matched — captured groups below. These names are what the router compares to ESPN (and your aliases).");
      } else {
        setResult("No match — adjust the pattern so it mirrors your provider’s title format (spacing, vs vs x, etc.).");
      }
    } catch (e) {
      setResult(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-dashed border-white/15 bg-black/20 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Pattern tester</div>
      <p className="mt-2 text-xs text-[var(--color-muted)]">
        Paste a real stream title from Dispatcharr. A successful match shows which substring becomes “away” and “home”
        for routing.
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <Label>Sample stream name</Label>
          <Input value={sample} onChange={(e) => setSample(e.target.value)} className="font-mono text-xs" />
        </div>
        <div className="flex items-end">
          <Button type="button" variant="ghost" onClick={() => void run()} disabled={loading}>
            {loading ? "Testing…" : "Test against pattern"}
          </Button>
        </div>
      </div>
      {result && (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-[var(--color-foreground)]">{result}</p>
          {groups && Object.keys(groups).length > 0 && (
            <ul className="rounded-lg bg-black/40 px-3 py-2 font-mono text-xs text-[var(--color-foreground)]">
              {Object.entries(groups).map(([k, v]) => (
                <li key={k}>
                  <span className="text-[var(--color-muted)]">{k}:</span> {v}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
