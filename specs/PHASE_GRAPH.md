# Zidney Phase Graph (High-Level)

This diagram shows phase-level execution order and dependency flow.

```mermaid
flowchart TD

    P1["PHASE 1<br/>Platform Foundation"]
    P2["PHASE 2<br/>Platform MMC"]
    P3["PHASE 3<br/>Backoffice Core"]
    P4["PHASE 4<br/>Runtime Engine"]
    P5["PHASE 5<br/>Frontoffice Runtime"]

    P1 --> P2
    P1 --> P3
    P3 --> P4
    P4 --> P5

    P2 --> P3
```

---

## How to View

1. Install VSCode extension: **Markdown Preview Mermaid Support**
2. Open `PHASE_GRAPH.md`
3. Press: Cmd + Shift + V

---

### What This Represents

- Phase 1 is the foundation of everything.
- Phase 2 (MMC) depends only on core foundation.
- Phase 3 (Backoffice) depends on foundation + MMC.
- Phase 4 (Runtime) depends on Backoffice core structures.
- Phase 5 (Frontoffice) depends on Runtime stability.

---

If you want, next we can generate:

- A strict “Production Hardening Order” graph
- Or a “Revenue-First Delivery Path” graph
