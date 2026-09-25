import { motion } from "framer-motion";
import { useEffect, useLayoutEffect, useState, type CSSProperties } from "react";
import { matchPath, useLocation } from "react-router-dom";

import { usePreference } from "../../lib/usePreference";

interface Step {
  target?: string;
  title: string;
  text: string;
  // the user moves on by clicking the highlighted item instead of Next
  click?: boolean;
}

interface PageTour {
  id: string;
  path: string;
  steps: Step[];
}

// target matches a data-tour attribute somewhere on the page
const tours: PageTour[] = [
  {
    id: "dashboard",
    path: "/dashboard",
    steps: [
      {
        title: "Welcome to CodePulse",
        text: "Here's a quick look around. Each page shows a short guide the first time you open it.",
      },
      {
        target: "org-switcher",
        title: "Organization",
        text: "Pick which GitHub organization you're looking at.",
      },
      {
        target: "stats",
        title: "Your numbers",
        text: "Health Score and technical debt across all your linked repositories.",
      },
      {
        target: "pull-requests",
        title: "Pull requests",
        text: "Every PR gets analysed and either passes or fails the quality gate.",
      },
      {
        target: "notifications",
        title: "Notifications",
        text: "You'll get an alert here when a PR fails or a score drops.",
      },
      {
        target: "settings",
        title: "Settings",
        text: "Theme and other preferences. You can replay these guides from here.",
      },
      {
        target: "repositories",
        title: "Repositories",
        text: "Click Repositories to see and link your repos.",
        click: true,
      },
    ],
  },
  {
    id: "repositories",
    path: "/repositories",
    steps: [
      {
        target: "repo-stats",
        title: "Organization summary",
        text: "How many repos are linked, their average health, and how many findings they have in total.",
      },
      {
        target: "add-repo",
        title: "Link a repository",
        text: "Add repository lists the repos in your GitHub org. Pick one and link it (you need admin access on it). The first analysis starts on its own.",
      },
      {
        target: "repo-card",
        title: "Open a repository",
        text: "View repository shows its health, findings and trends. You'll get a short guide there too.",
      },
      {
        target: "analytics",
        title: "Analytics",
        text: "Click Analytics to compare all your repositories.",
        click: true,
      },
    ],
  },
  {
    id: "repository",
    path: "/repositories/:repoId",
    steps: [
      {
        target: "repo-stats",
        title: "Health Score",
        text: "Score out of 100, the open findings, and roughly how long they'd take to fix.",
      },
      {
        target: "health-trend",
        title: "Trend",
        text: "How the score has moved over the last 30 days.",
      },
      {
        target: "run-analysis",
        title: "Run analysis",
        text: "Analyse the default branch again whenever you want fresh numbers.",
      },
      {
        target: "all-findings",
        title: "Findings",
        text: "Hotspots are the files with the most issues. Click All findings to see every one.",
        click: true,
      },
    ],
  },
  {
    id: "findings",
    path: "/repositories/:repoId/findings",
    steps: [
      {
        target: "finding-stats",
        title: "By severity",
        text: "Findings split by severity, plus how many are new since the last analysis.",
      },
      {
        target: "finding-list",
        title: "Every finding",
        text: "Search or filter by severity. Each row shows the rule that fired, the file and line, and the tool that found it.",
      },
    ],
  },
  {
    id: "analytics",
    path: "/analytics",
    steps: [
      {
        target: "analytics-stats",
        title: "Analytics overview",
        text: "Averages across every repository you track.",
      },
      {
        target: "health-debt-chart",
        title: "Health vs debt",
        text: "Health Score and technical debt month by month.",
      },
      {
        target: "language-chart",
        title: "By language",
        text: "Average health for each main language.",
      },
      {
        target: "repo-table",
        title: "All repositories",
        text: "Compare repos side by side. Click a row to open one.",
      },
    ],
  },
];

export function Tour() {
  const { pathname } = useLocation();
  const [doneList, setDoneList] = usePreference<string>("toursDone", "");

  const done = doneList ? doneList.split(",") : [];
  const tour = tours.find(
    (t) => !done.includes(t.id) && matchPath(t.path, pathname),
  );

  if (!tour) return null;

  return (
    <TourSteps
      key={tour.id}
      steps={tour.steps}
      onFinish={() => setDoneList([...done, tour.id].join(","))}
      onSkip={() => setDoneList(tours.map((t) => t.id).join(","))}
    />
  );
}

const CARD_WIDTH = 320;
const CARD_HEIGHT = 200;
const GAP = 12;
const PAD = 6;

interface TourStepsProps {
  steps: Step[];
  onFinish: () => void;
  onSkip: () => void;
}

function TourSteps({ steps, onFinish, onSkip }: TourStepsProps) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const step = steps[index];
  const last = index === steps.length - 1;
  const waitingForClick = step.click && rect !== null;

  // keep looking for the target, since some pages load their data after a moment
  useLayoutEffect(() => {
    let scrolled = false;

    const measure = () => {
      const el = step.target
        ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
        : null;

      // centre small targets so the card has room, tall ones only need their top in view
      if (el && !scrolled) {
        const tall = el.getBoundingClientRect().height > window.innerHeight / 2;
        el.scrollIntoView?.({ block: tall ? "nearest" : "center" });
        scrolled = true;
      }

      // hidden elements (like the sidebar on phones) have no size, so fall back to a centered card
      const box = el?.getBoundingClientRect();
      const next = box && box.width > 0 ? box : null;
      setRect((prev) => (sameRect(prev, next) ? prev : next));
    };

    measure();
    const timer = setInterval(measure, 300);
    return () => clearInterval(timer);
  }, [step]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onSkip();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // capture phase, so the item's own click (like a link) still runs after this
  useEffect(() => {
    if (!waitingForClick) return;

    const onClick = (event: MouseEvent) => {
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (el?.contains(event.target as Node)) onFinish();
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  });

  const hole = rect && {
    top: rect.top - PAD,
    left: rect.left - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-10000">
      {hole ? (
        <>
          {/* four dark panels around the target, the gap between them stays clickable */}
          {[
            { top: 0, left: 0, right: 0, height: Math.max(hole.top, 0) },
            { top: hole.top + hole.height, left: 0, right: 0, bottom: 0 },
            { top: hole.top, left: 0, width: Math.max(hole.left, 0), height: hole.height },
            { top: hole.top, left: hole.left + hole.width, right: 0, height: hole.height },
          ].map((style, i) => (
            <div
              key={i}
              style={style}
              className="pointer-events-auto absolute bg-black/55 transition-all duration-200"
            />
          ))}

          <div
            style={hole}
            className={`absolute rounded-sm ring-2 ring-primary transition-all duration-200 ${
              waitingForClick ? "" : "pointer-events-auto"
            }`}
          />
        </>
      ) : (
        <div className="pointer-events-auto absolute inset-0 bg-black/55" />
      )}

      <div className={rect ? "" : "flex h-full items-center justify-center p-4"}>
        <motion.div
          key={index}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-title"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          style={rect ? cardPosition(rect) : undefined}
          className={`${rect ? "absolute" : "relative"} pointer-events-auto w-80 max-w-[calc(100vw-32px)] rounded-lg border border-border bg-popover p-4 shadow-xl`}
        >
          <p className="font-mono text-[11px] text-muted-foreground">
            {index + 1} of {steps.length}
          </p>

          <h2 id="tour-title" className="mt-1 text-sm font-semibold">
            {step.title}
          </h2>

          <p className="mt-1.5 text-[13px] text-muted-foreground">{step.text}</p>

          {waitingForClick && (
            <p className="mt-2 font-mono text-[11px] text-primary">
              Click the highlighted item to continue
            </p>
          )}

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={onSkip}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Skip tour
            </button>

            <div className="ml-auto flex items-center gap-2">
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => setIndex(index - 1)}
                  className="rounded-md border border-border px-3 py-1.5 text-xs transition-colors hover:bg-accent"
                >
                  Back
                </button>
              )}

              {!waitingForClick && (
                <button
                  type="button"
                  onClick={last ? onFinish : () => setIndex(index + 1)}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                >
                  {last ? "Finish" : "Next"}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function sameRect(a: DOMRect | null, b: DOMRect | null) {
  if (!a || !b) return a === b;
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;
}

// below the target if it fits, otherwise above, otherwise pinned to the bottom
function cardPosition(rect: DOMRect): CSSProperties {
  const left = Math.min(Math.max(rect.left, 16), window.innerWidth - CARD_WIDTH - 16);

  if (rect.bottom + GAP + CARD_HEIGHT < window.innerHeight) {
    return { left, top: rect.bottom + GAP };
  }

  if (rect.top - GAP - CARD_HEIGHT > 0) {
    return { left, bottom: window.innerHeight - rect.top + GAP };
  }

  return { left, bottom: 16 };
}
