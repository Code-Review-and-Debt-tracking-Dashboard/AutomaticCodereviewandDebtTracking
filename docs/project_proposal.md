# Project Proposal

<<Name>>
<<Index No>>


## 1. Title of the Project

**Automated Code Review and Technical Debt Tracking Dashboard**


## 2. Overview of the Project

This project is a SaaS-based platform that automates code review and tracks technical debt for software development teams. It integrates directly with GitHub via webhooks to analyze Pull Requests using open-source static analysis tools.

When a developer opens a Pull Request on GitHub, the system automatically clones the repository, runs a suite of language-appropriate static analysis tools (such as ESLint, PyLint, Bandit, and Checkstyle), and produces two key metrics: a **Health Score** (0–100) that summarizes overall code quality, and a **Debt Score** (in estimated remediation minutes) that quantifies the effort required to resolve detected issues. The results are posted back to the Pull Request as an automated bot comment, and all historical data is stored for trend analysis.

The platform consists of four components:
- A **web dashboard** (React) where users can view repository health trends, debt breakdowns by category, and configure quality gates.
- A **mobile companion app** (React Native) for team leads to receive push notifications when critical issues are introduced or quality gates fail.
- A **backend API service** (Node.js/Express) that handles authentication, webhook reception, and serves data to the frontends.
- A **worker service** (Node.js/BullMQ) that performs the actual code analysis asynchronously without blocking the API.

**Input:** GitHub webhook events (Pull Request opened/updated/merged), user authentication via GitHub OAuth, repository configuration (quality gate thresholds).

**Output:** Automated PR review comments on GitHub, a Health Score and Debt Score per analysis, historical trend charts, categorized finding reports (security vulnerabilities, complexity, code smells, duplication), push notifications for critical events, and pass/fail quality gate status on Pull Requests.


## 3. Objectives of the Project

The objectives of this project are to:

- Design and implement a two-service backend architecture (API + Worker) that can receive GitHub webhooks, queue analysis jobs, and return results within a reasonable timeframe without blocking the main API.
- Provide a deterministic Health Score algorithm that converts raw static analysis findings into a single 0–100 score, weighted by severity and category (security issues weigh more heavily than style issues).
- Automate the first pass of code review by posting categorized findings (vulnerabilities, complexity, duplication, code smells) directly as comments on GitHub Pull Requests.
- Implement a Technical Debt tracking system that quantifies debt in estimated remediation minutes and tracks whether debt is increasing or decreasing over time.
- Develop a web dashboard that visualizes code quality trends, debt breakdowns, and worst-offending files, making complex metrics accessible to both developers and non-technical project managers.
- Develop a mobile companion application that delivers real-time push notifications for critical code regressions, quality gate failures, and significant debt increases.
- Support multi-language analysis covering JavaScript/TypeScript, Python, Java, and C/C++ codebases using established open-source static analysis tools.


## 4. The Need for the Project

Software development teams face several recurring problems that this project directly addresses:

**Review bottlenecks.** Senior developers spend a disproportionate amount of time catching syntax errors, style inconsistencies, and known anti-patterns during manual code review. This time could be spent on higher-value activities like reviewing architectural decisions and business logic. By automating the detection of these routine issues, the system frees up senior reviewers to focus on what matters.

**Invisible technical debt.** Technical debt — such as high cyclomatic complexity, duplicated code blocks, and security vulnerabilities — accumulates silently. Teams often do not realize the extent of their debt until it causes production failures or makes the codebase unmaintainable. A quantified Debt Score expressed in remediation minutes makes this debt visible and trackable over sprint cycles.

**Tool fatigue.** Developers currently need to switch between GitHub (for PRs), separate static analysis tools (ESLint, PyLint), and project management dashboards to understand the state of their code. This project consolidates all of this into a single dashboard with a unified scoring model.

**Accessibility gap.** Enterprise-grade tools like SonarQube are resource-heavy, expensive, and designed for DevOps experts. Small teams, student projects, and junior developers struggle to set up and interpret these tools. This project provides a lightweight alternative that requires only a GitHub login to get started — no complex configuration or infrastructure setup.

**Lack of trend visibility.** Most static analysis tools only show a snapshot of the current state. They do not tell you whether code quality is improving or degrading over time. The trend analysis feature in this project addresses this gap directly, enabling teams to make data-driven decisions about when to prioritize debt reduction.


## 5. Scope of the Project

### User Roles

The system supports two primary user roles:

1. **Developer** — Connects GitHub repositories, views analysis results, reviews PR findings, and monitors code health.
2. **Team Lead / Project Manager** — Views health trends across multiple repositories, configures quality gate thresholds, and receives mobile push notifications for critical events.

### Core Functionalities

**Authentication and Repository Management**
- User authentication via GitHub OAuth (login with GitHub).
- Link and unlink GitHub repositories to the platform.
- Automatic webhook registration on linked repositories.

**Automated Code Analysis**
- Webhook listener that triggers analysis when a Pull Request is opened, updated, or merged.
- Multi-language static analysis using ESLint (JavaScript/TypeScript), PyLint and Bandit (Python), Checkstyle, PMD, and SpotBugs (Java), Cppcheck (C/C++), and jscpd (duplication detection for all languages).
- Manual analysis trigger for on-demand scans.

**Health Score and Technical Debt Tracking**
- Deterministic Health Score (0–100) computed from weighted analysis findings.
- Debt Score expressed in estimated remediation minutes.
- Debt Delta computation showing whether a Pull Request introduces new debt or resolves existing debt.
- Historical trend tracking of both Health Score and Debt Score over time.
- Categorized finding breakdown: security vulnerabilities, complexity issues, code duplication, and code smells.

**Quality Gates**
- Configurable thresholds per repository (minimum Health Score, maximum critical vulnerabilities, maximum duplication percentage).
- Automated pass/fail status posted to GitHub Pull Requests.

**Web Dashboard**
- Repository overview with health scores and trend sparklines.
- Detailed repository view with trend line charts, debt breakdown charts, worst-offending files table, and PR scan history.
- Individual PR finding drill-down with file/line location, severity, and category.
- Quality gate configuration interface.

**Mobile Application**
- Repository list with health score summaries.
- Push notifications for quality gate failures, critical vulnerabilities introduced, and significant score drops.
- Quick-view summary of the latest scan results.

**Automated PR Bot**
- Posts a formatted comment on each analyzed Pull Request with: Health Score, Debt Score, Debt Delta, new findings count, and resolved findings count.

### Explicitly Out of Scope

- Automated AI-based code fixing (suggesting or writing code for the developer).
- Support for SVN or legacy non-Git version control systems.
- Deep integration with IDEs (e.g., VS Code extensions).
- Support for GitLab or Bitbucket (GitHub only for this version).


## 6. Deliverables

1. A **web-based dashboard application** (React + Vite) that allows users to log in with GitHub, link repositories, view Health Scores, analyze trends, and configure quality gates.

2. A **mobile application** (React Native + Expo) that provides push notifications for critical code events and quick-view summaries of repository health.

3. A **backend API service** (Node.js + Express + TypeScript) that handles authentication, webhook reception, and serves RESTful API endpoints to both frontends.

4. A **worker service** (Node.js + BullMQ + TypeScript) that performs asynchronous code analysis using open-source static analysis tools and posts results back to GitHub.

5. A **PostgreSQL database** (managed via Prisma ORM) storing users, repositories, health snapshots, individual findings, quality gate configurations, and notifications.

6. An **automated GitHub PR bot** that posts structured review comments with Health Scores and finding summaries on every analyzed Pull Request.

7. Comprehensive **technical documentation** including: System Requirements Specification (SRS), System Architecture and Design document, Database Design document, API Design document, and a Testing document.

8. A **final report** comparing manual code review times before and after using the tool.

9. A **marketing video** (10–15 minutes) demonstrating the system's features and value proposition.


## 7. Overview of Existing Systems and Technology

### Existing Similar Systems

**SonarQube** [1] is the most widely used open-source platform for continuous code quality inspection. It performs static analysis to detect bugs, vulnerabilities, and code smells across 30+ programming languages. SonarQube provides quality gates and historical trend tracking. However, it requires a self-hosted server with significant infrastructure (Java runtime, database), making it heavy for small teams. Its scoring model focuses on letter grades (A–E) rather than a single numeric health score. Our project differs by offering a lightweight SaaS model with no self-hosting required and a unified numeric Health Score designed for non-technical stakeholders.

**CodeClimate Quality** [2] is a commercial SaaS platform that provides automated code review and maintainability tracking. It computes a "Maintainability" grade (A–F) and tracks technical debt in remediation time. It integrates with GitHub to post status checks on Pull Requests. CodeClimate is a proprietary, paid service with limited free-tier functionality. Our project provides similar functionality as an open-source, self-deployable solution with a more granular scoring algorithm and a dedicated mobile companion app.

**DeepSource** [3] is a modern automated code review platform that uses static analysis to find and auto-fix issues in Python, JavaScript, Go, Ruby, and other languages. It provides a dashboard for tracking code health across repositories. DeepSource includes AI-powered auto-fix capabilities (which are outside our project scope). Our project focuses on deterministic analysis with a transparent, reproducible scoring algorithm rather than AI-based suggestions.

**GitHub Super Linter** [4] is an open-source GitHub Action that runs a combination of linters against a repository on every push or PR. It supports 50+ linters across many languages. However, it only reports pass/fail per linter — it does not compute an aggregate health score, does not track debt over time, and has no dashboard or mobile app. Our project builds on the same concept of multi-linter analysis but adds scoring, trend tracking, a dashboard, and mobile notifications.

**Review Bot** (by Beanbag, Inc.) [5] is an open-source automated code review tool designed for the Review Board platform. It uses Celery for scalable task processing and supports a wide range of static analysis tools including Checkstyle, Cppcheck, PMD, Flake8, and JSHint across multiple languages. Review Bot is extensible through a plugin-based architecture, allowing custom tools to be integrated via a Python API. However, it is tightly coupled to the Review Board code review platform and cannot be used with GitHub or GitLab Pull Requests directly. Our project differs by integrating natively with GitHub's webhook and Pull Request system, which is the most widely used platform among our target audience.

**Qiniu Reviewbot** [6] is a self-hosted, open-source code analysis and review service developed by Qiniu Cloud. Built in Go, it supports both GitHub and GitLab platforms and offers a universal linter integration mechanism that allows new code checking tools to be added without modifying the source code. It includes AI-powered analysis for providing detailed explanations and fix suggestions. Qiniu Reviewbot supports execution of linters via Docker containers or Kubernetes clusters, making it highly scalable. However, it does not provide a web dashboard, historical trend tracking, a health scoring system, or a mobile companion app. Our project addresses these gaps by providing a full-stack dashboard with trend analysis, a unified Health Score, and mobile notifications.

**ReviewBoard ReviewBot** [7] is the GitHub-hosted source code repository for the Review Bot project described above [5]. The project consists of a Review Board extension, a message broker (RabbitMQ), and one or more worker instances. It is written primarily in Python (95.6%) and is licensed under MIT. The architecture — a separate worker process for running static analysis tools, communicating via a message queue — is conceptually similar to our project's API + BullMQ Worker design. However, our project uses BullMQ with Redis (rather than Celery with RabbitMQ) for simpler deployment and uses Node.js/TypeScript throughout for a unified language stack.

### Technologies and Tools

**Backend:**
- Node.js v20 LTS [8] — JavaScript runtime for the API and Worker services.
- Express.js v4 [9] — HTTP framework for the REST API.
- TypeScript v5 [10] — Type-safe language across all services.
- BullMQ v5 [11] — Redis-backed job queue for asynchronous task processing.
- Prisma v5 [12] — Type-safe ORM for PostgreSQL database access and migrations.
- Octokit [13] — Official GitHub REST API client for posting PR comments and commit statuses.

**Static Analysis Tools:**
- ESLint v10 [14] — JavaScript/TypeScript linting (style, complexity, quality).
- typescript-eslint v8 [15] — TypeScript-specific analysis rules.
- eslint-plugin-security [16] — JavaScript/TypeScript security vulnerability detection.
- PyLint v3 [17] — Python style and code smell detection.
- Bandit v1.9 [18] — Python security vulnerability scanner.
- Radon v6 [19] — Python cyclomatic complexity and maintainability index computation.
- Checkstyle v10 [20] — Java code style analysis.
- PMD v7 [21] — Java complexity and code smell detection.
- SpotBugs v4.9 [22] — Java bytecode-level bug and security analysis.
- Cppcheck v2.21 [23] — C/C++ static analysis (security, complexity, style).
- jscpd v5 [24] — Cross-language copy-paste (code duplication) detection.

**Frontend:**
- React v18 [25] — UI library for the web dashboard.
- Vite v5 [26] — Build tool and development server for the web application.
- Recharts [27] — Charting library for trend line charts and debt breakdown visualizations.
- React Native v0.74 + Expo v51 [28] — Mobile application framework.

**Infrastructure:**
- PostgreSQL v16 [29] — Relational database for all persistent data.
- Redis v7 [30] — In-memory data store used as the BullMQ job queue backend.
- Docker Compose v2 [31] — Container orchestration for local development (PostgreSQL + Redis).
- GitHub Actions [32] — CI/CD pipeline for automated linting, testing, and deployment.
- Pino [33] — Structured JSON logging for production observability.


## 8. References

[1] SonarSource, "SonarQube — Continuous Code Quality," [Online]. Available: https://www.sonarqube.org/. (Accessed on 23 June 2026)

[2] Code Climate, Inc., "Code Climate Quality," [Online]. Available: https://codeclimate.com/quality/. (Accessed on 23 June 2026)

[3] DeepSource Corp., "DeepSource — Automated Code Reviews," [Online]. Available: https://deepsource.com/. (Accessed on 23 June 2026)

[4] GitHub, Inc., "GitHub Super Linter," [Online]. Available: https://github.com/super-linter/super-linter. (Accessed on 23 June 2026)

[5] Beanbag, Inc., "Review Bot — Automated code review for Review Board," [Online]. Available: https://www.reviewboard.org/docs/reviewbot/latest/. (Accessed on 23 June 2026)

[6] Qiniu Cloud, "Qiniu Reviewbot — Self-Hosted Automated Code Analysis and Review," [Online]. Available: https://github.com/qiniu/reviewbot. (Accessed on 23 June 2026)

[7] Beanbag, Inc., "ReviewBot — Source Code Repository," [Online]. Available: https://github.com/reviewboard/ReviewBot. (Accessed on 23 June 2026)

[8] OpenJS Foundation, "Node.js," [Online]. Available: https://nodejs.org/. (Accessed on 23 June 2026)

[9] OpenJS Foundation, "Express — Node.js web application framework," [Online]. Available: https://expressjs.com/. (Accessed on 23 June 2026)

[10] Microsoft, "TypeScript — JavaScript with syntax for types," [Online]. Available: https://www.typescriptlang.org/. (Accessed on 23 June 2026)

[11] Taskforce.sh, "BullMQ — Premium Message Queue for Node.js," [Online]. Available: https://bullmq.io/. (Accessed on 23 June 2026)

[12] Prisma Data, Inc., "Prisma — Next-generation Node.js and TypeScript ORM," [Online]. Available: https://www.prisma.io/. (Accessed on 23 June 2026)

[13] GitHub, Inc., "Octokit — Official clients for the GitHub API," [Online]. Available: https://github.com/octokit/. (Accessed on 23 June 2026)

[14] OpenJS Foundation, "ESLint — Pluggable JavaScript/TypeScript Linter," [Online]. Available: https://eslint.org/. (Accessed on 23 June 2026)

[15] typescript-eslint, "typescript-eslint — Tooling for TypeScript linting," [Online]. Available: https://typescript-eslint.io/. (Accessed on 23 June 2026)

[16] eslint-community, "eslint-plugin-security," [Online]. Available: https://github.com/eslint-community/eslint-plugin-security. (Accessed on 23 June 2026)

[17] PyCQA, "PyLint — Python Code Quality Authority," [Online]. Available: https://pylint.readthedocs.io/. (Accessed on 23 June 2026)

[18] PyCQA, "Bandit — Security linter for Python," [Online]. Available: https://bandit.readthedocs.io/. (Accessed on 23 June 2026)

[19] M. Lacchia, "Radon — Python tool for code metrics," [Online]. Available: https://radon.readthedocs.io/. (Accessed on 23 June 2026)

[20] Checkstyle Contributors, "Checkstyle — Java code style checker," [Online]. Available: https://checkstyle.org/. (Accessed on 23 June 2026)

[21] PMD Contributors, "PMD — An extensible cross-language static code analyzer," [Online]. Available: https://pmd.github.io/. (Accessed on 23 June 2026)

[22] SpotBugs Contributors, "SpotBugs — Find bugs in Java programs," [Online]. Available: https://spotbugs.github.io/. (Accessed on 23 June 2026)

[23] D. Marjamäki, "Cppcheck — A static analysis tool for C/C++," [Online]. Available: https://cppcheck.sourceforge.io/. (Accessed on 23 June 2026)

[24] K. Nickel, "jscpd — Copy/paste detector for source code," [Online]. Available: https://github.com/nicedoc/jscpd. (Accessed on 23 June 2026)

[25] Meta Platforms, Inc., "React — A JavaScript library for building user interfaces," [Online]. Available: https://react.dev/. (Accessed on 23 June 2026)

[26] E. You, "Vite — Next Generation Frontend Tooling," [Online]. Available: https://vitejs.dev/. (Accessed on 23 June 2026)

[27] Recharts Contributors, "Recharts — A composable charting library for React," [Online]. Available: https://recharts.org/. (Accessed on 23 June 2026)

[28] Expo, Inc., "Expo — Make any app. Run it everywhere," [Online]. Available: https://expo.dev/. (Accessed on 23 June 2026)

[29] The PostgreSQL Global Development Group, "PostgreSQL," [Online]. Available: https://www.postgresql.org/. (Accessed on 23 June 2026)

[30] Redis Ltd., "Redis — The Real-time Data Platform," [Online]. Available: https://redis.io/. (Accessed on 23 June 2026)

[31] Docker, Inc., "Docker Compose," [Online]. Available: https://docs.docker.com/compose/. (Accessed on 23 June 2026)

[32] GitHub, Inc., "GitHub Actions — Automate your workflow," [Online]. Available: https://github.com/features/actions. (Accessed on 23 June 2026)

[33] Pino Contributors, "Pino — Super fast, all natural JSON logger," [Online]. Available: https://getpino.io/. (Accessed on 23 June 2026)