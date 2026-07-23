import { motion } from "framer-motion";
import { useMemo, useState } from "react";

import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Code2,
  GitPullRequest,
  MoreHorizontal,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Wrench,
  Search,
  Plus,
} from "lucide-react";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";


/* =========================================================
   HEALTH TREND DATA
========================================================= */

const healthTrend = [
  { name: "Mon", score: 68 },
  { name: "Tue", score: 71 },
  { name: "Wed", score: 70 },
  { name: "Thu", score: 76 },
  { name: "Fri", score: 79 },
  { name: "Sat", score: 82 },
  { name: "Sun", score: 86 },
];


/* =========================================================
   REPOSITORY DATA
========================================================= */

const repositories = [
  {
    name: "AutomaticCodeReview",
    language: "TypeScript",
    score: 86,
    findings: 24,
    debt: "4h 20m",
    status: "Healthy",
  },
  {
    name: "MobileDashboard",
    language: "TypeScript",
    score: 74,
    findings: 47,
    debt: "8h 45m",
    status: "Needs attention",
  },
  {
    name: "AnalysisWorker",
    language: "Python",
    score: 91,
    findings: 12,
    debt: "2h 10m",
    status: "Excellent",
  },
];


/* =========================================================
   DASHBOARD STATISTICS
========================================================= */

const stats = [
  {
    title: "Repositories",
    value: "12",
    change: "+2 this month",
    trend: "up",
    icon: Code2,
    iconClass: "bg-primary/10 text-primary",
  },
  {
    title: "Average Health",
    value: "84.6",
    change: "+8.2% this week",
    trend: "up",
    icon: TrendingUp,
    iconClass: "bg-success/10 text-success",
  },
  {
    title: "Open Findings",
    value: "183",
    change: "-24 this week",
    trend: "down",
    icon: ShieldAlert,
    iconClass: "bg-warning/10 text-warning",
  },
  {
    title: "Technical Debt",
    value: "42h",
    change: "-6h this week",
    trend: "down",
    icon: Wrench,
    iconClass: "bg-info/10 text-info",
  },
];


/* =========================================================
   DASHBOARD PAGE
========================================================= */

export function DashboardPage() {

  /* =======================================================
     SEARCH + FILTER STATE
  ======================================================= */

  const [searchQuery, setSearchQuery] = useState("");

  const [languageFilter, setLanguageFilter] =
    useState("All");

  const [scoreFilter, setScoreFilter] =
    useState("All");


  /* =======================================================
     FILTER REPOSITORIES
  ======================================================= */

  const filteredRepositories = useMemo(() => {

    return repositories.filter((repository) => {

      /* SEARCH FILTER */

      const matchesSearch =
        repository.name
          .toLowerCase()
          .includes(searchQuery.toLowerCase());


      /* LANGUAGE FILTER */

      const matchesLanguage =
        languageFilter === "All" ||
        repository.language === languageFilter;


      /* SCORE FILTER */

      const matchesScore =
        scoreFilter === "All" ||

        (
          scoreFilter === "Excellent" &&
          repository.score >= 85
        ) ||

        (
          scoreFilter === "Needs attention" &&
          repository.score < 85
        );


      return (
        matchesSearch &&
        matchesLanguage &&
        matchesScore
      );

    });

  }, [
    searchQuery,
    languageFilter,
    scoreFilter,
  ]);


  return (

    <main className="min-h-screen bg-background">

      <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">


        {/* =====================================================
            PAGE HEADER
        ====================================================== */}

        <motion.div
          initial={{
            opacity: 0,
            y: 12,
          }}

          animate={{
            opacity: 1,
            y: 0,
          }}

          className="
            mb-8
            flex
            flex-col
            justify-between
            gap-4
            sm:flex-row
            sm:items-end
          "
        >

          <div>

            {/* Repository Intelligence Badge */}

            <div
              className="
                mb-3
                inline-flex
                items-center
                gap-2
                rounded-full
                border
                border-primary/80
                bg-primary/10
                px-3
                py-1.5
                text-xs
                font-medium
                text-primary
              "
            >

              <Sparkles size={13} />

              Repository intelligence

            </div>


            <h1
              className="
                text-3xl
                font-bold
                tracking-tight
                sm:text-4xl
              "
            >
              Good evening, Nethmi
            </h1>


            <p
              className="
                mt-2
                text-sm
                text-muted-foreground
              "
            >
              Here is the latest overview of your code quality and technical
              debt.
            </p>

          </div>


          {/* Add Repository Button */}

          <button
            className="
              inline-flex
              items-center
              justify-center
              gap-2
              rounded-xl
              bg-primary
              px-4
              py-2.5
              text-sm
              font-semibold
              text-primary-foreground
              shadow-lg
              shadow-primary/20
              transition
              hover:-translate-y-0.5
              hover:shadow-primary/30
            "
          >

            <Code2 size={17} />

            Add repository

          </button>

        </motion.div>


        {/* =====================================================
            STAT CARDS
        ====================================================== */}

        <div
          className="
            grid
            gap-4
            sm:grid-cols-2
            xl:grid-cols-4
          "
        >

          {stats.map((stat, index) => {

            const Icon = stat.icon;

            const isPositive =
              stat.trend === "up";


            return (

              <motion.div
                key={stat.title}

                initial={{
                  opacity: 0,
                  y: 20,
                }}

                animate={{
                  opacity: 1,
                  y: 0,
                }}

                transition={{
                  delay: index * 0.08,
                }}

                className="
                  group
                  rounded-2xl
                  border
                  border-border
                  bg-card
                  p-5
                  transition
                  hover:-translate-y-1
                  hover:border-primary/60
                  hover:shadow-xl
                "
              >

                <div
                  className="
                    flex
                    items-start
                    justify-between
                  "
                >

                  {/* Icon */}

                  <div
                    className={`
                      flex
                      h-11
                      w-11
                      items-center
                      justify-center
                      rounded-xl
                      ${stat.iconClass}
                    `}
                  >

                    <Icon size={20} />

                  </div>


                  {/* More Button */}

                  <button
                    className="
                      rounded-lg
                      p-1.5
                      text-muted-foreground
                      opacity-0
                      transition
                      hover:bg-muted
                      group-hover:opacity-100
                    "
                  >

                    <MoreHorizontal size={17} />

                  </button>

                </div>


                <p
                  className="
                    mt-5
                    text-sm
                    text-muted-foreground
                  "
                >
                  {stat.title}
                </p>


                <div
                  className="
                    mt-1
                    flex
                    items-end
                    justify-between
                    gap-2
                  "
                >

                  <p
                    className="
                      text-3xl
                      font-bold
                      tracking-tight
                    "
                  >
                    {stat.value}
                  </p>


                  <div
                    className="
                      flex
                      items-center
                      gap-1
                      text-xs
                      font-medium
                      text-success
                    "
                  >

                    {isPositive ? (

                      <ArrowUpRight size={14} />

                    ) : (

                      <ArrowDownRight size={14} />

                    )}

                    {stat.change}

                  </div>

                </div>

              </motion.div>

            );

          })}

        </div>


        {/* =====================================================
            HEALTH TREND + RECENT ACTIVITY
        ====================================================== */}

        <div
          className="
            mt-6
            grid
            gap-6
            xl:grid-cols-[1.5fr_1fr]
          "
        >


          {/* ===================================================
              HEALTH SCORE TREND
          ==================================================== */}

          <motion.section

            initial={{
              opacity: 0,
              y: 20,
            }}

            animate={{
              opacity: 1,
              y: 0,
            }}

            transition={{
              delay: 0.35,
            }}

            className="
              rounded-2xl
              border
              border-border
              bg-card
              p-5
              sm:p-6
            "
          >

            <div
              className="
                mb-6
                flex
                items-start
                justify-between
              "
            >

              <div>

                <p
                  className="
                    text-sm
                    font-semibold
                  "
                >
                  Health Score Trend
                </p>


                <p
                  className="
                    mt-1
                    text-xs
                    text-muted-foreground
                  "
                >
                  Average repository health over the last 7 days
                </p>

              </div>


              <div
                className="
                  text-right
                "
              >

                <p
                  className="
                    text-2xl
                    font-bold
                  "
                >
                  86
                </p>


                <p
                  className="
                    text-xs
                    text-success
                  "
                >
                  +18 points
                </p>

              </div>

            </div>


            {/* Chart */}

            <div
              className="
                h-[280px]
                w-full
              "
            >

              <ResponsiveContainer
                width="100%"
                height="100%"
              >

                <AreaChart
                  data={healthTrend}
                >

                  <defs>

                    <linearGradient
                      id="healthGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >

                      <stop
                        offset="0%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={0.35}
                      />

                      <stop
                        offset="100%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={0}
                      />

                    </linearGradient>

                  </defs>


                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    vertical={false}
                  />


                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 12,
                    }}
                  />


                  <YAxis
                    domain={[0, 100]}
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 12,
                    }}
                  />


                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "12px",
                      color: "hsl(var(--foreground))",
                    }}
                  />


                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    fill="url(#healthGradient)"
                  />

                </AreaChart>

              </ResponsiveContainer>

            </div>

          </motion.section>


          {/* ===================================================
              RECENT ACTIVITY
          ==================================================== */}

          <motion.section

            initial={{
              opacity: 0,
              y: 20,
            }}

            animate={{
              opacity: 1,
              y: 0,
            }}

            transition={{
              delay: 0.45,
            }}

            className="
              rounded-2xl
              border
              border-border
              bg-card
              p-5
              sm:p-6
            "
          >

            <div
              className="
                mb-6
                flex
                items-start
                justify-between
              "
            >

              <div>

                <p
                  className="
                    text-sm
                    font-semibold
                  "
                >
                  Recent Activity
                </p>


                <p
                  className="
                    mt-1
                    text-xs
                    text-muted-foreground
                  "
                >
                  Latest repository events
                </p>

              </div>


              <button
                className="
                  text-xs
                  font-medium
                  text-primary
                  hover:underline
                "
              >
                View all
              </button>

            </div>


            <div
              className="
                space-y-5
              "
            >

              {[

                {
                  icon: CheckCircle2,
                  title: "Analysis completed",
                  description:
                    "AutomaticCodeReview passed quality analysis",
                  time: "8 min ago",
                  className: "text-success bg-success/10",
                },

                {
                  icon: GitPullRequest,
                  title: "Pull request analyzed",
                  description:
                    "PR #42 introduced 3 new findings",
                  time: "32 min ago",
                  className: "text-info bg-info/10",
                },

                {
                  icon: ShieldAlert,
                  title: "Security finding detected",
                  description:
                    "Potential issue found in API service",
                  time: "1 hour ago",
                  className: "text-warning bg-warning/10",
                },

              ].map((activity) => {

                const Icon = activity.icon;


                return (

                  <div
                    key={activity.title}
                    className="
                      flex
                      gap-3
                    "
                  >

                    <div
                      className={`
                        flex
                        h-9
                        w-9
                        shrink-0
                        items-center
                        justify-center
                        rounded-xl
                        ${activity.className}
                      `}
                    >

                      <Icon size={16} />

                    </div>


                    <div
                      className="
                        min-w-0
                      "
                    >

                      <p
                        className="
                          text-sm
                          font-medium
                        "
                      >
                        {activity.title}
                      </p>


                      <p
                        className="
                          mt-1
                          truncate
                          text-xs
                          text-muted-foreground
                        "
                      >
                        {activity.description}
                      </p>


                      <p
                        className="
                          mt-1
                          text-[11px]
                          text-muted-foreground
                        "
                      >
                        {activity.time}
                      </p>

                    </div>

                  </div>

                );

              })}

            </div>

          </motion.section>

        </div>


        {/* =====================================================
            REPOSITORY HEALTH
        ====================================================== */}

        <motion.section

          initial={{
            opacity: 0,
            y: 20,
          }}

          animate={{
            opacity: 1,
            y: 0,
          }}

          transition={{
            delay: 0.55,
          }}

          className="
            mt-6
            rounded-2xl
            border
            border-border
            bg-card
            p-5
            sm:p-6
          "
        >


          {/* =====================================================
              REPOSITORY HEALTH HEADER
          ===================================================== */}

          <div
            className="
              mb-5
              flex
              items-center
              justify-between
            "
          >

            <div>

              <p
                className="
                  text-sm
                  font-semibold
                "
              >
                Repository Health
              </p>


              <p
                className="
                  mt-1
                  text-xs
                  text-muted-foreground
                "
              >
                Monitor your connected repositories
              </p>

            </div>


            <button
              className="
                text-xs
                font-medium
                text-primary
                hover:underline
              "
            >
              View repositories
            </button>

          </div>


          {/* =====================================================
              SEARCH + FILTER BAR
          ===================================================== */}

          <div
            className="
              mb-6
              flex
              flex-col
              gap-3
              rounded-xl
              border
              border-border
              bg-muted/20
              p-3
              lg:flex-row
              lg:items-center
            "
          >


            {/* SEARCH INPUT */}

            <div
              className="
                relative
                flex-1
              "
            >

              <Search
                size={17}
                className="
                  absolute
                  left-3
                  top-1/2
                  -translate-y-1/2
                  text-muted-foreground
                "
              />


              <input
                type="text"
                placeholder="Search repositories..."
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(event.target.value)
                }
                className="
                  h-10
                  w-full
                  rounded-lg
                  border
                  border-border
                  bg-card
                  pl-10
                  pr-3
                  text-sm
                  outline-none
                  transition
                  placeholder:text-muted-foreground
                  focus:border-primary
                  focus:ring-2
                  focus:ring-primary/20
                "
              />

            </div>


            {/* LANGUAGE FILTER */}

            <select
              value={languageFilter}
              onChange={(event) =>
                setLanguageFilter(event.target.value)
              }
              className="
                h-10
                rounded-lg
                border
                border-border
                bg-card
                px-3
                text-sm
                outline-none
                transition
                focus:border-primary
                focus:ring-2
                focus:ring-primary/20
              "
            >

              <option value="All">
                All Languages
              </option>


              <option value="TypeScript">
                TypeScript
              </option>


              <option value="Python">
                Python
              </option>

            </select>


            {/* SCORE FILTER */}

            <select
              value={scoreFilter}
              onChange={(event) =>
                setScoreFilter(event.target.value)
              }
              className="
                h-10
                rounded-lg
                border
                border-border
                bg-card
                px-3
                text-sm
                outline-none
                transition
                focus:border-primary
                focus:ring-2
                focus:ring-primary/20
              "
            >

              <option value="All">
                All Scores
              </option>


              <option value="Excellent">
                Excellent
              </option>


              <option value="Needs attention">
                Needs attention
              </option>

            </select>


            {/* LINK REPOSITORY BUTTON */}

            <button
              type="button"
              className="
                inline-flex
                h-10
                items-center
                justify-center
                gap-2
                rounded-lg
                bg-primary
                px-4
                text-sm
                font-semibold
                text-primary-foreground
                transition
                hover:-translate-y-0.5
                hover:shadow-lg
                hover:shadow-primary/20
              "
            >

              <Plus size={16} />

              Link Repository

            </button>

          </div>


          {/* =====================================================
              REPOSITORY CARDS
          ===================================================== */}

          <div
            className="
              grid
              gap-3
            "
          >

            {filteredRepositories.length > 0 ? (

              filteredRepositories.map((repository) => (

                <div
                  key={repository.name}

                  className="
                    group
                    flex
                    flex-col
                    gap-4
                    rounded-xl
                    border-2
                    border-border
                    p-4
                    transition
                    hover:border-primary/70
                    hover:bg-muted/60
                    sm:flex-row
                    sm:items-center
                  "
                >


                  {/* Repository Information */}

                  <div
                    className="
                      flex
                      min-w-0
                      flex-1
                      items-center
                      gap-3
                    "
                  >

                    <div
                      className="
                        flex
                        h-10
                        w-10
                        shrink-0
                        items-center
                        justify-center
                        rounded-xl
                        bg-primary/10
                        text-primary
                      "
                    >

                      <Code2 size={18} />

                    </div>


                    <div
                      className="
                        min-w-0
                      "
                    >

                      <p
                        className="
                          truncate
                          text-sm
                          font-semibold
                        "
                      >
                        {repository.name}
                      </p>


                      <p
                        className="
                          mt-1
                          text-xs
                          text-muted-foreground
                        "
                      >
                        {repository.language}
                      </p>

                    </div>

                  </div>


                  {/* Repository Metrics */}

                  <div
                    className="
                      flex
                      items-center
                      gap-6
                    "
                  >


                    {/* Health */}

                    <div>

                      <p
                        className="
                          text-[10px]
                          uppercase
                          tracking-wider
                          text-muted-foreground
                        "
                      >
                        Health
                      </p>


                      <p
                        className={`
                          mt-1
                          text-lg
                          font-bold
                          ${
                            repository.score >= 85
                              ? "text-success"
                              : "text-warning"
                          }
                        `}
                      >
                        {repository.score}
                      </p>

                    </div>


                    {/* Findings */}

                    <div
                      className="
                        hidden
                        sm:block
                      "
                    >

                      <p
                        className="
                          text-[10px]
                          uppercase
                          tracking-wider
                          text-muted-foreground
                        "
                      >
                        Findings
                      </p>


                      <p
                        className="
                          mt-1
                          text-sm
                          font-semibold
                        "
                      >
                        {repository.findings}
                      </p>

                    </div>


                    {/* Technical Debt */}

                    <div
                      className="
                        hidden
                        md:block
                      "
                    >

                      <p
                        className="
                          text-[10px]
                          uppercase
                          tracking-wider
                          text-muted-foreground
                        "
                      >
                        Debt
                      </p>


                      <p
                        className="
                          mt-1
                          text-sm
                          font-semibold
                        "
                      >
                        {repository.debt}
                      </p>

                    </div>


                    {/* Status */}

                    <span
                      className={`
                        rounded-full
                        px-2.5
                        py-1
                        text-xs
                        font-medium
                        ${
                          repository.score >= 85
                            ? "bg-success/10 text-success"
                            : "bg-warning/10 text-warning"
                        }
                      `}
                    >
                      {repository.status}
                    </span>

                  </div>

                </div>

              ))

            ) : (

              <div
                className="
                  rounded-xl
                  border
                  border-dashed
                  border-border
                  p-8
                  text-center
                "
              >

                <p
                  className="
                    text-sm
                    font-medium
                  "
                >
                  No repositories found
                </p>


                <p
                  className="
                    mt-1
                    text-xs
                    text-muted-foreground
                  "
                >
                  Try changing your search or filters.
                </p>

              </div>

            )}

          </div>

        </motion.section>

      </div>

    </main>

  );

}