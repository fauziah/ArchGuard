# ArchGuard

[![npm version](https://img.shields.io/npm/v/archguard.svg)](https://www.npmjs.com/package/archguard)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![GitHub stars](https://img.shields.io/github/stars/lindseystead/archguard?style=social)](https://github.com/lindseystead/archguard)
[![GitHub forks](https://img.shields.io/github/forks/lindseystead/archguard?style=social)](https://github.com/lindseystead/archguard)
[![GitHub issues](https://img.shields.io/github/issues/lindseystead/archguard)](https://github.com/lindseystead/archguard/issues)
[![npm downloads](https://img.shields.io/npm/dm/archguard)](https://www.npmjs.com/package/archguard)
[![GitHub last commit](https://img.shields.io/github/last-commit/lindseystead/archguard)](https://github.com/lindseystead/archguard)
![Visitors](https://visitor-badge.laobi.icu/badge?page_id=lindseystead.archguard)


ArchGuard makes certain kinds of bad code impossible to commit, and makes AI explain itself instead of breaking your architecture.

## Why this exists

You're using Cursor (or other AI coding tools like Copilot) to build React apps faster. It works great — until it doesn't.

**The problem:** AI tools optimize for "working code," not "correct architecture." They'll happily:
- Put business logic in components
- Fetch data directly in UI
- Create circular dependencies
- Violate layer boundaries

You end up with code that works but rots your architecture. Seniors spend time cleaning up after AI instead of building features.

**The solution:** ArchGuard enforces your architecture at two points:
1. **Generation time** — Cursor reads your rules before generating code
2. **Commit time** — Pre-commit hooks block violations

This is not a linter. This is not a style guide. This is a gate that physically prevents bad patterns from landing.

**Who needs this:**
- Teams using AI coding tools (Cursor, Copilot)
- React + TypeScript projects with layered architecture
- Teams where architecture drift is a real problem
- Projects where "it works" isn't good enough

If you're not using AI tools or don't care about architecture boundaries, this tool isn't for you.

## What it does

ArchGuard enforces a layered React architecture and constrains AI so it cannot violate those rules — at generation time or commit time.

### In practice

**1. You define your architecture once:**

```yaml
layers:
  domain:
    allowedImports: []
  features:
    allowedImports: [domain, shared]
  ui:
    allowedImports: [features, shared]
```

This says: domain is pure, features orchestrate, UI only renders. No shortcuts.

ArchGuard treats this as an enforceable constraint, not documentation.

**2. It checks every file against those constraints:**

```bash
npx archguard check
```

ArchGuard parses every `.ts` / `.tsx` file, builds an AST, extracts imports, determines layers, and runs rules. Nothing magical. No inference. Just deterministic checks.

**3. It blocks specific mistakes:**

- **Layer violations** — UI importing domain is blocked
- **Business logic in components** — Loops and complex conditionals in React components are blocked
- **Data fetching in UI** — `fetch` and `axios` calls in components are blocked
- **Circular dependencies** — Cycles between layers are blocked

If any of these exist, `archguard check` exits with code 1, pre-commit hooks block commits, and CI fails.

This is not advice. This is enforcement.

**4. It provides context to AI tools:**

ArchGuard generates `.cursor/AI_RULES.md` that Cursor may read as context before generating code. This file contains your architecture rules, so when you ask Cursor to add logic to a component, it has the rules available:
- UI can't contain logic
- Fetching is forbidden
- Violations will be blocked anyway

If Cursor reads this file, it may suggest: "This logic should live in a feature hook. Here's how to structure it." However, even if Cursor doesn't read the file or ignores the rules, violations are still blocked at commit time.

ArchGuard doesn't just catch bad code — it provides rules to AI tools and blocks violations regardless.

## Installation

```bash
npm install -D archguard
```

Or use without installing:

```bash
npx archguard init
```

ArchGuard is designed to be used as a local dev dependency or via npx.

## Setup

**Step 1: Initialize in your project**

Navigate to your React + TypeScript project root and run:

```bash
archguard init
```

This will:
- Detect React + TypeScript setup
- Create `architecture.yaml` with default layers
- Generate `.cursor/AI_RULES.md` for Cursor
- Install a git pre-commit hook (if `.git/hooks` directory exists)

**Step 2: Customize architecture (optional)**

Edit `architecture.yaml` to match your project structure:

```yaml
layers:
  domain:
    allowedImports: []
  features:
    allowedImports: [domain, shared]
  ui:
    allowedImports: [features, shared]
```

**Step 3: Use a preset (optional)**

If you use Feature-Sliced Design:

```bash
archguard init --preset feature-sliced-react
```

**Step 4: Check your project**

```bash
archguard check
```

This scans all `.ts` and `.tsx` files and reports violations. Fix them, then commit.

**Step 5: Integrate with CI (optional)**

Add to your CI pipeline:

```yaml
# .github/workflows/ci.yml
- name: Check architecture
  run: npx archguard check
```

## Usage

**Check project:**

```bash
archguard check
```

**Re-generate Cursor rules after changing architecture.yaml:**

```bash
# Manually update .cursor/AI_RULES.md or re-run init
archguard init  # Will fail if architecture.yaml exists, but you can delete it first
```

## Architecture Presets

- **feature-sliced-react**: Feature-Sliced Design with layers: app → pages → features → entities → shared

## Configuration

Architecture is defined in `architecture.yaml`:

```yaml
layers:
  domain:
    allowedImports: []
  features:
    allowedImports: [domain, shared]
  ui:
    allowedImports: [features, shared]

rules:
  noBusinessLogicInComponents: true
  noDataFetchingInUI: true
  enforceFeatureBoundaries: true
  noCircularLayerDeps: true
```

## What it blocks

### Layer violations

```typescript
// ❌ Blocked: UI importing domain
import { User } from '../domain/user'
```

### Business logic in components

```typescript
// ❌ Blocked: Loop in component
for (let i = 0; i < users.length; i++) {
  process(users[i])
}
```

### Data fetching in UI

```typescript
// ❌ Blocked: Fetch in component
useEffect(() => {
  fetch('/api/user')
}, [])
```

### Circular dependencies

```text
domain → features → domain  // ❌ Blocked
```

## What it does not do

- Decide your state management
- Enforce Clean Architecture dogma
- Refactor code automatically
- Replace code review
- Make architectural decisions for you
- Understand business meaning

It only enforces structural boundaries.

## Mental model

Think of ArchGuard as:
- A compiler for architecture
- A seatbelt for AI
- A gate, not a guide

If code violates the rules, it stops. It doesn't warn, suggest, or maybe pass.

## Real-world impact

**Before ArchGuard:**

```text
Developer: "Add filtering to this component"
Cursor: *dumps loop logic and fetch call directly in component*
Developer: *commits it*
Senior: *finds it in PR, requests changes*
Developer: *refactors*
```

**After ArchGuard:**

```text
Developer: "Add filtering to this component"
Cursor: *dumps loop logic and fetch call directly in component*
Developer: *tries to commit*
Pre-commit hook: *blocks commit with violation errors*
Developer: *fixes violations, commits*
Senior: *approves immediately*
```

**The difference:**
- Violations never land (pre-commit hook blocks them)
- If Cursor reads `.cursor/AI_RULES.md`, it may suggest correct patterns
- Less back-and-forth in code review (violations caught before PR)
- Architecture stays consistent without constant policing

## When to use this

**Use ArchGuard if:**
- You use Cursor, Copilot, or similar AI tools
- You have a layered React architecture
- Architecture drift is a real problem on your team
- You want to prevent specific patterns, not just detect them

**Don't use ArchGuard if:**
- You're not using AI coding tools
- You don't have clear architectural boundaries
- You prefer warnings over hard blocks
- Your project is too small to need structure

## Known limitations

> **Note:** ArchGuard uses heuristic-based detection for some rules:
> - Business-logic and data-fetching detection are heuristic-based
> - Large monorepos may require performance tuning
> - Only relative imports are analyzed (node_modules imports are ignored)

## How it works

ArchGuard uses TypeScript's compiler API to perform deterministic structural analysis of your codebase.

**AST-based analysis:**
- Import boundaries are checked by parsing import declarations from the AST
- Business logic detection analyzes React component function bodies for:
  - Loops (`for`, `for-in`, `for-of` statements)
  - Non-trivial conditional logic (heuristic-based)
- Layer detection maps file paths to architecture layers by matching path segments (e.g., files in `/domain/` belong to the `domain` layer)
- Circular dependencies are detected by building an import graph from AST-extracted imports
- React components are identified by: (1) presence of `import` from `"react"`, and (2) function declarations/expressions with capitalized names or names starting with `"use"`

**Regex-based detection:**
- Data fetching detection uses regex pattern matching on source text to detect `fetch()`, `axios.*()`, and HTTP method calls (`.get()`, `.post()`, etc.) in React components

**Enforcement:**
- Violations block commits via pre-commit hooks and CI
- This turns architectural guidelines into enforceable constraints, not suggestions

The Cursor integration works by generating `.cursor/AI_RULES.md` that Cursor may read as context before generating code. This is just a markdown file with instructions — Cursor may or may not read it, and may or may not follow it. The real enforcement happens at commit time when violations are blocked.

## Project Structure

```text
archguard/
├── packages/
│   ├── core/              # Rule engine
│   ├── cli/               # CLI commands
│   ├── rules-react/       # React rules
│   └── cursor/            # AI rules generator
└── architecture.schema.ts
```

## License

MIT - see [LICENSE](LICENSE) file for details.

## Author

[lindseystead](https://github.com/lindseystead)
