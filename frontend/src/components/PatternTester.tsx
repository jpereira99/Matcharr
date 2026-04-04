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
        setResult("Matched — captured groups below.");
      } else {
        setResult(
          "No match — adjust the pattern to mirror your provider's title format.",
        );
      }
    } catch (e) {
      setResult(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 rounded-(--radius-lg) border border-dashed border-(--color-border) bg-(--color-surface-raised)/50 p-4">
      <div className="text-xs font-semibold tracking-wide text-(--color-muted) uppercase">
        Pattern Tester
      </div>
      <p className="mt-2 text-xs text-(--color-muted)">
        Paste a real stream title from Dispatcharr to verify your pattern
        captures team names correctly.
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <Label>Sample stream name</Label>
          <Input
            value={sample}
            onChange={(e) => setSample(e.target.value)}
            className="font-mono text-xs"
          />
        </div>
        <div className="flex items-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void run()}
            disabled={loading}
          >
            {loading ? "Testing..." : "Test Pattern"}
          </Button>
        </div>
      </div>
      {result && (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-(--color-foreground)">{result}</p>
          {groups && Object.keys(groups).length > 0 && (
            <ul className="rounded-(--radius-md) bg-(--color-surface) px-3 py-2 font-mono text-xs text-(--color-foreground)">
              {Object.entries(groups).map(([k, v]) => (
                <li key={k}>
                  <span className="text-(--color-muted)">{k}:</span> {v}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
