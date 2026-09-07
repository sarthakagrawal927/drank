'use client';

import { TrendingUp } from 'lucide-react';
import { getFaviconUrl } from '@/lib/utils';
import type { Prediction } from '@/lib/types';

interface PredictionsPanelProps {
  predictions: Prediction[];
  nominate: {
    input: string;
    set: (v: string) => void;
  };
  onNominate: (domain: string, note?: string) => void;
  onRemovePrediction: (domain: string) => void;
  leaderboard: { domain: string; currentDR: number | null }[];
}

function buildPredictionShareText(predictions: Prediction[]): string {
  return predictions
    .map((p, i) => `${i + 1}. ${p.domain}${p.note ? ` — ${p.note}` : ''}`)
    .join('\n');
}

function sharePredictions(predictions: Prediction[]) {
  const text = buildPredictionShareText(predictions);
  const issueUrl = `https://github.com/sass-maker/drank/issues/new?labels=prediction&title=DR+Prediction+from+drank&body=${encodeURIComponent(`My predicted top performers:\n\n${text}\n\nSubmitted from the drank app at ${new Date().toISOString()}`)}`;
  window.open(issueUrl, '_blank', 'noopener,noreferrer');
  navigator.clipboard?.writeText(text).catch(() => {});
}

export function PredictionsPanel({
  predictions,
  nominate,
  onNominate,
  onRemovePrediction,
  leaderboard,
}: PredictionsPanelProps) {
  const { input: nominateInput, set: setNominateInput } = nominate;
  return (
    <div className="mb-10 grid grid-cols-1 lg:grid-cols-5 gap-4">
      <div className="lg:col-span-2 rounded-3xl border border-white/10 bg-zinc-900/60 p-5">
        <div className="font-medium mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" /> Nominate a site you think will be at the top
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (nominateInput.trim()) {
              onNominate(nominateInput);
              setNominateInput('');
            }
          }}
          className="flex gap-2"
        >
          <input
            value={nominateInput}
            onChange={(e) => setNominateInput(e.target.value)}
            placeholder="another-rising-star.com"
            className="flex-1 rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-sm placeholder:text-white/40 focus:border-white/30"
          />
          <button
            type="submit"
            className="rounded-2xl bg-white px-5 text-sm font-medium text-zinc-950"
          >
            Nominate
          </button>
        </form>
        <div className="mt-3 text-[11px] text-white/50">
          Your picks are saved locally. Use "Share" to contribute them publicly via GitHub.
        </div>
      </div>

      <div className="lg:col-span-3 rounded-3xl border border-white/10 bg-zinc-900/60 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="font-medium">My Top Predictions</div>
          {predictions.length > 0 && (
            <button
              onClick={() => sharePredictions(predictions)}
              className="text-xs rounded-full border border-white/10 px-3 py-1 hover:bg-white/5"
            >
              Share my predictions
            </button>
          )}
        </div>

        {predictions.length === 0 ? (
          <div className="text-sm text-white/50 py-2">
            No predictions yet. Nominate sites above or from the leaderboard. They will be scored
            against the latest available shared snapshot; this is not a future-outcome evaluation.
          </div>
        ) : (
          <div className="space-y-1 text-sm">
            {predictions.map((p) => {
              const actualRank = leaderboard.findIndex((d) => d.domain === p.domain) + 1 || null;
              const isHit = actualRank && actualRank <= 20;
              return (
                <div
                  key={p.domain}
                  className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img src={getFaviconUrl(p.domain)} className="h-4 w-4 rounded" />
                    <span className="font-mono truncate">{p.domain}</span>
                    {p.note ? (
                      <span className="text-white/40 text-xs truncate max-w-[140px]">
                        “{p.note}”
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    {actualRank ? (
                      <span className={isHit ? 'text-emerald-400' : 'text-white/60'}>
                        snapshot rank #{actualRank}
                      </span>
                    ) : (
                      <span className="text-white/40">unranked</span>
                    )}
                    <button
                      onClick={() => onRemovePrediction(p.domain)}
                      className="text-white/40 hover:text-red-400"
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
