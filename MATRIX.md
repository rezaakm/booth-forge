# BoothForge — Architect's Flagship

> This repo is the primary tool of **The Architect** in The Matrix operating system.

## Role in The Matrix

BoothForge is the Architect's flagship product — an Exhibition Booth to 3D Model generator. When Neo dispatches a request to Architect for booth design, event activation layouts, or exhibition visualization, Architect routes to BoothForge.

## How it's called

From within `matrix-core/`, the Architect character invokes BoothForge:
- Via API (when BoothForge has a running instance)
- Via direct code invocation (when running locally)

## Relationship to matrix-core

- BoothForge is a **standalone repo** (not a folder inside matrix-core)
- It has its own stack: Next.js, TypeScript, Three.js
- Architect's SKILL.md in matrix-core points here as the primary tool
- SketchUp MCP and Twinmotion are secondary/refinement tools

## Status

Phase 3 of The Matrix build plan will wire BoothForge into the Architect character fully.

---

*Part of The Matrix — AI-Powered Operating System for The Agency Oman*
