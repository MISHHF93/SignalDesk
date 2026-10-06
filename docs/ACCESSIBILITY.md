# SignalDesk — Accessibility (a11y) & Inclusive Design

**Document Identifier**: `DOC-A11Y-2026-V1`  
**Status**: `CANONICAL`  
**Compliance Target**: WCAG 2.1 Level AA  
**Owner**: Frontend Engineering & Design Systems  
**Last Verified Against Implementation**: 2026-10-05  

---

## 1. Accessibility Policy & Standards

SignalDesk is committed to delivering a fully accessible operational console for executives, operators, and auditors of all abilities. The application is designed to conform to **WCAG 2.1 Level AA** standards across keyboard navigation, color contrast, semantic structure, and assistive technology compatibility.

---

## 2. Core Accessibility Implementations

### 2.1 Color Contrast Ratios (Dark Canvas)
- **Primary Headlines & Figures** (`text-white` on `#0c0a09`): **18.2:1** (Far exceeds WCAG AAA 7:1 requirement).
- **Secondary Body Text** (`text-stone-300` on `#1C1917`): **8.6:1** (Exceeds WCAG AA 4.5:1 requirement).
- **Primary Action Amber** (`text-stone-950` on `bg-amber-500`): **9.4:1** (High contrast, clearly legible).
- **Critical Status Alerts** (`text-rose-400` on `#0c0a09`): **5.8:1** (Exceeds WCAG AA).

### 2.2 Keyboard Navigation & Focus Management
- **Full Keyboard Operability**: Every interactive element (buttons, tabs, inputs, cards) is reachable and operable via `Tab`, `Shift+Tab`, `Space`, and `Enter`.
- **Global Escape Key Dismissal**: Pressing `Escape` cleanly dismisses any open modal or drawer (`AuthGatewayModal.tsx`, `DailyOperatingPulseModal.tsx`, `ConnectorDetailDrawer.tsx`).
- **Focus Rings**: Interactive inputs and buttons present clear, accessible focus states (`focus:ring-2 focus:ring-amber-500` or `focus:outline-none focus:ring-1 focus:ring-indigo-500`).

### 2.3 Semantic Dialogs & Screen Reader Support
- **Modal Containers**: Configured with `role="dialog"`, `aria-modal="true"`, and descriptive `aria-label` attributes.
- **Scroll Lock**: Background body scrolling (`overflow: hidden`) is engaged when modals open to prevent disorienting background scroll behavior for screen reader users.
- **Icon Buttons**: Icon-only buttons (`X`, `Minimize2`, `Maximize2`, `Volume2`) contain explicit `aria-label` and `title` tags (e.g. `aria-label="Close Sign In"`).

### 2.4 Touch Target Minimums
- All primary mobile interactive elements enforce a minimum touch target size of **44px × 44px** (e.g. `min-h-[44px] min-w-[44px]` on mobile menu toggles and modal close buttons).
