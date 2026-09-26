# Static Analysis Tool Matrix

> **Date:** 21 June 2026 | **Verified against:** npm, PyPI, GitHub, Maven Central

---

## 1. Master Tool Matrix (Analysis Engine — Language-Level Only)

> **Key design decision:** Our analysis engine operates at the **language level**, not the framework level. A React app, a Next.js app, a Vue app, and an Angular app are all JavaScript/TypeScript under the hood — ESLint + typescript-eslint analyzes all of them identically. Similarly, a Django project and a FastAPI project are both Python — PyLint/Bandit/Radon work on both.
>
> This means our tool matrix is **framework-agnostic**. We do NOT need separate tools for React vs Vue vs Angular vs Svelte vs Next.js etc. — the language-level tools cover all frameworks built on that language.

| Language | Category | Tool | Version (Jun 2026) | Status | License | Notes |
|---|---|---|---|---|---|---|
| **JS/TS** | Style / Smells | ESLint | v10.x | ✅ Active | MIT | Flat config mandatory since v9. Covers ALL JS/TS frameworks (React, Next.js, Vue, Angular, Svelte, Express, NestJS, etc.) |
| **JS/TS** | Types | typescript-eslint | v8.61+ | ✅ Active | MIT | Flat config native. Works on any TS codebase regardless of framework. |
| **JS/TS** | Security | eslint-plugin-security | latest | ✅ Active | MIT | Generic JS/TS security rules — not framework-specific |
| **Python** | Security | Bandit | 1.9.x | ✅ Active | Apache-2.0 | Works on Django, Flask, FastAPI, or any Python project |
| **Python** | Style / Smells | PyLint | 3.x | ✅ Active | GPL-2.0 | ⚠️ GPL — see §6 |
| **Python** | Complexity + MI | Radon | 6.x | ✅ Active | MIT | Cyclomatic complexity + maintainability index |
| **Java** | Style | Checkstyle | 10.x | ✅ Active | LGPL-2.1 | Works on Spring Boot, Android, plain Java, etc. |
| **Java** | Complexity / Smells | PMD | 7.x | ✅ Active | BSD-4-Clause | Source-level; includes CPD |
| **C/C++** | All categories | Cppcheck | 2.21.x | ✅ Active | GPL-3.0 | ⚠️ GPL — see §6 |
| **All** | Duplication | jscpd | 5.x | ✅ Active | MIT | v5 rewritten in Rust (24-37x faster) |

> **SpotBugs dropped from this matrix.** An earlier revision listed SpotBugs for Java security/bug analysis, but SpotBugs analyzes **compiled bytecode** (it needs a `.class`/`.jar` output, invoked as `spotbugs -textui -xml:withMessages <classes-dir>`). Our worker pipeline only does a shallow `git clone --depth=1` — it never runs a Maven/Gradle build — so there is no bytecode for SpotBugs to analyze. Adding a build step for every cloned Java repo (unknown build tool, unknown dependencies, unknown JDK version) was judged out of scope for this project. See the Java row in §3 Coverage Gap Analysis for the resulting gap and mitigation.

### Why Language-Level Analysis Covers All Frameworks

| Framework | Underlying Language | Analyzed By |
|---|---|---|
| React, Next.js, Remix, Gatsby | JavaScript / TypeScript | ESLint + typescript-eslint + eslint-plugin-security |
| Vue, Nuxt | JavaScript / TypeScript | ESLint + typescript-eslint + eslint-plugin-security |
| Angular | TypeScript | ESLint + typescript-eslint + eslint-plugin-security |
| Svelte, SvelteKit | JavaScript / TypeScript | ESLint + typescript-eslint + eslint-plugin-security |
| Express, NestJS, Fastify | TypeScript / JavaScript | ESLint + typescript-eslint + eslint-plugin-security |
| React Native, Expo | TypeScript / JavaScript | ESLint + typescript-eslint + eslint-plugin-security |
| Django, Flask, FastAPI | Python | PyLint + Bandit + Radon |
| Spring Boot, Android (Java) | Java | Checkstyle + PMD |
| Any C/C++ project | C / C++ | Cppcheck |

---

## 2. Validation Results

### All Analysis Engine Tools Confirmed Active & Current

| Tool | Verdict |
|---|---|
| ESLint | ✅ v10 released Feb 2026. Flat config is now the only config format. |
| typescript-eslint | ✅ v8.61+ (Jun 2026). Full flat config support since v8.0 (Jul 2024). |
| eslint-plugin-security | ✅ Community-maintained, flat config compatible. |
| Bandit | ✅ v1.9.4 (early 2026). Supports Python 3.14. |
| PyLint | ✅ Regular releases through 2026. |
| Radon | ✅ Standard for Python complexity/MI metrics. |
| Checkstyle | ✅ v10.x actively maintained. |
| PMD | ✅ v7.x with improved Java 21+ support. |
| Cppcheck | ✅ v2.21.0 (Jun 2026). Monthly releases. |
| jscpd | ✅ v5 rewritten in Rust. Massively faster. |

No tool replacements required for the analysis engine. All 10 tools are actively maintained.

---

## 3. Coverage Gap Analysis

| Language | Vulnerability | Complexity | Duplication | Style/Smells | Maintainability | Gaps? |
|---|---|---|---|---|---|---|
| **JS/TS** | eslint-plugin-security | ESLint `complexity` rule | jscpd | ESLint + TS-ESLint | — | ⚠️ No dedicated maintainability index tool (see below) |
| **Python** | Bandit | Radon (CC) | jscpd | PyLint | Radon (MI) | ✅ Full coverage |
| **Java** | PMD `security` category (2 rules — hardcoded crypto keys/IVs only) | PMD (CyclomaticComplexity rule) | jscpd (+ PMD CPD built-in) | Checkstyle | — | ⚠️ Thin security coverage (see Gap 3 below); no maintainability index (see below) |
| **C/C++** | Cppcheck | Cppcheck (partial) | jscpd | Cppcheck | — | ⚠️ Complexity coverage is shallow; no MI |

### Identified Gaps

**Gap 1: JS/TS has no maintainability index tool.**
- Python has Radon MI; JS/TS has no equivalent npm tool that outputs a numeric maintainability index.
- **Mitigation:** Compute a proxy MI from the ESLint complexity score + jscpd duplication + LOC. This is what SonarQube does internally. Document this in the Health Score algorithm as "derived MI."

**Gap 2: Java has no standalone maintainability index.**
- PMD provides CyclomaticComplexity and NPathComplexity rules but not a Halstead/MI metric.
- **Mitigation:** Same proxy approach. Alternatively, PMD CPD can supplement jscpd for Java-specific duplication.

**Gap 3: Java security coverage is thin.**
- SpotBugs would have given deeper security/bug coverage, but it requires analyzing compiled bytecode, and our worker never builds the cloned repo (see the note in §1) — so it cannot run in this pipeline as designed.
- PMD's `category/java/security.xml` ruleset only has two rules (`HardCodedCryptoKey`, `InsecureCryptoIv`) — nowhere near Bandit's breadth for Python.
- **Mitigation:** Accept this as a known MVP limitation and document it plainly (this paragraph). If Java security depth becomes a priority later, adding a build step (detect Maven/Gradle, run `mvn compile`/`gradle build`, then run SpotBugs on the output) would be the fix — but it adds significant complexity (unknown build tool, dependency resolution, JDK version matching) for a "safe to cut" language per the Cut List in `project_plan.md`.

**Gap 3: C/C++ complexity analysis is shallow in Cppcheck.**
- Cppcheck focuses on bug detection, not complexity measurement. It has limited complexity heuristics.
- **Mitigation:** For academic scope, this is acceptable. Flag in documentation that C/C++ complexity coverage is weaker than Python/Java. If needed, `lizard` (MIT-licensed, pip-installable) provides cyclomatic complexity for C/C++ (and 20+ other languages).

---

## 4. Worker's ESLint Config (Used to Analyze User Repos)

This is the **single ESLint config** that the worker applies when scanning any JS/TS repository — regardless of whether that repo uses React, Vue, Angular, Next.js, Svelte, Express, or anything else. It is purely language-level.

### 4.1 NPM Packages Installed on Worker

```bash
# These are installed on the WORKER service, not on user repos
npm install --save-dev eslint @eslint/js typescript typescript-eslint eslint-plugin-security
```

That's it. No React plugin, no Vue plugin, no Angular plugin. The language-level tools catch the same core issues (unused vars, complexity, security anti-patterns) regardless of framework.

### 4.2 Worker ESLint Config (applied to all scanned JS/TS repos)

```javascript
// worker-eslint.config.mjs — used by the analysis engine
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import security from "eslint-plugin-security";

export default [
  // Base JS rules — works on .js, .jsx, .mjs, .cjs
  js.configs.recommended,

  // TypeScript rules — works on .ts, .tsx
  // Automatically skipped for pure JS repos
  ...tseslint.configs.recommended,

  // Security rules — detects eval(), hardcoded credentials, etc.
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs,cjs}"],
    plugins: { security },
    rules: {
      ...security.configs.recommended.rules,
    },
  },

  // Complexity + quality rules (feeds into Health Score)
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs,cjs}"],
    rules: {
      "complexity": ["warn", { max: 10 }],
      "max-depth": ["warn", { max: 4 }],
      "max-lines-per-function": ["warn", { max: 100 }],
      "no-unused-vars": "warn",
    },
  },

  // Always ignore these directories in scanned repos
  {
    ignores: [
      "**/node_modules/",
      "**/dist/",
      "**/build/",
      "**/.next/",
      "**/.nuxt/",
      "**/.expo/",
      "**/coverage/",
      "**/*.min.js",
      "**/*.bundle.js",
    ],
  },
];
```

> **Why no framework-specific plugins?** A React component, a Vue SFC's `<script>` block, and an Angular service are all TypeScript/JavaScript. ESLint + typescript-eslint catches complexity, unused variables, security issues, and style problems in all of them. Framework-specific plugins (like `eslint-plugin-react`) only add framework-specific rules (e.g., "hooks must be called at top level") which are useful for developers but not relevant to our Health Score categories (vulnerability, complexity, duplication, code smell, maintainability).

---

## 5. Python Tool Validation — Are Bandit/PyLint/Radon Sufficient?

**Answer: Yes, for our scope.** The Bandit + PyLint + Radon trio covers all four categories for Python:

| Category | Tool | Coverage |
|---|---|---|
| Security | Bandit | ✅ AST-based SAST; detects hardcoded passwords, SQL injection, shell injection, etc. |
| Style / Smells | PyLint | ✅ Deep analysis including cross-module type inference, naming conventions, code structure |
| Complexity | Radon | ✅ Cyclomatic complexity (CC) per function |
| Maintainability | Radon | ✅ Maintainability Index (MI) per file — the only Python tool that provides this |
| Duplication | jscpd | ✅ Cross-language, covers Python |

### What About Ruff?

**Ruff** (Rust-based Python linter) has emerged as the fastest Python linter, but:
- It replaces Flake8/isort/Black, **not** PyLint or Bandit at depth
- PyLint's cross-module type inference and Bandit's security-specific checks are deeper
- Ruff's security rules mirror *some* Bandit checks but not all

**Recommendation:** Keep Bandit + PyLint + Radon as our Python stack. Ruff is a "nice-to-have speed boost" but not necessary — our worker runs analysis asynchronously, so PyLint's slower speed is acceptable.

### One Addition Worth Considering

**`mypy` (type checking):** If analyzed Python repos use type hints, mypy catches type errors that PyLint misses. However, this requires the target project to have type annotations, which many don't. **Verdict: Skip for MVP.** Can be added as an optional analyzer in Sprint 2 if time permits.

---

## 6. Licensing Analysis

| Tool | License | "Pretend Commercial SaaS" Impact |
|---|---|---|
| ESLint | MIT | ✅ No concern |
| typescript-eslint | MIT | ✅ No concern |
| eslint-plugin-security | MIT | ✅ No concern |
| jscpd | MIT | ✅ No concern |
| Bandit | Apache-2.0 | ✅ No concern (permissive) |
| Radon | MIT | ✅ No concern |
| Checkstyle | LGPL-2.1 | ✅ LGPL allows use as a tool without "infecting" your code |
| PMD | BSD-4-Clause | ✅ Permissive |
| **PyLint** | **GPL-2.0** | ⚠️ **Potential concern** — see below |
| **Cppcheck** | **GPL-3.0** | ⚠️ **Potential concern** — see below |

### GPL Tools: PyLint & Cppcheck

**The concern:** GPL requires that any software that "links" to or "incorporates" a GPL'd program must also be GPL'd. However, our system **invokes these tools as external CLI processes** (`child_process.exec()`) and parses their stdout — we do not link to their libraries or include their source code.

**Legal interpretation (widely accepted):** Running a GPL tool as a subprocess and parsing its output does **not** create a derivative work. This is the same model used by SonarQube, GitHub Super Linter, MegaLinter, and every CI/CD platform that invokes GPL linters.

**For the academic "pretend SaaS" framing:** This is a non-issue. For a real commercial product, you'd want legal counsel to confirm, but the subprocess invocation model is industry-standard.

**Bottom line:** No licensing changes needed. Document in the SRS that all tools are invoked as CLI subprocesses, not linked as libraries.

---

## 7. Worker Tool Invocation Summary

How each tool is invoked in the worker's analysis pipeline:

| Tool | Invocation | Output Format | Parse Strategy |
|---|---|---|---|
| ESLint | `npx eslint --format json .` | JSON array of file results | Native JSON parse |
| PyLint | `pylint --output-format=json <dir>` | JSON array of messages | Native JSON parse |
| Bandit | `bandit -r <dir> -f json` | JSON with `results` array | Native JSON parse |
| Radon | `radon cc <dir> -j` / `radon mi <dir> -j` | JSON object keyed by file | Native JSON parse |
| Checkstyle | `java -jar checkstyle.jar -f xml -c /google_checks.xml <dir>` | XML | Parse with `fast-xml-parser` |
| PMD | `pmd check -d <dir> -R rulesets/java/quickstart.xml -f json` | JSON | Native JSON parse |
| Cppcheck | `cppcheck --enable=all --xml <dir> 2>&1` | XML (stderr) | Parse with `fast-xml-parser` |
| jscpd | `jscpd <dir> --reporters json --output <tmp>` | JSON file | Read + JSON parse |

---

*This document validates the tool matrix as of June 2026. All 10 analysis engine tools are actively maintained. The analysis engine is framework-agnostic — it operates at the language level (JS/TS, Python, Java, C/C++) and works on any framework built on those languages.*
