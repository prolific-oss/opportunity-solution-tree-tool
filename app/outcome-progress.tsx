"use client";

import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  Plus,
  Save,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type CheckIn = {
  periodIndex: number;
  value: number;
  confidence: number;
  note: string;
  author: string;
};

type KeyResult = {
  id: string;
  title: string;
  unit: string;
  lowerIsBetter: boolean;
  baseline: number;
  target: number;
  checkIns: CheckIn[];
};

type Draft = {
  value: string;
  confidence: number;
  note: string;
};

type NewKeyResultDraft = {
  title: string;
  unit: string;
  baseline: string;
  target: string;
  lowerIsBetter: boolean;
  confidence: number;
};

const anchorDate = new Date(Date.UTC(2026, 3, 28));
const fortnightMs = 14 * 24 * 60 * 60 * 1000;

const initialKeyResults: KeyResult[] = [
  {
    id: "kr-existing-pool-reuse",
    title: "Studies that reuse an existing pool",
    unit: "%",
    lowerIsBetter: false,
    baseline: 24,
    target: 60,
    checkIns: [
      {
        periodIndex: 0,
        value: 24,
        confidence: 0.5,
        note: "Baseline set. Most AI teams still spin up fresh recruitment by default.",
        author: "AF",
      },
      {
        periodIndex: 1,
        value: 30,
        confidence: 0.6,
        note: "Pool-size hint in setup shipped to half of teams, with early lift.",
        author: "AF",
      },
      {
        periodIndex: 2,
        value: 35,
        confidence: 0.68,
        note: "Two teams reused pools after seeing eligible counts up front.",
        author: "AF",
      },
      {
        periodIndex: 3,
        value: 38,
        confidence: 0.72,
        note: "Reuse climbed after we surfaced pool size in setup. Discovery still nudges toward fresh recruitment.",
        author: "AF",
      },
    ],
  },
  {
    id: "kr-first-responses",
    title: "Setup to first responses, median",
    unit: "h",
    lowerIsBetter: true,
    baseline: 14,
    target: 4,
    checkIns: [
      {
        periodIndex: 0,
        value: 14,
        confidence: 0.5,
        note: "Baseline median is about 14h from setup to first responses.",
        author: "AF",
      },
      {
        periodIndex: 1,
        value: 12,
        confidence: 0.5,
        note: "Faster matching trimmed a couple of hours off the median.",
        author: "AF",
      },
      {
        periodIndex: 2,
        value: 10,
        confidence: 0.45,
        note: "Gains are stalling. Screener approval is the new bottleneck.",
        author: "AF",
      },
      {
        periodIndex: 3,
        value: 9,
        confidence: 0.45,
        note: "Median is holding near 9h. Bottleneck is screener approval, not recruitment.",
        author: "AF",
      },
    ],
  },
  {
    id: "kr-pool-engagement-viewed",
    title: "Researchers viewing pool engagement pre-launch",
    unit: "%",
    lowerIsBetter: false,
    baseline: 8,
    target: 70,
    checkIns: [
      {
        periodIndex: 0,
        value: 8,
        confidence: 0.2,
        note: "Baseline. Almost no one checks pool engagement before launch.",
        author: "AF",
      },
      {
        periodIndex: 1,
        value: 13,
        confidence: 0.25,
        note: "Insight panel is behind a flag for a small cohort.",
        author: "AF",
      },
      {
        periodIndex: 2,
        value: 18,
        confidence: 0.28,
        note: "Usage is creeping up among power researchers.",
        author: "AF",
      },
      {
        periodIndex: 3,
        value: 22,
        confidence: 0.3,
        note: "Activity insights are live for 22% of researchers. Early signal is good but gated behind the PG view.",
        author: "AF",
      },
    ],
  },
];

function bandFor(confidence: number) {
  if (confidence >= 0.7) {
    return { color: "#16A572", label: "On track" };
  }

  if (confidence >= 0.4) {
    return { color: "#E5A23B", label: "At risk" };
  }

  return { color: "#D8344A", label: "Off track" };
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function latestCheckIn(keyResult: KeyResult) {
  return keyResult.checkIns[keyResult.checkIns.length - 1];
}

function previousCheckIn(keyResult: KeyResult) {
  return keyResult.checkIns[keyResult.checkIns.length - 2] ?? null;
}

function formatDate(periodIndex: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(anchorDate.getTime() + periodIndex * fortnightMs));
}

function formatValue(value: number, unit: string) {
  const rounded = Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
  return `${rounded}${unit}`;
}

function progressPercent(keyResult: KeyResult) {
  const denominator = keyResult.target - keyResult.baseline || 1;
  return clamp01((latestCheckIn(keyResult).value - keyResult.baseline) / denominator) * 100;
}

function makeDraft(keyResult: KeyResult): Draft {
  const current = latestCheckIn(keyResult);
  return {
    value: String(current.value),
    confidence: current.confidence,
    note: "",
  };
}

function Sparkline({
  values,
  color,
}: {
  values: number[];
  color: string;
}) {
  const width = 86;
  const height = 30;
  const pad = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((value, index) => {
    const x = pad + (index / Math.max(values.length - 1, 1)) * (width - pad * 2);
    const y = height - pad - ((value - min) / span) * (height - pad * 2);
    return [x, y];
  });
  const path = points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const last = points[points.length - 1];

  return (
    <svg aria-hidden="true" className="progress-sparkline" viewBox={`0 0 ${width} ${height}`}>
      <path d={path} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <circle cx={last[0]} cy={last[1]} fill={color} r="2.7" />
    </svg>
  );
}

function MetricChart({ keyResult, color }: { keyResult: KeyResult; color: string }) {
  const width = 680;
  const height = 128;
  const pad = 14;
  const values = keyResult.checkIns.map((checkIn) => checkIn.value);
  const allValues = [...values, keyResult.target];
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const buffer = (maxValue - minValue) * 0.18 || 1;
  const min = minValue - buffer;
  const max = maxValue + buffer;
  const span = max - min || 1;
  const xFor = (index: number) =>
    pad + (index / Math.max(values.length - 1, 1)) * (width - pad * 2);
  const yFor = (value: number) => height - pad - ((value - min) / span) * (height - pad * 2);
  const points = values.map((value, index) => [xFor(index), yFor(value)]);
  const linePath = points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1][0].toFixed(1)} ${height - pad} L ${points[0][0].toFixed(1)} ${height - pad} Z`;
  const targetY = yFor(keyResult.target);
  const last = points[points.length - 1];
  const gradientId = `metric-chart-${keyResult.id}`;

  return (
    <div className="metric-chart">
      <svg aria-label={`${keyResult.title} metric history`} role="img" viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.17" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradientId})`} />
        <line className="metric-target-line" x1={pad} x2={width - pad} y1={targetY} y2={targetY} />
        <path d={linePath} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.6" />
        <circle cx={last[0]} cy={last[1]} fill="#fff" r="4" stroke={color} strokeWidth="2.4" />
      </svg>
      <div className="metric-chart-footer">
        <span>{formatValue(keyResult.target, keyResult.unit)} target</span>
        <div>
          {keyResult.checkIns.map((checkIn) => (
            <span key={checkIn.periodIndex}>{formatDate(checkIn.periodIndex)}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function OutcomeProgress({ outcomeTitle }: { outcomeTitle: string }) {
  const [open, setOpen] = useState(false);
  const [keyResults, setKeyResults] = useState<KeyResult[]>(initialKeyResults);
  const [expandedId, setExpandedId] = useState("");
  const [draft, setDraft] = useState<Draft>(() => makeDraft(initialKeyResults[0]));
  const [logError, setLogError] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [notice, setNotice] = useState("");
  const [newKeyResult, setNewKeyResult] = useState<NewKeyResultDraft>({
    title: "",
    unit: "%",
    baseline: "",
    target: "",
    lowerIsBetter: false,
    confidence: 0.4,
  });
  const ownerInitials = "AF";

  const aggregate = useMemo(() => {
    if (keyResults.length === 0) {
      return {
        confidence: 0,
        band: bandFor(0),
        latestPeriod: 0,
      };
    }

    const confidence =
      keyResults.reduce((total, keyResult) => total + latestCheckIn(keyResult).confidence, 0) /
      Math.max(keyResults.length, 1);
    return {
      confidence,
      band: bandFor(confidence),
      latestPeriod: Math.max(...keyResults.map((keyResult) => latestCheckIn(keyResult).periodIndex)),
    };
  }, [keyResults]);

  const expandedKeyResult =
    keyResults.find((keyResult) => keyResult.id === expandedId) ?? null;
  const draftBand = bandFor(draft.confidence);
  const addBand = bandFor(newKeyResult.confidence);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeout = window.setTimeout(() => setNotice(""), 3600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  function updateKeyResultTitle(id: string, title: string) {
    setKeyResults((current) =>
      current.map((keyResult) =>
        keyResult.id === id
          ? { ...keyResult, title: title.trimStart() }
          : keyResult,
      ),
    );
  }

  function updateKeyResultTarget(id: string, targetValue: string) {
    const target = Number.parseFloat(targetValue);

    if (!Number.isFinite(target)) {
      return;
    }

    setKeyResults((current) =>
      current.map((keyResult) =>
        keyResult.id === id ? { ...keyResult, target } : keyResult,
      ),
    );
  }

  function updateLatestCheckInValue(id: string, valueText: string) {
    const value = Number.parseFloat(valueText);

    if (!Number.isFinite(value)) {
      return;
    }

    setKeyResults((current) =>
      current.map((keyResult) => {
        if (keyResult.id !== id) {
          return keyResult;
        }

        return {
          ...keyResult,
          checkIns: keyResult.checkIns.map((checkIn, index) =>
            index === keyResult.checkIns.length - 1 ? { ...checkIn, value } : checkIn,
          ),
        };
      }),
    );

    if (expandedId === id) {
      setDraft((current) => ({ ...current, value: valueText }));
    }
  }

  function deleteKeyResult(id: string) {
    const nextKeyResults = keyResults.filter((keyResult) => keyResult.id !== id);
    setKeyResults(nextKeyResults);

    if (expandedId === id) {
      setExpandedId("");
      setLogError("");
    }
  }

  function updateCheckIn(
    keyResultId: string,
    periodIndex: number,
    patch: Partial<Pick<CheckIn, "confidence" | "note" | "value">>,
  ) {
    const editedKeyResult = keyResults.find((keyResult) => keyResult.id === keyResultId);

    setKeyResults((current) =>
      current.map((keyResult) => {
        if (keyResult.id !== keyResultId) {
          return keyResult;
        }

        return {
          ...keyResult,
          checkIns: keyResult.checkIns.map((checkIn) =>
            checkIn.periodIndex === periodIndex
              ? {
                  ...checkIn,
                  ...patch,
                  confidence:
                    patch.confidence == null
                      ? checkIn.confidence
                      : clamp01(patch.confidence),
                }
              : checkIn,
          ),
        };
      }),
    );

    if (
      expandedId === keyResultId &&
      editedKeyResult &&
      latestCheckIn(editedKeyResult).periodIndex === periodIndex
    ) {
      setDraft((current) => ({
        ...current,
        value: patch.value == null ? current.value : String(patch.value),
        confidence: patch.confidence == null ? current.confidence : clamp01(patch.confidence),
      }));
    }
  }

  function deleteCheckIn(keyResultId: string, periodIndex: number) {
    const nextKeyResults = keyResults.flatMap((keyResult) => {
      if (keyResult.id !== keyResultId) {
        return [keyResult];
      }

      const checkIns = keyResult.checkIns.filter(
        (checkIn) => checkIn.periodIndex !== periodIndex,
      );

      return checkIns.length > 0 ? [{ ...keyResult, checkIns }] : [];
    });
    const nextExpanded = nextKeyResults.find((keyResult) => keyResult.id === expandedId);

    setKeyResults(nextKeyResults);

    if (!nextExpanded) {
      setExpandedId("");
      setLogError("");
      return;
    }

    setDraft(makeDraft(nextExpanded));
  }

  function toggleRow(keyResult: KeyResult) {
    if (expandedId === keyResult.id) {
      setExpandedId("");
      setLogError("");
      return;
    }

    setExpandedId(keyResult.id);
    setDraft(makeDraft(keyResult));
    setLogError("");
  }

  function saveCheckIn() {
    if (!expandedKeyResult) {
      return;
    }

    const value = Number.parseFloat(draft.value);
    const confidence = Number.parseFloat(String(draft.confidence));

    if (!Number.isFinite(value) || !Number.isFinite(confidence)) {
      setLogError("Enter a numeric value and confidence.");
      return;
    }

    const boundedConfidence = clamp01(confidence);
    const note = draft.note.trim() || "No note added.";

    setKeyResults((current) =>
      current.map((keyResult) => {
        if (keyResult.id !== expandedKeyResult.id) {
          return keyResult;
        }

        const last = latestCheckIn(keyResult);
        return {
          ...keyResult,
          checkIns: [
            ...keyResult.checkIns,
            {
              periodIndex: last.periodIndex + 1,
              value,
              confidence: boundedConfidence,
              note,
              author: ownerInitials,
            },
          ],
        };
      }),
    );
    setDraft({ value: String(value), confidence: boundedConfidence, note: "" });
    setLogError("");
  }

  function saveNewKeyResult() {
    const baseline = Number.parseFloat(newKeyResult.baseline);
    const target = Number.parseFloat(newKeyResult.target);

    if (!newKeyResult.title.trim() || !Number.isFinite(baseline) || !Number.isFinite(target)) {
      setAddError("Add a description, baseline, and target.");
      return;
    }

    const id = `kr-${Date.now()}`;
    const currentPeriod = Math.max(
      ...keyResults.map((keyResult) => latestCheckIn(keyResult).periodIndex),
    );
    const keyResult: KeyResult = {
      id,
      title: newKeyResult.title.trim(),
      unit: newKeyResult.unit.trim(),
      lowerIsBetter: newKeyResult.lowerIsBetter,
      baseline,
      target,
      checkIns: [
        {
          periodIndex: currentPeriod,
          value: baseline,
          confidence: clamp01(newKeyResult.confidence),
          note: "Baseline set.",
          author: ownerInitials,
        },
      ],
    };

    setKeyResults((current) => [...current, keyResult]);
    setExpandedId(id);
    setDraft(makeDraft(keyResult));
    setAdding(false);
    setAddError("");
    setNotice(`Key result added: ${keyResult.title}`);
    setNewKeyResult({
      title: "",
      unit: "%",
      baseline: "",
      target: "",
      lowerIsBetter: false,
      confidence: 0.4,
    });
  }

  return (
    <div className="outcome-progress-shell">
      <section className="outcome-bar outcome-bar-with-progress">
        <div className="outcome-label">
          <Target aria-hidden="true" size={15} />
          <span>Outcome</span>
        </div>
        <div className="outcome-title">{outcomeTitle}</div>
        <button
          aria-expanded={open}
          className="progress-summary-pill"
          onClick={() => setOpen((current) => !current)}
          type="button"
        >
          <span className="progress-status-dot" style={{ background: aggregate.band.color }} />
          <span>Progress</span>
          <strong style={{ color: aggregate.band.color }}>
            {aggregate.confidence.toFixed(2)} {aggregate.band.label}
          </strong>
          <ChevronDown
            aria-hidden="true"
            className={`progress-summary-chevron ${open ? "open" : ""}`}
            size={15}
          />
        </button>
      </section>

      {open ? (
        <section className="outcome-progress-drawer">
          <div className="progress-drawer-header">
            <div>
              <div className="eyebrow">Outcome progress</div>
              <h2>Weekly outcome progress</h2>
              <p>
                Updated fortnightly · last {formatDate(aggregate.latestPeriod)} by {ownerInitials} · next{" "}
                {formatDate(aggregate.latestPeriod + 1)}
              </p>
            </div>
            <button
              className="primary-button"
              onClick={() => {
                setAdding(true);
                setAddError("");
                setNotice("");
              }}
              type="button"
            >
              <Plus aria-hidden="true" size={14} />
              Add key result
            </button>
          </div>

          {notice ? (
            <div className="confirmation-toast inline" role="status">
              <Check aria-hidden="true" size={14} />
              <span>{notice}</span>
            </div>
          ) : null}

          <div className="key-result-table">
            <div className="key-result-head">
              <span>Key result</span>
              <span>Current</span>
              <span>Target</span>
              <span>Progress</span>
              <span>Confidence</span>
              <span>Latest check-in</span>
            </div>

            {keyResults.length === 0 ? (
              <div className="empty-key-results">No key results yet.</div>
            ) : null}

            {keyResults.map((keyResult, index) => {
              const current = latestCheckIn(keyResult);
              const previous = previousCheckIn(keyResult);
              const band = bandFor(current.confidence);
              const progress = Math.round(progressPercent(keyResult));
              const trend = previous ? current.confidence - previous.confidence : 0;
              const TrendIcon =
                trend > 0.005 ? ArrowUp : trend < -0.005 ? ArrowDown : ArrowRight;
              const trendClass =
                trend > 0.005 ? "up" : trend < -0.005 ? "down" : "flat";
              const expanded = expandedId === keyResult.id;

              return (
                <div className={`key-result-block ${expanded ? "expanded" : ""}`} key={keyResult.id}>
                  <div className="key-result-row">
                    <span className="kr-title-cell">
                      <span className="solution-rank">{index + 1}</span>
                      <span>
                        <textarea
                          aria-label={`Key result ${index + 1} title`}
                          className="kr-title-input"
                          onChange={(event) =>
                            updateKeyResultTitle(keyResult.id, event.target.value)
                          }
                          rows={2}
                          value={keyResult.title}
                        />
                      </span>
                      <button
                        aria-label={expanded ? "Collapse key result" : "Expand key result"}
                        aria-expanded={expanded}
                        className="kr-expand-button"
                        onClick={() => toggleRow(keyResult)}
                        type="button"
                      >
                        <ChevronDown
                          aria-hidden="true"
                          className={`kr-row-chevron ${expanded ? "open" : ""}`}
                          size={15}
                        />
                        <span>{expanded ? "Collapse" : "Expand"}</span>
                      </button>
                      <button
                        aria-label={`Delete ${keyResult.title}`}
                        className="kr-icon-button danger"
                        onClick={() => deleteKeyResult(keyResult.id)}
                        type="button"
                      >
                        <Trash2 aria-hidden="true" size={14} />
                      </button>
                    </span>
                    <span className="kr-current">
                      <input
                        aria-label={`${keyResult.title} current value`}
                        className="kr-number-input"
                        onChange={(event) =>
                          updateLatestCheckInValue(keyResult.id, event.target.value)
                        }
                        type="number"
                        value={current.value}
                      />
                      <small>{keyResult.unit}</small>
                    </span>
                    <span className="kr-target">
                      <input
                        aria-label={`${keyResult.title} target`}
                        className="kr-number-input"
                        onChange={(event) =>
                          updateKeyResultTarget(keyResult.id, event.target.value)
                        }
                        type="number"
                        value={keyResult.target}
                      />
                      <small>{keyResult.unit}</small>
                    </span>
                    <span className="kr-progress-cell">
                      <span className="kr-progress-track">
                        <span
                          className="kr-progress-fill"
                          style={{ background: band.color, width: `${progress}%` }}
                        />
                      </span>
                      <span>{progress}% to target</span>
                    </span>
                    <span className="kr-confidence-cell">
                      <strong style={{ color: band.color }}>{current.confidence.toFixed(2)}</strong>
                      <span className={`kr-trend ${trendClass}`}>
                        <TrendIcon aria-hidden="true" size={13} />
                      </span>
                      <Sparkline
                        color={band.color}
                        values={keyResult.checkIns.map((checkIn) => checkIn.confidence)}
                      />
                    </span>
                    <span className="kr-note-cell">
                      <span>{current.note}</span>
                      <small>
                        {formatDate(current.periodIndex)} · {current.author}
                      </small>
                    </span>
                  </div>

                  {expanded ? (
                    <div className="key-result-detail">
                      <div className="metric-panel">
                        <div className="metric-panel-header">
                          <div>
                            <span className="eyebrow">Metric vs target</span>
                            <h3>{keyResult.title}</h3>
                          </div>
                          <span className="metric-target-pill">
                            Target {formatValue(keyResult.target, keyResult.unit)}
                          </span>
                        </div>
                        <MetricChart color={band.color} keyResult={keyResult} />

                        <div className="checkin-form">
                          <div className="checkin-form-header">
                            <div>
                              <strong>Log fortnightly check-in</strong>
                              <span>{formatDate(current.periodIndex + 1)}</span>
                            </div>
                            <span style={{ color: draftBand.color }}>
                              {draft.confidence.toFixed(2)} · {draftBand.label}
                            </span>
                          </div>
                          <div className="checkin-fields">
                            <label>
                              Current value
                              <span>
                                <input
                                  onChange={(event) =>
                                    setDraft((currentDraft) => ({
                                      ...currentDraft,
                                      value: event.target.value,
                                    }))
                                  }
                                  type="number"
                                  value={draft.value}
                                />
                                <small>{keyResult.unit}</small>
                              </span>
                            </label>
                            <label>
                              Confidence
                              <input
                                max="1"
                                min="0"
                                onChange={(event) =>
                                  setDraft((currentDraft) => ({
                                    ...currentDraft,
                                    confidence: Number.parseFloat(event.target.value),
                                  }))
                                }
                                step="0.05"
                                style={{ accentColor: draftBand.color }}
                                type="range"
                                value={draft.confidence}
                              />
                            </label>
                          </div>
                          <textarea
                            onChange={(event) =>
                              setDraft((currentDraft) => ({
                                ...currentDraft,
                                note: event.target.value,
                              }))
                            }
                            placeholder="What changed this fortnight, and why this score?"
                            value={draft.note}
                          />
                          <div className="checkin-actions">
                            {logError ? <span className="form-error">{logError}</span> : null}
                            <button className="primary-button" onClick={saveCheckIn} type="button">
                              <Save aria-hidden="true" size={14} />
                              Save check-in
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="history-panel">
                        <div className="history-panel-header">Check-in history</div>
                        {keyResult.checkIns
                          .slice()
                          .reverse()
                          .map((checkIn) => {
                            const checkInBand = bandFor(checkIn.confidence);

                            return (
                              <div className="history-item" key={checkIn.periodIndex}>
                                <div>
                                  <strong>{formatDate(checkIn.periodIndex)}</strong>
                                </div>
                                <label>
                                  Value
                                  <span>
                                    <input
                                      aria-label={`${formatDate(checkIn.periodIndex)} value`}
                                      onChange={(event) => {
                                        const value = Number.parseFloat(event.target.value);
                                        if (Number.isFinite(value)) {
                                          updateCheckIn(keyResult.id, checkIn.periodIndex, {
                                            value,
                                          });
                                        }
                                      }}
                                      type="number"
                                      value={checkIn.value}
                                    />
                                    <small>{keyResult.unit}</small>
                                  </span>
                                </label>
                                <div className="history-score" style={{ color: checkInBand.color }}>
                                  <span style={{ background: checkInBand.color }} />
                                  <input
                                    aria-label={`${formatDate(checkIn.periodIndex)} confidence`}
                                    max="1"
                                    min="0"
                                    onChange={(event) => {
                                      const confidence = Number.parseFloat(event.target.value);
                                      if (Number.isFinite(confidence)) {
                                        updateCheckIn(keyResult.id, checkIn.periodIndex, {
                                          confidence,
                                        });
                                      }
                                    }}
                                    step="0.05"
                                    type="number"
                                    value={checkIn.confidence}
                                  />
                                </div>
                                <textarea
                                  aria-label={`${formatDate(checkIn.periodIndex)} note`}
                                  onChange={(event) =>
                                    updateCheckIn(keyResult.id, checkIn.periodIndex, {
                                      note: event.target.value,
                                    })
                                  }
                                  value={checkIn.note}
                                />
                                <button
                                  aria-label={`Delete ${formatDate(checkIn.periodIndex)} check-in`}
                                  className="kr-icon-button danger"
                                  onClick={() => deleteCheckIn(keyResult.id, checkIn.periodIndex)}
                                  type="button"
                                >
                                  <Trash2 aria-hidden="true" size={14} />
                                </button>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {adding ? (
            <div className="add-key-result-form">
              <div className="add-key-result-title">
                <strong>New key result</strong>
                <button
                  aria-label="Cancel new key result"
                  className="detail-close"
                  onClick={() => {
                    setAdding(false);
                    setAddError("");
                  }}
                  type="button"
                >
                  <X aria-hidden="true" size={15} />
                </button>
              </div>
              <div className="add-kr-grid">
                <label>
                  Description
                  <input
                    onChange={(event) =>
                      setNewKeyResult((current) => ({ ...current, title: event.target.value }))
                    }
                    placeholder="Repeat studies per active researcher"
                    value={newKeyResult.title}
                  />
                </label>
                <label>
                  Unit
                  <input
                    onChange={(event) =>
                      setNewKeyResult((current) => ({ ...current, unit: event.target.value }))
                    }
                    placeholder="%"
                    value={newKeyResult.unit}
                  />
                </label>
                <label>
                  Baseline
                  <input
                    onChange={(event) =>
                      setNewKeyResult((current) => ({ ...current, baseline: event.target.value }))
                    }
                    type="number"
                    value={newKeyResult.baseline}
                  />
                </label>
                <label>
                  Target
                  <input
                    onChange={(event) =>
                      setNewKeyResult((current) => ({ ...current, target: event.target.value }))
                    }
                    type="number"
                    value={newKeyResult.target}
                  />
                </label>
              </div>
              <div className="add-kr-lower-row">
                <label className="add-kr-confidence">
                  Starting confidence
                  <span style={{ color: addBand.color }}>
                    {newKeyResult.confidence.toFixed(2)} · {addBand.label}
                  </span>
                  <input
                    max="1"
                    min="0"
                    onChange={(event) =>
                      setNewKeyResult((current) => ({
                        ...current,
                        confidence: Number.parseFloat(event.target.value),
                      }))
                    }
                    step="0.05"
                    style={{ accentColor: addBand.color }}
                    type="range"
                    value={newKeyResult.confidence}
                  />
                </label>
                <div className="add-kr-actions">
                  {addError ? <span className="form-error">{addError}</span> : null}
                  <button className="secondary-button" onClick={() => setAdding(false)} type="button">
                    <X aria-hidden="true" size={14} />
                    Cancel
                  </button>
                  <button className="primary-button" onClick={saveNewKeyResult} type="button">
                    <Check aria-hidden="true" size={14} />
                    Add key result
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
