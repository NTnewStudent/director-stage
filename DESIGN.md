# Design System — hjw AIGC Comic Tool

## 1. Visual Theme & Atmosphere

The visual language is charcoal + emerald for an AIGC creation tool. The base is a deep charcoal canvas (`#141414`); content emerges from the dark. Emerald (`#00C853`) is the only brand accent, signaling in-progress, complete, and interactive states. This is not Linear’s indigo/violet system. It is closer to professional tools (DaVinci Resolve, Figma dark mode): extremely restrained color, dense information hierarchy, and levels distinguished by luminance rather than hue.

The top bar has a slight blue-black tint (`#101014`), a subtle contrast from the main canvas (`#141414`). The left nav rail (`#191919`), list panel (`#252525`), and right settings panel (`#252525`) form three layers of spatial depth. Inputs use the darkest `#121212` so they read as recessed.

Brand green `#00C853` is the only chromatic color in the system: active, complete, primary CTAs, progress. Warning orange `#FF9C26` is for attention that is not brand.

**Core traits:**
- Charcoal canvas: `#141414` (main canvas), `#101014` (top bar), `#191919` (nav rail)
- Panels: `#252525` (side panels), `#333333` (active card), `#121212` (inputs)
- Brand emerald: `#00C853` (primary accent) / `#07AF49` (CTA) / `#05B84C` (active step)
- Dividers: `#2C2C2C` (primary) / `#080808` (deep) / `#3A3A3A` (secondary)
- Text: `#E9E9E9` (primary) / `#9B9B9B` (secondary) / `#737373` (muted)
- Button fill: `#4A4A4A` (ordinary actions)
- Type: Inter for Latin; PingFang SC, Hiragino Sans, and Microsoft YaHei for CJK

---

## 2. Color Palette & Roles

### Background Surfaces
- **Main Canvas** (`#141414`): Deepest workspace ground.
- **Top Bar** (`#101014`): Top navigation, slight blue-black tint vs canvas.
- **Nav Rail** (`#191919`): Left icon rail.
- **Panel** (`#252525`): Side list and right settings.
- **Card Active** (`#333333`): Selected / active card fill.
- **Card Default** (`#252525`): Default card fill (same as Panel; border distinguishes).
- **Input Field** (`#121212`): Inputs and textareas; darkest, recessed.
- **Action Button** (`#4A4A4A`): Ordinary action buttons (upload, download).
- **View Strip** (`#222222`): View-switch strip.
- **Overlay Bar** (`#202020`): Bottom floating action bar.

### Brand & Accent
- **Brand Green** (`#00C853`): Active, complete, progress, icon highlight.
- **CTA Green** (`#07AF49`): Primary action buttons.
- **Step Active Green** (`#05B84C`): Active step indicator.
- **Brand Subtle BG** (`#12351D`): Very faint brand green for active nav items.
- **Success Subtle BG** (`#1D4A2B`): Success badge fill.
- **Success Subtle Border** (`#1F8C45`): Success badge stroke.

### Text & Content
- **Primary Text** (`#E9E9E9`): Near-white, not harsh.
- **Secondary Text** (`#9B9B9B`): Descriptions and metadata.
- **Muted Text** (`#737373`): Counts, disabled.
- **White** (`#FFFFFF`): Button labels on CTAs only.

### Status Colors
- **Warning Orange** (`#FF9C26`): Warnings and attention steps.
- **Warning Text** (`#FFAD39`): Warning copy (balances, etc.).
- **Error Red** (`#E22134`): Error.

### Border & Divider
- **Border Primary** (`#2C2C2C`): Primary dividers (top-bar bottom edge).
- **Border Secondary** (`#3A3A3A`): Secondary dividers, step connectors.
- **Border Deep** (`#080808`): Deep panel separators.
- **Border Subtle** (`rgba(255,255,255,0.05)`): Hairline translucent.
- **Border Standard** (`rgba(255,255,255,0.08)`): Standard translucent.
- **Card Active Border** (`#00C853`): Selected card, 2px.
- **Card Default Border** (none / `#333333`): Default cards have no strong stroke.

### Overlay
- **Overlay Scrim** (`rgba(0,0,0,0.85)`): Modal dim.

---

## 3. Typography Rules

### Font Family
- **Primary**: `Inter`, `Hiragino Sans`, `PingFang SC`, `Noto Sans JP`, `Microsoft YaHei`, `Arial`, `sans-serif`
  - Latin: Inter
  - CJK: Hiragino Sans / Noto Sans JP (Japanese), PingFang SC (macOS), Microsoft YaHei (Windows)
- **Monospace**: `Berkeley Mono`, `ui-monospace`, `SF Mono`, `Menlo`

### Hierarchy

| Role | Size | Weight | Line Height | Letter Spacing | Color | Notes |
|------|------|--------|-------------|----------------|-------|-------|
| Page Title | 24px | 700 | 1.2 | normal | `#E9E9E9` | Page / module titles |
| Section Title | 18px | 700 | 1.3 | normal | `#E9E9E9` | Section and settings titles |
| Card Title | 17px | 600 | 1.3 | normal | `#E9E9E9` | Card titles |
| Body Large | 18px | 600 | 1.5 | normal | `#E9E9E9` | Nav labels, step text |
| Body | 16px | 600 | 1.5 | normal | `#E9E9E9` | Button labels, form labels |
| Body Regular | 16px | 500 | 1.5 | normal | `#E9E9E9` | Body copy |
| Small | 15px | 600 | 1.5 | normal | `#E9E9E9` | View-switch labels |
| Caption | 14px | 400–500 | 1.5 | normal | `#9B9B9B` | Descriptions, metadata |
| Label | 13px | 500 | 1.4 | normal | `#E9E9E9` | Small labels |
| Micro | 12px | 500 | 1.4 | normal | `#737373` | Counts, smallest type |

> Minimum size is **12px**. 10px / 11px are forbidden.

### Principles
- **CJK + Latin**: CJK UI uses PingFang SC / Hiragino Sans / Microsoft YaHei; Latin uses Inter
- **700 / 600 split**: titles 700, emphasis 600, body 400–500
- **No negative tracking on CJK**; Latin titles may tighten slightly

---

## 4. Component Stylings

### Buttons

**Primary CTA Button**
- Background: `#07AF49`
- Text: `#FFFFFF`, 17px weight 600
- Padding: 8px 20px
- Radius: 7px
- Use: Next, Generate, Save, and other primary actions

**Secondary Button**
- Background: `#4A4A4A`
- Text: `#E9E9E9`, 16px weight 600
- Padding: 8px 16px
- Radius: 7px
- Use: Upload, Download, batch generate, and other secondary actions

**Back Button**
- Background: `#4A4A4A`
- Text: `#FFFFFF`, 16px weight 600
- Padding: 8px 16px
- Radius: 7px
- Icon: left arrow

**Pill Action Button**
- Background: `#4A4A4A`
- Text: `#E9E9E9`, 16–17px weight 600
- Padding: 0 16px
- Radius: 9999px (pill)
- Use: actions inside the bottom bar

**Nav Active Item**
- Background: `#12351D`
- Text: `#00C853`, 15px weight 600
- Radius: 7px
- Use: active left-nav item

### Cards & Containers

**Role Card**
- Background: `#252525` (default) / `#333333` (selected)
- Border: none (default) / `2px solid #00C853` (selected)
- Radius: 4px
- Thumbnail: 94×95–98px, fixed left
- Content: text on the right

**Settings Panel**
- Background: `#252525`
- Width: 378px (fixed right)
- Border-left: `1px solid #050505`

**Input Field**
- Background: `#121212`
- Text: `#E9E9E9`, 18px weight 600
- Muted text: `#737373` (counts)
- Padding: 12px
- Radius: 7px
- No border (depth does the work)

**Field Label**
- Left accent bar: `4px wide, #00C853, radius 2px`
- Text: 18px weight 600, `#E9E9E9`

### Status Badges

**Completed Badge**
- Background: `#1D4A2B`
- Border: `1px solid #1F8C45`
- Icon: green circular checkmark
- Text: `#9B9B9B`, 14px weight 500
- Radius: 9999px (pill)

**Warning Indicator**
- Icon: orange circle `!`, `#FF9C26`
- Use: when a step needs attention

### Step Indicator

**Active Step**
- Circle: `#05B84C` fill
- Number: `#FFFFFF`, 14px bold
- Text: `#00C853`, 16px weight 600
- Background pill: `#072B16` (faint green)

**Inactive Step**
- Circle: `#333333` fill
- Number: `#D7D7D7`, 14px bold
- Text: `#E9E9E9`, 16px weight 600

**Connector Line**
- `1px solid #3A3A3A`

### Navigation (top bar)

- Background: `#101014`
- Height: 67px
- Bottom border: `1px solid #2C2C2C`
- Logo area: 38×38px, `#4A4A4A` bg, radius 8px
- Step indicators: centered
- Right actions: credit balance + avatar

### Left Rail

- Background: `#191919`
- Width: 86px
- Right border: `1px solid #080808`
- Active item: `#12351D` bg, `#00C853` icon/text
- Inactive item: `#D9D9D9` icon, `#E9E9E9` text

### View Strip

- Background: `#222222`
- Width: 92px
- Radius: 8px
- Active view: `#EFEFEF` bg, `3px solid #00C853` border
- Inactive view: `#3B3B3B` bg

### Bottom Action Bar

- Background: `#202020`
- Border: `1px solid #3B3B3B`
- Radius: 24.5px (pill container)
- Inner buttons: `#4A4A4A` bg, pill radius

---

## 5. Layout Principles

### Spacing System
- Base unit: 8px
- Scale: 4px, 8px, 12px, 16px, 20px, 24px, 32px, 48px
- Panel padding: 12–16px
- Card gap: 8px

### Grid & Container
- Top bar: full width, fixed 67px
- Left nav rail: 86px fixed
- List panel: 384px fixed
- Main canvas: flex-1
- Right settings: 378px fixed
- View strip: 92px fixed, floating on the right of the canvas

### Depth Model

| Level | Background | Use |
|-------|-----------|-----|
| Deepest | `#080808` / `#101014` | Dividers, top bar |
| Canvas | `#141414` | Main workspace |
| Rail | `#191919` | Left nav rail |
| Panel | `#252525` | Side panels, default cards |
| Elevated | `#333333` | Active cards, hover |
| Input | `#121212` | Recessed inputs |
| Action | `#4A4A4A` | Action buttons |

---

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| Flat | No shadow | Panels, default cards |
| Subtle | `rgba(0,0,0,0.3) 0px 8px 8px` | Card hover |
| Medium | `rgba(0,0,0,0.4) 0px 2px 4px` | Floating UI |
| Heavy | `0 8px 24px rgba(0,0,0,0.5)` | Modals, command palette |
| Inset | `rgba(0,0,0,0.2) 0px 0px 12px 0px inset` | Recessed panels |

On charcoal, hierarchy comes from luminance steps more than drop shadows. Selection uses a `2px solid #00C853` border instead of a glow.

---

## 7. Do's and Don'ts

### Do
- Use `#141414` as the main canvas
- Use `#00C853` as the only brand accent, only for active / complete / CTA
- Use `#E9E9E9` as primary text; reserve `#FFFFFF` for CTA labels
- Use luminance steps for depth: `#101014` → `#141414` → `#191919` → `#252525` → `#333333`
- Mark selection with `2px solid #00C853`
- Pair field labels with a `4px` green left bar + text
- Prefer CJK system fonts: PingFang SC / Hiragino Sans / Microsoft YaHei

### Don't
- Do not use Linear indigo/violet (`#5e6ad2`, `#7170ff`)
- Do not use `#FFFFFF` as primary text (CTA labels only)
- Do not hardcode hex in components; use CSS tokens
- Do not use 10px / 11px; minimum 12px
- Do not go above weight 700 (max 700, workhorse 600)
- Do not add warm decorative colors; brand color is emerald only

---

## 8. Responsive Behavior

### Breakpoints
| Name | Width | Key Changes |
|------|-------|-------------|
| Mobile | < 768px | Single column, hide side panels |
| Tablet | 768–1024px | Two columns, collapse left nav |
| Desktop | 1024–1280px | Standard three-pane |
| Large Desktop | > 1280px | Full four-pane |

### Collapsing Strategy
- Left rail: icon + label on desktop; bottom tab bar on mobile
- List panel: fixed on desktop, collapsible on tablet, full-screen overlay on mobile
- Right settings: fixed on desktop, bottom sheet on mobile

---

## 9. Agent Prompt Guide

### Quick Color Reference
- Main canvas: `#141414`
- Top bar: `#101014`
- Nav rail: `#191919`
- Panel / card: `#252525`
- Active card: `#333333`
- Input: `#121212`
- Action button: `#4A4A4A`
- Brand green (accent): `#00C853`
- CTA green (button): `#07AF49`
- Primary text: `#E9E9E9`
- Secondary text: `#9B9B9B`
- Muted text: `#737373`
- Primary divider: `#2C2C2C`
- Warning orange: `#FF9C26`

### Example Component Prompts
- "Create a character card: `#252525` fill, 94px thumbnail on the left, title 17px weight 600 `#E9E9E9`, description 14px `#9B9B9B`, completed badge at the bottom (`#1D4A2B` bg + `#1F8C45` border + green checkmark). Selected: `#333333` fill + `2px solid #00C853`."
- "Create a settings panel: `#252525` fill, field labels with a `4px #00C853` left bar + 18px weight 600 text. Inputs `#121212`, 12px padding, 7px radius."
- "Create a top bar: `#101014` fill, 67px tall, bottom `1px solid #2C2C2C`. Centered step indicators; active step uses `#05B84C` circle + `#00C853` text + `#072B16` pill."
- "Create a primary CTA: `#07AF49` fill, `#FFFFFF` text, 17px weight 600, 8px 20px padding, 7px radius."
- "Create a bottom floating action bar: `#202020` fill + `1px solid #3B3B3B`, pill container (radius 24.5px). Inner actions `#4A4A4A`, pill radius, 16–17px weight 600 `#E9E9E9`."

---

## 10. Studio Mono — canvas-aligned workspace language (REQ-089, 2026-06-12)

> Every workspace page except login shares the workflow canvas visual language. Source: `workflow-canvas` `wf-*` patterns, promoted to `studio-*` component classes in `pc-client/src/styles/index.css`. Colors go through design tokens (no hardcoded hex).

### New tokens (`design-tokens.css`)

| Token | Value | Use |
|------|-----|------|
| `--radius-2xl` | 16px | Large card radius (Tailwind `rounded-2xl`) |
| `--radius-3xl` | 24px | Hero / overlay radius (Tailwind `rounded-3xl`) |
| `--shadow-float` | light `0 10px 35px rgba(17,24,39,.06)` / dark `0 10px 35px rgba(0,0,0,.45)` | Soft card/toolbar float (Tailwind `shadow-float`) |
| `--shadow-pop` | light `0 18px 50px rgba(17,24,39,.14)` / dark `0 18px 50px rgba(0,0,0,.55)` | Overlay/menu shadow (Tailwind `shadow-pop`) |

### Global component classes (`index.css`)

| Class | Meaning |
|------|------|
| `.studio-mono` | Remap brand green / success to ink inside the region (WorkspaceLayout root; canvas pages keep `.wf-mono`) |
| `.studio-btn-ink` | Ink primary button: dark ink fill + inverted text + `active:scale`; inverts with theme |
| `.studio-btn-soft` | Translucent secondary (text-base 8% → hover 15%) |
| `.studio-card` | White card (dark: panel) + `border-secondary` + 16px radius + float shadow |
| `.studio-card-lift` | Hover lift: translateY(-2px) + pop shadow + ink stroke |
| `.studio-dots` | Canvas dot-grid background (hero / cover placeholders) |

### Usage
- Primary CTA is always `.studio-btn-ink` + `rounded-full`. Do not use green-fill CTAs here (green stays semantic success / tiny accents).
- Cards use `.studio-card` (optional `.studio-card-lift`); overlays use `rounded-2xl border-border-secondary bg-bg-card shadow-pop`.
- Type: kicker `text-[11px] font-bold uppercase tracking-wider text-text-muted`, page title `text-[22~28px] font-bold tracking-tight`, body `text-[13px]`.
- Badges/status are capsules: `rounded-full text-[11px] font-bold`.
