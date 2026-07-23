import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Code2,
  GitPullRequest,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const API_URL =
  import.meta.env.VITE_API_URL ??
  "http://localhost:3000";

export function LoginPage() {
  const handleGithubLogin = () => {
    window.location.href = `${API_URL}/auth/github`;
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />

        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-info/10 blur-3xl" />

        <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative mx-auto grid min-h-screen max-w-7xl lg:grid-cols-2">
        <section className="hidden flex-col justify-between p-12 lg:flex xl:p-20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
              <Code2 size={21} />
            </div>

            <span className="text-lg font-bold tracking-tight">
              CodePulse
            </span>
          </div>

          <div className="max-w-xl">
            <motion.div
              initial={{
                opacity: 0,
                y: 20,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                duration: 0.6,
              }}
            >
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                <Sparkles size={14} />
                Intelligent code quality insights
              </div>

              <h1 className="text-5xl font-bold leading-[1.05] tracking-tight xl:text-6xl">
                Understand your code.
                <span className="block bg-gradient-to-r from-primary via-indigo-400 to-info bg-clip-text text-transparent">
                  Improve continuously.
                </span>
              </h1>

              <p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground">
                Automatically analyze your repositories, track technical debt,
                and understand code quality from every pull request.
              </p>
            </motion.div>

            <motion.div
              initial={{
                opacity: 0,
                y: 20,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                duration: 0.6,
                delay: 0.15,
              }}
              className="mt-10 grid gap-4 sm:grid-cols-2"
            >
              {[
                {
                  icon: BarChart3,
                  title: "Health Score",
                  text: "Track code quality over time.",
                },
                {
                  icon: ShieldCheck,
                  title: "Security Insights",
                  text: "Detect risks earlier.",
                },
                {
                  icon: GitPullRequest,
                  title: "PR Analysis",
                  text: "Review every change automatically.",
                },
                {
                  icon: CheckCircle2,
                  title: "Quality Gates",
                  text: "Protect your standards.",
                },
              ].map((feature) => {
                const Icon = feature.icon;

                return (
                  <div
                    key={feature.title}
                    className="group rounded-2xl border border-border/70 bg-card/60 p-4 backdrop-blur-xl transition hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg"
                  >
                    <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:scale-110">
                      <Icon size={17} />
                    </div>

                    <p className="text-sm font-semibold">
                      {feature.title}
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {feature.text}
                    </p>
                  </div>
                );
              })}
            </motion.div>
          </div>

          <p className="text-xs text-muted-foreground">
            Automated Code Review & Technical Debt Tracking
          </p>
        </section>

        <section className="flex items-center justify-center p-6 sm:p-10">
          <motion.div
            initial={{
              opacity: 0,
              y: 20,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.5,
            }}
            className="w-full max-w-md"
          >
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Code2 size={21} />
              </div>

              <span className="text-lg font-bold">
                CodePulse
              </span>
            </div>

            <div className="rounded-3xl border border-border/70 bg-card/80 p-7 shadow-2xl backdrop-blur-xl sm:p-9">
              <div className="mb-8">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Code2 size={25} />
                </div>

                <h2 className="text-2xl font-bold tracking-tight">
                  Welcome back
                </h2>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Connect your GitHub account to start monitoring your
                  repositories.
                </p>
              </div>

              <button
                onClick={handleGithubLogin}
                className="group flex w-full items-center justify-center gap-3 rounded-xl bg-foreground px-4 py-3.5 text-sm font-semibold text-background transition hover:-translate-y-0.5 hover:shadow-xl"
              >
                <Code2 size={19} />

                Continue with GitHub

                <ArrowRight
                  size={17}
                  className="transition-transform group-hover:translate-x-1"
                />
              </button>

              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />

                <span className="text-[11px] text-muted-foreground">
                  SECURE AUTHENTICATION
                </span>

                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="space-y-3">
                {[
                  "No password stored by the dashboard",
                  "Repository access controlled by GitHub",
                  "Secure authenticated API requests",
                ].map((text) => (
                  <div
                    key={text}
                    className="flex items-center gap-3 text-xs text-muted-foreground"
                  >
                    <Lock
                      size={14}
                      className="shrink-0 text-success"
                    />

                    {text}
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              By continuing, you authorize the application to access the
              GitHub permissions required for repository analysis.
            </p>
          </motion.div>
        </section>
      </div>
    </main>
  );
}