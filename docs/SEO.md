# SignalDesk — SEO, Metadata & Discoverability Strategy

**Document Identifier**: `DOC-SEO-2026-V1`  
**Status**: `CANONICAL`  
**Owner**: Growth Engineering & Product Marketing  
**Last Verified Against Implementation**: 2026-10-05  

---

## 1. Positioning & Search Intent

SignalDesk is positioned as an **AI-Orchestrated Business Operating System** for owner-led professional services and digital agencies. 

### 1.1 Target Search Categories
1. **Category Creation**: *"AI Business Operating System"*, *"Executive Command Center SaaS"*, *"System of Intelligence for Professional Services"*.
2. **Problem-Aware Search**: *"How to connect HubSpot and QuickBooks without Zapier errors"*, *"Agency executive visibility across Jira and CRM"*, *"Prevent client churn from blocked engineering tickets"*.
3. **Alternative & Consolidation Search**: *"Single pane of glass for digital agencies"*, *"Unified business operations radar"*.

---

## 2. Public Surface Architecture vs. Private Isolation

SignalDesk strictly segregates discoverable public marketing surfaces from private, authenticated tenant operations:

```
┌────────────────────────────────────────────────────────────────────────┐
│ PUBLIC & INDEXABLE SURFACE (index, follow)                             │
├────────────────────────────────────────────────────────────────────────┤
│ /index.html (https://signaldesk.ai/)                                   │
│ ├── #overview       - North Star, Operating Loop, 5 User Efforts      │
│ ├── #connectors     - 58+ Authoritative Integrations & MCP Support     │
│ ├── #governance     - Dual-Key Trust & Safe Action Gateway             │
│ └── #architecture   - Operating Loop (13 Steps) & Truth Model          │
├────────────────────────────────────────────────────────────────────────┤
│ PRIVATE TENANT CANVAS (noindex, nofollow)                              │
├────────────────────────────────────────────────────────────────────────┤
│ /#workspace         - Live Command Center & Operational Telemetry      │
│ /#audit             - Sovereign Cryptographic Audit Trail              │
│ /api/*              - Backend REST & MCP Endpoints                     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. SEO Implementation & Metadata Assets

### 3.1 Page Title & Meta Description (`index.html`)
- **Title**: `SignalDesk — Unified Business Command Center` (46 characters)
- **Description**: `AI-orchestrated business operating system delivering one unified command center across email, CRM, billing, projects, calendar, and support.` (144 characters)
- **Robots Directive**: `<meta name="robots" content="index, follow" />`
- **Canonical URL**: `<link rel="canonical" href="https://signaldesk.ai/" />`

### 3.2 Open Graph & Social Cards
- `og:type`: `website`
- `og:site_name`: `SignalDesk`
- `og:title`: `SignalDesk — Unified Business Command Center`
- `og:description`: `AI-orchestrated business operating system delivering one unified command center across email, CRM, billing, projects, calendar, and support.`
- `twitter:card`: `summary_large_image`

### 3.3 Schema.org Structured Data (JSON-LD)
Configured in `index.html`:
```json
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "SignalDesk",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "All",
  "description": "AI-orchestrated business operating system delivering one unified command center across email, CRM, billing, projects, calendar, and support.",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  }
}
```

### 3.4 Crawling Directives (`public/robots.txt`)
```txt
User-agent: *
Allow: /
Disallow: /api/
Disallow: /#workspace
Disallow: /#audit

Sitemap: https://signaldesk.ai/sitemap.xml
```

---

## 4. Anti-Fabrication & Truth in Marketing

SignalDesk strictly forbids fabricated testimonials, fake customer logos, inflated funding announcements, or artificial star ratings. All public claims reflect verified technical capabilities:
- ✅ Certified 58+ SaaS catalog integrations.
- ✅ Client-side Google Workspace OAuth PKCE authentication.
- ✅ Dual-key approval gating and verified outcome ledger.
- ❌ No fake review quotes or synthetic logos.
