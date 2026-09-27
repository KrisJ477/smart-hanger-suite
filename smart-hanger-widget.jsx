import { useState, useMemo } from "react";
import { ChevronRight, ChevronLeft, Scissors, ArrowDown, Circle, MoveRight, Play, RotateCcw } from "lucide-react";

// ============================================================
// SAMPLE DATA — one smart-hanger, 5 clamps
// In production this comes from CSV (one row per hanger)
// ============================================================
const SAMPLE_HANGER = {
  id: "SH-0427",
  baseBarLength: 1450, // mm
  edgeOffset: 80,      // mm — distance from bar edge to first rod
  clamps: [
    { position: 80,   rodLength: 155, clampDiameter: 75 },
    { position: 340,  rodLength: 200, clampDiameter: 110 },
    { position: 620,  rodLength: 155, clampDiameter: 50 },
    { position: 940,  rodLength: 240, clampDiameter: 160 },
    { position: 1280, rodLength: 180, clampDiameter: 32 },
  ],
};

// ============================================================
// TASK GENERATION — turn hanger spec into linear task list
// Each task = one atomic operator action
// ============================================================
function generateTasks(hanger) {
  const sorted = [...hanger.clamps].sort((a, b) => a.position - b.position);
  const tasks = [];

  // Initial bar placement
  tasks.push({
    type: "FEED_BAR",
    label: "FEED BAR",
    value: sorted[0].position,
    unit: "mm",
    detail: "Position bar so first rod location aligns with cutter",
    clampIndex: -1,
    stage: "setup",
  });

  let lastPosition = sorted[0].position;

  sorted.forEach((clamp, i) => {
    if (i > 0) {
      const delta = clamp.position - lastPosition;
      tasks.push({
        type: "FEED_BAR",
        label: "FEED BAR",
        value: delta,
        unit: "mm",
        detail: `Advance to clamp ${i + 1} of ${sorted.length}`,
        clampIndex: i,
        stage: "feed",
      });
    }

    tasks.push({
      type: "INSERT_ROD",
      label: "INSERT ROD",
      value: clamp.rodLength,
      unit: "mm",
      detail: `Cut threaded rod and screw into base nut`,
      clampIndex: i,
      stage: "rod",
    });

    tasks.push({
      type: "ATTACH_CLAMP",
      label: "ATTACH CLAMP",
      value: clamp.clampDiameter,
      unit: "mm Ø",
      detail: `Screw clamp onto top of rod`,
      clampIndex: i,
      stage: "clamp",
    });

    lastPosition = clamp.position;
  });

  // Final cut
  const remaining = hanger.baseBarLength - lastPosition;
  tasks.push({
    type: "CUT_BAR",
    label: "CUT BAR",
    value: remaining,
    unit: "mm from last rod",
    detail: "Cut base bar to final length",
    clampIndex: sorted.length - 1,
    stage: "cut",
  });

  return tasks;
}

// ============================================================
// PICTOGRAMS — one icon per task type
// ============================================================
function Pictogram({ type, size = 140 }) {
  const stroke = "#00E5D1";
  const sw = 4;
  const s = size;

  if (type === "FEED_BAR") {
    return (
      <svg width={s} height={s} viewBox="0 0 100 100" fill="none">
        <rect x="10" y="55" width="55" height="14" fill={stroke} opacity="0.25" />
        <rect x="10" y="55" width="55" height="14" stroke={stroke} strokeWidth={sw} />
        <path d="M70 62 L90 62 M82 54 L90 62 L82 70" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (type === "INSERT_ROD") {
    return (
      <svg width={s} height={s} viewBox="0 0 100 100" fill="none">
        <path d="M50 10 L50 55 M42 18 L50 10 L58 18" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        <rect x="46" y="55" width="8" height="20" fill={stroke} />
        <rect x="15" y="75" width="70" height="14" stroke={stroke} strokeWidth={sw} fill="none" />
      </svg>
    );
  }
  if (type === "ATTACH_CLAMP") {
    return (
      <svg width={s} height={s} viewBox="0 0 100 100" fill="none">
        <circle cx="50" cy="38" r="22" stroke={stroke} strokeWidth={sw} fill="none" />
        <circle cx="50" cy="38" r="10" stroke={stroke} strokeWidth={sw} fill="none" opacity="0.5" />
        <rect x="46" y="60" width="8" height="22" fill={stroke} />
        <rect x="46" y="60" width="8" height="22" stroke={stroke} strokeWidth={sw / 2} />
      </svg>
    );
  }
  if (type === "CUT_BAR") {
    return (
      <svg width={s} height={s} viewBox="0 0 100 100" fill="none">
        <rect x="10" y="55" width="80" height="14" stroke={stroke} strokeWidth={sw} fill={stroke} fillOpacity="0.2" />
        <line x1="50" y1="40" x2="50" y2="84" stroke={stroke} strokeWidth={sw} strokeDasharray="3 3" />
        <path d="M40 28 L50 40 L60 28" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    );
  }
  return null;
}

// ============================================================
// HANGER DIAGRAM — to-scale side view
// ============================================================
function HangerDiagram({ hanger, mode = "preview", currentClampIndex = -1, currentStage = null, width = 600 }) {
  const sorted = useMemo(
    () => [...hanger.clamps].sort((a, b) => a.position - b.position),
    [hanger]
  );

  // Vertical envelope: tallest rod + its clamp
  const maxHeight = Math.max(...sorted.map((c) => c.rodLength + c.clampDiameter));
  const padding = 60;
  const barThickness = 30;

  // Scale: fit hanger length into available width
  const scale = (width - padding * 2) / hanger.baseBarLength;
  const svgHeight = maxHeight * scale + barThickness * scale + padding * 2 + 40;
  const barY = svgHeight - padding - barThickness * scale;

  const HIGHLIGHT = "#00E5D1";
  const DIM = "#3a4046";
  const LABEL = "#8a9099";

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${svgHeight}`} style={{ display: "block" }}>
      {/* Base bar */}
      <rect
        x={padding}
        y={barY}
        width={hanger.baseBarLength * scale}
        height={barThickness * scale}
        fill={mode === "preview" ? "#4a5058" : "#2a2e33"}
        stroke={mode === "preview" ? "#6a7078" : "#3a4046"}
        strokeWidth="1"
      />

      {/* Rods + clamps */}
      {sorted.map((clamp, i) => {
        const x = padding + clamp.position * scale;
        const rodTopY = barY - clamp.rodLength * scale;
        const clampRadius = (clamp.clampDiameter / 2) * scale;
        const clampCenterY = rodTopY - clampRadius;

        const isActive = i === currentClampIndex;
        const rodActive = isActive && currentStage === "rod";
        const clampActive = isActive && currentStage === "clamp";
        const baseActive = isActive && (currentStage === "feed" || currentStage === "setup");

        const rodColor = mode === "preview" ? "#9aa0a8" : isActive ? HIGHLIGHT : DIM;
        const clampColor = mode === "preview" ? "#9aa0a8" : isActive ? HIGHLIGHT : DIM;

        return (
          <g key={i}>
            {/* Rod */}
            <rect
              x={x - 5 * scale}
              y={rodTopY}
              width={10 * scale}
              height={clamp.rodLength * scale}
              fill={rodColor}
              opacity={rodActive ? 1 : isActive ? 0.7 : mode === "preview" ? 1 : 0.5}
            />
            {/* Base nut indicator */}
            <rect
              x={x - 8 * scale}
              y={barY - 6 * scale}
              width={16 * scale}
              height={6 * scale}
              fill={baseActive ? HIGHLIGHT : rodColor}
              opacity={baseActive ? 1 : isActive ? 0.7 : 0.6}
            />
            {/* Clamp */}
            <circle
              cx={x}
              cy={clampCenterY}
              r={clampRadius}
              fill="none"
              stroke={clampColor}
              strokeWidth={Math.max(1.5, 3 * scale)}
              opacity={clampActive ? 1 : isActive ? 0.7 : mode === "preview" ? 1 : 0.5}
            />

            {/* Preview labels */}
            {mode === "preview" && (
              <>
                <text
                  x={x}
                  y={clampCenterY - clampRadius - 8}
                  textAnchor="middle"
                  fill={LABEL}
                  fontSize="11"
                  fontFamily="ui-monospace, monospace"
                >
                  Ø{clamp.clampDiameter}
                </text>
                <text
                  x={x + 8 * scale + 4}
                  y={rodTopY + (clamp.rodLength * scale) / 2}
                  fill={LABEL}
                  fontSize="11"
                  fontFamily="ui-monospace, monospace"
                  dominantBaseline="middle"
                >
                  {clamp.rodLength}
                </text>
                <text
                  x={x}
                  y={barY + barThickness * scale + 14}
                  textAnchor="middle"
                  fill={LABEL}
                  fontSize="10"
                  fontFamily="ui-monospace, monospace"
                >
                  {clamp.position}
                </text>
              </>
            )}
          </g>
        );
      })}

      {/* Bar length label (preview only) */}
      {mode === "preview" && (
        <>
          <line
            x1={padding}
            y1={svgHeight - 20}
            x2={padding + hanger.baseBarLength * scale}
            y2={svgHeight - 20}
            stroke={LABEL}
            strokeWidth="1"
          />
          <text
            x={padding + (hanger.baseBarLength * scale) / 2}
            y={svgHeight - 6}
            textAnchor="middle"
            fill={LABEL}
            fontSize="11"
            fontFamily="ui-monospace, monospace"
          >
            {hanger.baseBarLength} mm
          </text>
        </>
      )}
    </svg>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function SmartHangerWidget() {
  const [mode, setMode] = useState("preview"); // "preview" | "production" | "done"
  const [taskIndex, setTaskIndex] = useState(0);

  const tasks = useMemo(() => generateTasks(SAMPLE_HANGER), []);
  const currentTask = tasks[taskIndex];
  const progress = ((taskIndex + 1) / tasks.length) * 100;

  const next = () => {
    if (taskIndex < tasks.length - 1) {
      setTaskIndex(taskIndex + 1);
    } else {
      setMode("done");
    }
  };
  const back = () => taskIndex > 0 && setTaskIndex(taskIndex - 1);
  const reset = () => {
    setTaskIndex(0);
    setMode("preview");
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#16191c",
      color: "#e8eaed",
      fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
      padding: "16px",
      boxSizing: "border-box",
    }}>
      {/* HEADER */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom: "1px solid #2a2e33",
        paddingBottom: "10px",
        marginBottom: "16px",
      }}>
        <div>
          <div style={{ fontSize: "10px", color: "#6a7078", letterSpacing: "0.15em" }}>HANGER ID</div>
          <div style={{ fontSize: "16px", fontWeight: 600 }}>{SAMPLE_HANGER.id}</div>
        </div>
        <div style={{
          fontSize: "10px",
          color: mode === "production" ? "#00E5D1" : "#6a7078",
          letterSpacing: "0.15em",
          padding: "4px 8px",
          border: `1px solid ${mode === "production" ? "#00E5D1" : "#3a4046"}`,
        }}>
          {mode.toUpperCase()}
        </div>
      </div>

      {/* PREVIEW MODE */}
      {mode === "preview" && (
        <div>
          <div style={{ marginBottom: "20px" }}>
            <div style={{ fontSize: "10px", color: "#6a7078", letterSpacing: "0.15em", marginBottom: "4px" }}>
              VERIFY AGAINST DRAWING
            </div>
            <div style={{ fontSize: "14px", color: "#aab0b8" }}>
              5 clamps · {SAMPLE_HANGER.baseBarLength}mm bar · {tasks.length} tasks
            </div>
          </div>

          <div style={{
            background: "#1c1f23",
            border: "1px solid #2a2e33",
            padding: "16px 8px",
            marginBottom: "20px",
          }}>
            <HangerDiagram hanger={SAMPLE_HANGER} mode="preview" width={600} />
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px",
            fontSize: "11px",
            color: "#8a9099",
            marginBottom: "24px",
          }}>
            <div>BAR LENGTH</div><div style={{ textAlign: "right", color: "#e8eaed" }}>{SAMPLE_HANGER.baseBarLength} mm</div>
            <div>CLAMP COUNT</div><div style={{ textAlign: "right", color: "#e8eaed" }}>{SAMPLE_HANGER.clamps.length}</div>
            <div>ROD LENGTHS</div><div style={{ textAlign: "right", color: "#e8eaed" }}>
              {[...SAMPLE_HANGER.clamps].sort((a, b) => a.position - b.position).map(c => c.rodLength).join(" · ")}
            </div>
            <div>CLAMP Ø</div><div style={{ textAlign: "right", color: "#e8eaed" }}>
              {[...SAMPLE_HANGER.clamps].sort((a, b) => a.position - b.position).map(c => c.clampDiameter).join(" · ")}
            </div>
          </div>

          <button
            onClick={() => setMode("production")}
            style={{
              width: "100%",
              padding: "20px",
              background: "#00E5D1",
              color: "#16191c",
              border: "none",
              fontSize: "16px",
              fontWeight: 700,
              letterSpacing: "0.15em",
              fontFamily: "inherit",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
            }}
          >
            <Play size={18} /> START ASSEMBLY
          </button>
        </div>
      )}

      {/* PRODUCTION MODE */}
      {mode === "production" && currentTask && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Progress bar */}
          <div>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "10px",
              color: "#6a7078",
              letterSpacing: "0.15em",
              marginBottom: "6px",
            }}>
              <span>TASK {taskIndex + 1} / {tasks.length}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div style={{ height: "3px", background: "#2a2e33" }}>
              <div style={{
                height: "100%",
                width: `${progress}%`,
                background: "#00E5D1",
                transition: "width 0.2s",
              }} />
            </div>
          </div>

          {/* Minimap */}
          <div style={{
            background: "#1c1f23",
            border: "1px solid #2a2e33",
            padding: "8px",
          }}>
            <HangerDiagram
              hanger={SAMPLE_HANGER}
              mode="production"
              currentClampIndex={currentTask.clampIndex}
              currentStage={currentTask.stage}
              width={600}
            />
          </div>

          {/* Big task display */}
          <div style={{
            background: "#1c1f23",
            border: "2px solid #00E5D1",
            padding: "32px 20px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
          }}>
            <Pictogram type={currentTask.type} size={120} />

            <div style={{
              fontSize: "12px",
              color: "#00E5D1",
              letterSpacing: "0.25em",
              fontWeight: 600,
            }}>
              {currentTask.label}
            </div>

            <div style={{
              fontSize: "72px",
              fontWeight: 800,
              lineHeight: 1,
              color: "#e8eaed",
              fontVariantNumeric: "tabular-nums",
            }}>
              {currentTask.value}
            </div>

            <div style={{
              fontSize: "14px",
              color: "#8a9099",
              letterSpacing: "0.1em",
            }}>
              {currentTask.unit}
            </div>

            <div style={{
              fontSize: "11px",
              color: "#6a7078",
              marginTop: "8px",
              maxWidth: "260px",
            }}>
              {currentTask.detail}
            </div>
          </div>

          {/* Controls — big NEXT, small back */}
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={back}
              disabled={taskIndex === 0}
              style={{
                padding: "20px",
                background: "transparent",
                color: taskIndex === 0 ? "#3a4046" : "#8a9099",
                border: "1px solid #3a4046",
                fontFamily: "inherit",
                cursor: taskIndex === 0 ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ChevronLeft size={24} />
            </button>
            <button
              onClick={next}
              style={{
                flex: 1,
                padding: "20px",
                background: "#00E5D1",
                color: "#16191c",
                border: "none",
                fontSize: "18px",
                fontWeight: 700,
                letterSpacing: "0.2em",
                fontFamily: "inherit",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
              }}
            >
              NEXT <ChevronRight size={22} />
            </button>
          </div>
        </div>
      )}

      {/* DONE */}
      {mode === "done" && (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "20px",
          padding: "40px 20px",
          textAlign: "center",
        }}>
          <div style={{
            fontSize: "12px",
            color: "#00E5D1",
            letterSpacing: "0.3em",
          }}>
            ASSEMBLY COMPLETE
          </div>
          <div style={{
            fontSize: "48px",
            fontWeight: 800,
            color: "#e8eaed",
          }}>
            {SAMPLE_HANGER.id}
          </div>
          <div style={{
            background: "#1c1f23",
            border: "1px solid #2a2e33",
            padding: "12px",
            width: "100%",
          }}>
            <HangerDiagram hanger={SAMPLE_HANGER} mode="preview" width={600} />
          </div>
          <button
            onClick={reset}
            style={{
              padding: "16px 32px",
              background: "transparent",
              color: "#00E5D1",
              border: "1px solid #00E5D1",
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.2em",
              fontFamily: "inherit",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <RotateCcw size={16} /> RUN AGAIN
          </button>
        </div>
      )}
    </div>
  );
}
