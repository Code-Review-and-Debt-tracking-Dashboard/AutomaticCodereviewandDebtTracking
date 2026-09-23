import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../../contexts/AuthContext";
import { Logo } from "../../components/brand/Logo";
import { AlertIcon, CheckIcon } from "../../components/icons";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

const SIGN_OUT_MESSAGES: Record<string, string> = {
  session_expired: "Your session has expired. Please log in again.",
  logged_out: "You have been logged out.",
};

const FEATURES = [
  "First-pass review on every pull request",
  "Debt measured in minutes, not guesses",
  "Quality gates that flag risky merges",
];

// each beat is a pull request, taller for worse findings
const BEATS = [
  { at: 0.25, height: 28, pr: "PR #41", finding: "code smell" },
  { at: 0.52, height: 52, pr: "PR #42", finding: "vulnerability" },
  { at: 0.8, height: 40, pr: "PR #43", finding: "complexity" },
];

// sweep trail layers, longest and faintest first
const TRAILS = [
  { length: 160, width: 3, opacity: 0.15 },
  { length: 70, width: 2.5, opacity: 0.4 },
  { length: 18, width: 3, opacity: 1 },
];

interface Trace {
  width: number;
  height: number;
  d: string;
  labels: { x: number; y: number; pr: string; finding: string }[];
  end: [number, number];
}

function beat(x: number, height: number, y: number) {
  return [
    [x - 24, y],
    [x - 14, y - height * 0.15],
    [x - 6, y],
    [x - 2, y + height * 0.2],
    [x + 4, y - height],
    [x + 10, y + height * 0.35],
    [x + 16, y],
  ]
    .map(([px, py]) => `L ${px} ${py}`)
    .join(" ");
}

// frame drawn clockwise just outside the card, back to where the line came in
function frame(card: DOMRect, left: number, y: number) {
  const gap = card.left - left;
  const top = card.top - gap;
  const right = card.right + gap;
  const bottom = card.bottom + gap;

  return `L ${left} ${top} L ${right} ${top} L ${right} ${bottom} L ${left} ${bottom} L ${left} ${y}`;
}

function buildTrace(stage: HTMLElement, row: HTMLElement, card: HTMLElement): Trace {
  const origin = stage.getBoundingClientRect();
  const shift = (r: DOMRect) => new DOMRect(r.x - origin.x, r.y - origin.y, r.width, r.height);

  const rowBox = shift(row.getBoundingClientRect());
  const cardBox = shift(card.getBoundingClientRect());
  const y = rowBox.top + rowBox.height / 2;
  const wide = window.matchMedia("(min-width: 1024px)").matches;

  // on wide screens the line meets the card and runs a loop around it
  const frameLeft = cardBox.left - 16;
  const lineEnd = wide ? frameLeft : rowBox.right;
  const beatSpan = wide ? frameLeft - 40 : rowBox.right;

  const beats = BEATS.map((b) => ({ ...b, x: b.at * beatSpan }));

  let d = `M 0 ${y} ${beats.map((b) => beat(b.x, b.height, y)).join(" ")} L ${lineEnd} ${y}`;
  if (wide) d += ` ${frame(cardBox, frameLeft, y)}`;

  return {
    width: origin.width,
    height: origin.height,
    d,
    labels: origin.width >= 600 ? beats.map((b) => ({ x: b.x, y: y + 32, pr: b.pr, finding: b.finding })) : [],
    end: [lineEnd, y],
  };
}

function GithubMark({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.37.5 0 5.78 0 12.292c0 5.211 3.438 9.63 8.205 11.188.6.111.82-.254.82-.567 0-.28-.01-1.022-.015-2.005-3.338.711-4.042-1.582-4.042-1.582-.546-1.361-1.335-1.725-1.335-1.725-1.087-.731.084-.716.084-.716 1.205.082 1.838 1.215 1.838 1.215 1.07 1.803 2.809 1.282 3.495.981.108-.763.417-1.283.76-1.578-2.665-.295-5.466-1.309-5.466-5.827 0-1.287.465-2.339 1.235-3.164-.135-.298-.54-1.497.105-3.121 0 0 1.005-.316 3.3 1.209a11.5 11.5 0 0 1 3-.398c1.02.006 2.04.136 3 .398 2.28-1.525 3.285-1.209 3.285-1.209.645 1.624.24 2.823.12 3.121.765.825 1.23 1.877 1.23 3.164 0 4.53-2.805 5.527-5.475 5.817.42.354.81 1.077.81 2.182 0 1.578-.015 2.846-.015 3.229 0 .309.21.678.825.56C20.565 21.917 24 17.499 24 12.292 24 5.78 18.627.5 12 .5z" />
    </svg>
  );
}

export function LoginPage() {
  const { status, authLostReason } = useAuth();
  const reduceMotion = useReducedMotion();

  const stageRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const [trace, setTrace] = useState<Trace | null>(null);

  // redraw whenever the layout moves, so the loop always wraps the card
  useLayoutEffect(() => {
    const stage = stageRef.current;
    const row = rowRef.current;
    const card = cardRef.current;
    if (!stage || !row || !card) return;

    const update = () => setTrace(buildTrace(stage, row, card));
    update();

    const observer = new ResizeObserver(update);
    observer.observe(stage);
    observer.observe(card);
    return () => observer.disconnect();
  }, [status]);

  const handleGithubLogin = () => {
    window.location.href = `${API_URL}/auth/github`;
  };

  if (status === "authenticated") {
    return <Navigate to="/dashboard" replace />;
  }

  const notice = authLostReason ? SIGN_OUT_MESSAGES[authLostReason] ?? null : null;

  return (
    <main className="login-theme flex min-h-screen flex-col bg-background text-foreground">
      <header className="px-6 py-6 sm:px-10 lg:px-14">
        <Logo size={30} />
      </header>

      <div
        ref={stageRef}
        className="relative grid flex-1 px-6 pb-10 sm:px-10 lg:grid-cols-[1fr_500px] lg:grid-rows-[1fr_auto_1fr] lg:px-14 xl:grid-cols-[1fr_520px]"
      >
        {/* ECG trace, drawn behind everything */}
        {trace && (
          <svg
            width={trace.width}
            height={trace.height}
            className="pointer-events-none absolute inset-0 overflow-visible"
            aria-hidden="true"
          >
            <path
              d={trace.d}
              pathLength={1000}
              fill="none"
              stroke="hsl(var(--foreground))"
              strokeOpacity={0.5}
              strokeWidth={1.5}
              strokeLinejoin="miter"
            />

            {!reduceMotion &&
              TRAILS.map((t) => (
                <path
                  key={t.length}
                  d={trace.d}
                  pathLength={1000}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeOpacity={t.opacity}
                  strokeWidth={t.width}
                  strokeLinecap="round"
                  strokeDasharray={`0 ${3000 - t.length} ${t.length} 0`}
                  className={`ecg-sweep ${t.length < 20 ? "ecg-head" : ""}`}
                />
              ))}

            {trace.labels.map((l) => (
              <text
                key={l.pr}
                x={l.x}
                y={l.y}
                textAnchor="middle"
                className="fill-muted-foreground font-mono text-[10px] uppercase tracking-[0.12em]"
              >
                <tspan x={l.x}>{l.pr}</tspan>
                <tspan x={l.x} dy={14} className="fill-foreground">
                  {l.finding}
                </tspan>
              </text>
            ))}

            {/* Commit dot, same as the one in the logo */}
            <circle
              cx={trace.end[0]}
              cy={trace.end[1]}
              r={6}
              fill="hsl(var(--primary))"
              className={reduceMotion ? "" : "ecg-dot"}
            />
          </svg>
        )}

        {/* Headline */}
        <h1
          className="relative self-end pt-6 pb-8 font-display text-[34px] font-bold leading-[0.98] tracking-[-0.035em] sm:text-[48px] lg:col-start-1 lg:row-start-1 lg:pr-16 lg:text-[36px] xl:text-[56px] 2xl:text-[64px]"
          style={{ fontStretch: "112%" }}
        >
          Debt you can see
          <br />
          is debt you can <span className="text-primary">fix.</span>
        </h1>

        {/* Row the ECG baseline runs through */}
        <div
          ref={rowRef}
          className="-ml-6 h-[120px] sm:-ml-10 lg:col-start-1 lg:row-start-2 lg:-ml-14"
        />

        {/* Supporting line */}
        <div className="relative self-start pt-4 sm:pt-10 lg:col-start-1 lg:row-start-3 lg:pr-16">
          <p className="max-w-md text-[15px] leading-7 text-muted-foreground">
            CodePulse reviews every pull request the moment it opens, flags
            what slipped in, and tracks your technical debt as one Health
            Score the whole team can read.
          </p>
        </div>

        {/* Sign in */}
        <motion.section
          ref={cardRef}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="relative mt-10 w-full self-center rounded-[2px] border border-border bg-card p-8 shadow-xl sm:p-10 lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:my-12 lg:w-[440px] lg:justify-self-center xl:w-[460px]"
        >
          <p className="eyebrow">Sign in</p>

          <h2 className="mt-3 font-display text-[30px] font-bold tracking-[-0.025em]">
            Welcome back
          </h2>

          <p className="mt-2.5 text-[15px] leading-6 text-muted-foreground">
            See your Health Scores, open findings and debt trend across every
            repository.
          </p>

          {notice && (
            <p className="mt-6 flex items-start gap-2.5 rounded-[2px] border border-warning/30 bg-warning/10 px-3 py-2.5 text-xs leading-5 text-warning">
              <AlertIcon size={15} className="mt-px shrink-0" />
              {notice}
            </p>
          )}

          <button
            type="button"
            onClick={handleGithubLogin}
            className="group mt-8 flex h-12 w-full items-center justify-center gap-2.5 rounded-[2px] bg-foreground text-[15px] font-medium text-background transition-colors hover:bg-primary"
          >
            <GithubMark />
            Continue with GitHub
            <ArrowRight
              size={15}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </button>

          <ul className="mt-8 space-y-3 border-t border-border pt-7">
            {FEATURES.map((text) => (
              <li
                key={text}
                className="flex items-center gap-2.5 text-[13px] text-muted-foreground"
              >
                <CheckIcon size={15} className="shrink-0 text-primary" />
                {text}
              </li>
            ))}
          </ul>

          <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            We never see your GitHub password.
          </p>
        </motion.section>
      </div>

      <footer className="flex flex-wrap gap-x-8 gap-y-2 border-t border-border px-6 py-5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground sm:px-10 lg:px-14">
        <span>Automated PR review</span>
        <span>Technical debt tracking</span>
        <span>Quality gates</span>
      </footer>
    </main>
  );
}
