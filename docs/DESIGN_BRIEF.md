# SignalDesk — Design Brief & Visual Design System

**Document Identifier**: `DOC-DESIGN-2026-V1`  
**Status**: `CANONICAL`  
**Owner**: Product Design & Frontend Architecture  
**Last Verified Against Implementation**: 2026-10-05  

---

## 1. Brand Personality & Emotional Tone

SignalDesk is designed as an **executive-grade system of record and intelligence**. The design personality reflects:

- **Calm**: Zero frantic animations, zero noisy popups, and quiet healthy states.
- **Premium & Authoritative**: High-contrast typography, refined borders, and precise alignment inspired by Bloomberg Terminal, Linear, and Swiss graphic design.
- **Intelligent**: Content-first density. Answers always present provenance, numbers answer *"Where did this number come from?"*, and ambiguity is surfaced transparently.
- **Trustworthy**: Clear separation of factual truth levels from synthetic speculation; dual-key approval actions explicitly state blast radius and expiration.

### Anti-AI Slop Discipline
- ❌ **No Purple/Neon Gradients**: Avoid decorative AI glow or pseudo-magical rainbow sparkles.
- ❌ **No Floating Chatbot Widgets**: No intrusive bottom-right floating bot avatars.
- ❌ **No Badge & Pill Overload**: Badges are strictly reserved for urgency (`P1 / Critical`), risk level (`High / Medium / Low`), and system connection status.
- ❌ **Zero Technical Clutter in Default Views**: Raw IDs, latency milliseconds, and hashes are hidden behind progressive disclosure drawers.

---

## 2. Color Palette & Visual Hierarchy

SignalDesk operates exclusively in an **Obsidian Executive Dark Theme** (`#0c0a09` root canvas):

| Semantic Role | Token / Utility Class | Hex Value | Usage |
| :--- | :--- | :--- | :--- |
| **Canvas Background** | `bg-[#0c0a09]` | `#0C0A09` | Root viewport canvas and backdrop |
| **Surface Card** | `bg-stone-900/90` | `#1C1917` | Primary card containers, drawers, and palettes |
| **Surface Muted** | `bg-stone-950/70` | `#0C0A09` | Nested sub-panels, input fields, code containers |
| **Primary Border** | `border-stone-800` | `#292524` | Structural dividers and card outlines |
| **Subtle Border** | `border-stone-850/80` | `#201D1B` | Secondary delimiters and subtle separators |
| **Primary Action / Amber** | `bg-amber-500` / `text-amber-400` | `#F59E0B` | Critical attention signals, primary CTA buttons |
| **Action Hover** | `hover:bg-amber-400` | `#FBBF24` | Primary button hover interaction |
| **Verified / Success** | `text-emerald-400` / `bg-emerald-950/80` | `#34D399` | Connected tool health, verified outcomes, SOC-2 |
| **Critical Urgent** | `text-rose-400` / `bg-rose-950/60` | `#F87171` | P1 outages, blocked revenue, SLA violations |
| **Text High Contrast** | `text-white` / `text-stone-100` | `#FFFFFF` | Headlines, primary metrics, card titles |
| **Text Secondary** | `text-stone-300` / `text-stone-400` | `#D6D3D1` | Explanatory copy, summaries, metadata |
| **Text Muted / Mono** | `text-stone-500` | `#78716C` | Timestamps, system provenance tags, labels |

---

## 3. Typography System

SignalDesk employs a structured tri-font typographic hierarchy:

1. **Display & Headings**: `Outfit`, `sans-serif` (Weights: 600, 700, 800)
   - Used for primary hero statements, section headings, and modal headers.
   - Example: *"What came in. What's stuck. Who owns it. What's next."*
2. **Body & UI**: `Plus Jakarta Sans`, `sans-serif` (Weights: 400, 500, 600)
   - Used for card narratives, AI conversation text, table content, and form inputs.
   - Line height tuned to `1.5` for effortless reading of dense operational summaries.
3. **Monospace & Telemetry**: `JetBrains Mono`, `monospace` (Weights: 500, 700)
   - Used for financial figures (`$180,000`), system record keys (`#INV-8821`), timestamps, and API schemas.

---

## 4. Component Design Specifications

### 4.1 Situation Card (Needs Attention)
- **Container**: `p-4 rounded-xl bg-stone-900/60 hover:bg-stone-900/90 border border-stone-800 transition`
- **Header**: Title in `text-sm font-semibold text-white` paired with system badge (e.g. `STRIPE`, `HUBSPOT`).
- **Exposure Pill**: `text-xs font-mono font-bold text-amber-400` (e.g. `$148,500 at risk`).
- **Actions**:
  - Secondary: `px-3 py-1.5 rounded-lg bg-stone-800 text-stone-300 text-xs font-medium` ("Investigate").
  - Primary: `px-3.5 py-1.5 rounded-lg bg-amber-500 text-stone-950 text-xs font-bold` ("Take Care of This").

### 4.2 Action Card (Waiting on Me)
- **Container**: `p-4 rounded-xl bg-stone-900/70 border border-amber-500/30`
- **Risk Badge**: Red for High, Amber for Medium, Emerald for Low.
- **Controls**: Inspect payload button (opens raw JSON modal) + Decline + Approve Action.

### 4.3 Interactive Buttons
- **Touch Targets**: Minimum **44px × 44px** hit area on mobile and touch devices.
- **Active State**: Micro-scale animation (`active:scale-98`) for immediate tactile feedback.

### 4.4 Modals & Drawers
- **Backdrop**: `bg-black/85 backdrop-blur-md animate-in fade-in-50`
- **Dialog Surface**: `bg-stone-950 rounded-2xl border border-stone-800 shadow-2xl overflow-hidden`
- **Dismissibility**: Header close button (`✕`) + keyboard `Escape` key + click-outside backdrop listener.
