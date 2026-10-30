---
name: Precision POS & Billing
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#3d4a42'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#6d7a72'
  outline-variant: '#bccac0'
  surface-tint: '#006c4a'
  primary: '#006948'
  on-primary: '#ffffff'
  primary-container: '#00855d'
  on-primary-container: '#f5fff7'
  inverse-primary: '#68dba9'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#006947'
  on-tertiary: '#ffffff'
  tertiary-container: '#00855b'
  on-tertiary-container: '#f5fff6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#85f8c4'
  primary-fixed-dim: '#68dba9'
  on-primary-fixed: '#002114'
  on-primary-fixed-variant: '#005137'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-currency:
    fontFamily: Hanken Grotesk
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  display-currency-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: 0em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.005em
  headline-sm:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-data:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0em
  label-caps:
    fontFamily: Hanken Grotesk
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.06em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
  space-2xl: 2rem
---

## Brand & Style

This design system is engineered for high-throughput retail, hospitality, and billing environments where transaction velocity, optical clarity, and zero-error ergonomics are critical. The visual tone is utilitarian, crisp, and hyper-legible, combining Scandinavian functional minimalism with industrial software precision. 

The aesthetic eliminates skeuomorphic weight, visual noise, and decorative flourishes in favor of structural clarity, high-contrast text contrast ratios, and deliberate spatial grouping. Surfaces feel lightweight, clean, and tactile under fingertip operation. The emotional response evokes confidence, speed, transparency, and reliable execution.

## Colors

The color architecture is built around functional utility:

- **Primary Canvas & Surfaces**: Pure white (`#ffffff`) serves as the base transaction and data-entry canvas. Structural backdrops, split panels, and counter shells use subtle cool tints (`#f8fafc` and `#f1f5f9`) to define visual architecture without adding optical density.
- **Typography & Structural Contrast**: Text hierarchy starts at deep slate black (`#0f172a`) for line totals, primary amounts, and critical labels. Secondary content and line item descriptions leverage `#1e293b` and `#334155`. Tertiary metadata, SKUs, and timestamps use `#64748b`.
- **Action & Validation Accent**: Emerald green (`#059669` as base, `#10b981` as interactive hover/active tint) is reserved strictly for primary execution: checkout actions, successful payment states, valid barcode captures, and final transaction completions.
- **Borders & Separators**: Precise hairline boundaries utilize `#e2e8f0` for component divisions and `#cbd5e1` for active or focused structural sections.
- **System States**: Warning actions leverage amber (`#d97706`), while voiding, item removal, or payment failure indicators employ high-visibility crimson (`#dc2626`).

## Typography

The type scale prioritizes scan speed under shifting lighting conditions and varying viewing distances (such as mounted tablet stands and desktop counter registers).

- **Hanken Grotesk** handles all primary interface headlines, line descriptions, and interaction labels. Its balanced geometric proportions ensure quick glyph recognition and reliable readability during fast-paced item entry.
- **JetBrains Mono** is introduced selectively for numeric data, SKUs, barcode readouts, receipt tables, and line quantities. This guarantees vertical tabular alignment, preventing decimal drift across billing ledgers.
- Numerical displays for checkout totals (`display-currency`) are weighted at bold 700 with tightened tracking for immediate, unmistakable legibility.

## Layout & Spacing

The layout is constructed as a structured multi-pane workspace optimized for concurrent scanning, editing, and payment verification:

- **Desktop & Countertop Terminals (1024px+)**: A split view featuring a persistent left catalog or keypad module (60% width) and a right transaction ledger with payment summary (40% width). Layouts adhere to a rigid 12-column grid utilizing `gutter-desktop` (24px) and `margin-desktop` (24px).
- **Tablet Terminals (768px - 1023px)**: Responsive split panel with collapsible catalog drawers or 50/50 balance. Gutters and outer margins scale to `1rem` (16px).
- **Handheld / Mobile POS (< 768px)**: A single-column stacked view where the cart summary floats persistently at the bottom with a sliding sheet for full receipt inspection.
- **Touch Target Rules**: All interactive elements (keypad numbers, line item modifiers, quick-add buttons) maintain a minimum touch bounding box of 48×48px, padded using `space-md` to `space-lg` to eliminate accidental cross-taps.

## Elevation & Depth

This system intentionally departs from heavy drop shadows to preserve a lean, paper-like interface suitable for both indoor registers and outdoor kiosk hardware.

- **Low-Contrast Outlines**: Hierarchy is established via 1px crisp borders (`#e2e8f0`) rather than shadow blurs. Structural borders define catalog cards, line-item dividers, and keypad buttons.
- **Tonal Layering**: Depth is created through surface contrast: the application canvas uses `#f8fafc`, container panels use `#ffffff`, and active or focused input fields use a `#ffffff` core framed by `#059669` or `#cbd5e1`.
- **Functional Overlays**: Modals, tender selection drawers, and keypad overlays rely on a clean, restrained ambient shadow: `0 8px 24px -4px rgba(15, 23, 42, 0.08)` coupled with an ultra-thin perimeter line (`1px solid #cbd5e1`). Modals use a translucent `#0f172a` backdrop at 25% opacity with no blur filter to maintain processing speed on lower-spec hardware.

## Shapes

The interface employs a disciplined, soft corner treatment (`roundedness: 1`). 

- Standard interactive elements—including primary buttons, inputs, numeric keypad triggers, and badge tags—use `0.25rem` (4px) corner radii.
- Surface cards, bill containers, and tender selection tiles use `rounded-lg` (`0.5rem` / 8px).
- Large sliding drawers and transactional confirmation modals use `rounded-xl` (`0.75rem` / 12px).
- This restrained curvature avoids playful bubble-like aesthetics, maintaining the feel of a professional, enterprise-grade accounting apparatus.

## Components

### Buttons
- **Primary / Tender Complete**: Background `#059669`, text `#ffffff`, font-weight 600. Active press shifts to `#047857`. Minimum height 48px, scaling to 56px for the primary "Charge / Checkout" button.
- **Secondary / Action**: Pure white background `#ffffff` with a 1px border in `#cbd5e1`, text `#0f172a`. Hover transitions border to `#0f172a`.
- **Destructive / Void**: Background `#ffffff`, border 1px `#fca5a5`, text `#dc2626`. Pressed state shifts background to `#fef2f2`.

### Numeric Keypad & Quick Tiles
- High-contrast touch grids for manual SKU or value entry.
- Surface `#ffffff`, border 1px `#e2e8f0`, active touch state turns background to `#f1f5f9`.
- Keypad numerals rendered in `headline-md` using `JetBrains Mono` for rapid visual scanning.

### Input Fields & Search Bars
- Background `#ffffff`, border 1px `#cbd5e1`, internal padding `space-md` (12px 16px).
- Placeholder text in `#64748b`. Focused state applies an emerald ring (`border-color: #059669; box-shadow: 0 0 0 1px #059669`).
- Search inputs for product lookups include an integrated barcode scanner trigger icon on the right edge.

### Line-Item Ledger (Cart / Bill List)
- Tabular list layout with 1px border dividers in `#f1f5f9`.
- Column alignments: Item name & SKU left-aligned (`Hanken Grotesk`), quantity stepper center-aligned, price and extension right-aligned (`JetBrains Mono`).
- Swipe or tap-to-reveal controls for rapid discounts, quantity adjustments, or deletion.

### Checkboxes & Segmented Controls
- Checkboxes: 20×20px square with a 4px corner radius. Unchecked state uses a 1.5px border `#cbd5e1`; checked state fills with `#059669` and a sharp white checkmark.
- Segmented switches (e.g., Dining Options: "Dine In" / "Takeaway" / "Delivery"): Contained within a `#f1f5f9` frame; selected pill uses `#ffffff` with an `#e2e8f0` border and `#0f172a` text.

### Cards & Catalog Items
- Product cards feature clean product images or high-contrast color tags, item titles in `body-md` (600 weight), and pricing in `label-data` (`#0f172a`).
- Border 1px `#e2e8f0`, background `#ffffff`. No elevation shadow in default state; subtle border darkening to `#cbd5e1` on hover/press.

### Receipt & Totals Summary Panel
- Anchored summary dock showing Subtotal, Tax/VAT, and Discounts.
- The "Balance Due" block is presented with elevated prominence: deep slate text (`#0f172a`) or an optional soft tint background (`#f8fafc`) with bolded `display-currency` typography.