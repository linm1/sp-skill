This is a comprehensive Design System & Style Guide based on the UI to adapt. This document serves as the "source of truth" for developers and designers to maintain consistency.

---

# Project Style Guide

## 1. Overview
The design language is **"Utilitarian Neo-Brutalist."** It combines the technical aesthetic of developer tools (monospaced fonts, terminal windows) with a friendly, approachable palette. Key characteristics include:
*   High contrast thin borders (1px solid black).
*   Sharp edges (0px border-radius on containers).
*   Hard drop shadows (offset without blur).
*   A mix of technical monospaced headers and clean sans-serif body text.

---

## 2. Color Palette

The palette is minimal, relying heavily on a warm off-white background and harsh dark grey foregrounds.

### Primary Colors
| Name | Hex | RGB | Usage |
| :--- | :--- | :--- | :--- |
| **Paper Canvas** | `#F4EFEA` | `244, 239, 234` | Main page background (Body) |
| **Ink Black** | `#383838` | `56, 56, 56` | Primary text, Borders, Active states |
| **Pure White** | `#FFFFFF` | `255, 255, 255` | Card backgrounds, Terminal backgrounds |

### Accent Colors
| Name | Hex | Usage |
| :--- | :--- | :--- |
| **Duck Yellow** | `#FFD700` | Logo accents, illustrations, highlights |
| **Hyperlink Blue**| `#007AFF` | Links, terminal prompts, primary action focus |
| **Terminal Red** | `#FF5F56` | Window controls, error states |
| **Terminal Green**| `#27C93F` | Window controls, success states |

---

## 3. Typography

The project uses a distinct pairing of a technical Monospace font for structure/headers and a geometric Sans-Serif for readable content.

### Primary Font (Headers & UI)
*   **Font Family:** `"Aeonik Mono"`, `ui-monospace`, `Menlo`, `Consolas`, `monospace`
*   **Usage:** Navigation, Hero Headers, Code snippets, Section Titles.

### Secondary Font (Content)
*   **Font Family:** `"Inter"`, `sans-serif`
*   **Usage:** Card body text, long-form paragraphs.

### Type Scale & Definitions

| Role | Font Family | Size | Line Height | Weight | Letter Spacing | Text Transform |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Hero Display** | Mono | `72px` | `86.4px` (1.2) | Regular (400) | `1.44px` | Uppercase |
| **Section Title**| Mono | `24px` | `1.2` | Regular (400) | `1.0px` | Uppercase |
| **Nav Link** | Mono | `14px` | `19.2px` | Medium (500) | `0.32px` | Uppercase |
| **Card Body** | **Inter** | `20px` | `28px` (1.4)| Light (300) | `0.4px` | None |
| **Code** | Mono | `14px` | `1.5` | Regular (400) | `0px` | None |

---

## 4. Spacing System

The layout is spacious, using generous padding to create a "clean" feel.

### Container
*   **Max Width:** `1200px`
*   **Gutter:** `24px` (Padding on sides of container)

### Vertical Rhythm
*   **Section Padding:** `80px` to `100px`
*   **Element Margin (Small):** `16px`
*   **Element Margin (Medium):** `24px`
*   **Element Margin (Large):** `40px` - `60px`

### Component Spacing
*   **Card Padding:** `32px` (Critical for the specific airy look of the cards)
*   **Button Padding:** `10px` vertical, `20px` horizontal

---

## 5. Component Styles

### Buttons & Interactive Elements
The "Brutalist" interactive state is defined by a hard offset shadow movement.

*   **Default State:**
    *   Border: `1px solid #383838`
    *   Background: `#FFFFFF`
    *   Radius: `0px`
*   **Hover State:**
    *   Transform: `translate(-2px, -2px)`
    *   Box Shadow: `2px 2px 0px #383838` (Solid, no blur)

### Cards
*   **Border:** `1px solid #000000`
*   **Background:** `#FFFFFF`
*   **Shadow:** None by default (or subtle `rgba(0,0,0,0.05)` offset).
*   **Hover Effect:** Lift up `4px`, Shadow `4px 4px 0px rgba(0,0,0,0.1)`.

### Navigation
*   **Height:** `70px`
*   **Border:** Bottom border `1px solid #383838`
*   **Position:** `sticky`, `top: 0`, `z-index: 1000`

### Terminal Window
*   **Shadow:** `6px 6px 0px rgba(0,0,0,0.1)` (Deeper offset than cards)
*   **Header:** Simple border-bottom separator with circular dots (`12px` diameter).

---

## 6. Animations & Transitions

Animations are fast and snappy, not floaty.

*   **Global Transition Duration:** `0.2s`
*   **Timing Function:** `ease` (standard) or `cubic-bezier(0.4, 0, 0.2, 1)`
*   **Properties Animated:** `transform`, `box-shadow`, `border-color`.

**Cursor Blink Animation:**
```css
@keyframes blink {
  50% { opacity: 0; }
}
/* Duration: 1s infinite */
```

---

## 7. Border Radius

*   **Default Radius:** `0px` (Sharp corners).
    *   *Applies to:* Buttons, Cards, Inputs, Images, Containers.
*   **Circle Radius:** `50%`
    *   *Applies to:* Logo background, Terminal dots, User avatars.

---

## 8. Opacity & Transparency

*   **Solid Colors:** Preferred over transparency.
*   **Shadows:** `opacity: 0.1` (10%) black for card hover states.
*   **Subtle Backgrounds:** Pure colors are used instead of alpha channels for main backgrounds.

---

## 9. Tailwind CSS v4 Configuration

**This project uses Tailwind CSS v4 with CSS-based configuration.** All custom tokens are defined in the `index.css` file using the `@theme` directive, not in a JavaScript configuration file.

See the `index.css` `@theme` block for all custom colors, shadows, fonts, and other design tokens. The tokens defined there automatically generate Tailwind utility classes (e.g., `text-ink`, `bg-canvas`, `shadow-brutal`).

### Common Tailwind Class Strings
*   **Hero Header:** `font-mono text-ink text-mega uppercase tracking-wide-head font-normal`
*   **Primary Button:** `bg-ink text-white font-mono uppercase font-semibold border border-ink px-6 py-3 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal transition-all duration-200`
*   **Card Container:** `bg-white border border-black p-0 hover:-translate-y-1 hover:shadow-brutal-lg transition-transform duration-200`
*   **Card Text:** `font-sans font-light text-card tracking-[0.4px] text-ink p-8`

---

## 10. Responsive Design & Mobile Patterns

The design system adapts to mobile devices while maintaining the Neo-Brutalist aesthetic. All mobile patterns preserve sharp edges, hard shadows, and the monospace/sans-serif typography hierarchy.

### Breakpoints

The project uses Tailwind's default breakpoint system:

| Breakpoint | Min Width | Usage |
| :--- | :--- | :--- |
| `sm:` | 640px | Small tablets, large phones (landscape) |
| `md:` | 768px | Tablets, small laptops |
| `lg:` | 1024px | Desktops |
| `xl:` | 1280px | Large desktops |

**Philosophy**: Mobile-first approach. Base styles target mobile, then enhance for larger screens using `md:` and `lg:` prefixes.

### Responsive Spacing Scale

Consistent spacing patterns across breakpoints:

| Element | Mobile | Desktop (md:) |
| :--- | :--- | :--- |
| **Container Padding** | `px-3` / `px-4` (12px-16px) | `px-6` (24px) |
| **Section Padding** | `py-4` (16px) | `py-8` (32px) |
| **Card Padding** | `p-4` (16px) | `p-8` (32px) |
| **Button Padding** | `px-2 py-1.5` (8px/6px) | `px-4 py-2` (16px/8px) |
| **Element Spacing** | `space-x-2` (8px) | `space-x-4` / `space-x-6` (16px/24px) |

### Responsive Typography Scale

| Element | Mobile | Desktop (md:) |
| :--- | :--- | :--- |
| **Page Title** | `text-lg` (18px) | `text-2xl` (24px) |
| **Section Title** | `text-base` (16px) | `text-lg` (18px) |
| **Body Text** | `text-sm` (14px) | `text-base` (16px) |
| **UI Labels** | `text-xs` (12px) | `text-sm` (14px) |
| **Fine Print** | `text-[10px]` (10px) | `text-xs` (12px) |

### Mobile Navigation Patterns

#### Icon-First Layout

On mobile, navigation items show icons only. On desktop, icon + text.

```tsx
// Pattern: Icon visible on all screens, text hidden on mobile
<button className="flex items-center">
  <i className="fas fa-icon sm:mr-2"></i>
  <span className="hidden sm:inline">Button Text</span>
</button>
```

**Key principles:**
- Icons come FIRST in markup (consistent visual order)
- Use `sm:mr-2` to add margin between icon and text on desktop
- Use `hidden sm:inline` to hide text on mobile
- Always include `flex items-center` on button for proper alignment

#### Navigation Bar Responsive Pattern

```tsx
<nav className="px-3 md:px-6 py-3 md:py-4" style={{ minHeight: '60px' }}>
  <div className="flex justify-between items-center space-x-2 md:space-x-6">
    {/* Logo scales down on mobile */}
    <div className="w-8 h-8 md:w-12 md:h-12">...</div>

    {/* Navigation items */}
    <button className="text-xs md:text-sm">...</button>
  </div>
</nav>
```

### Mobile Layout Strategies

#### Horizontal Scrolling Categories (Mobile Alternative to Sidebar)

When a desktop sidebar would consume too much vertical space on mobile, replace with horizontal scrolling tabs:

```tsx
{/* Desktop: Vertical sidebar */}
<div className="hidden md:flex w-64 border-r border-ink">
  {/* Sidebar content */}
</div>

{/* Mobile: Horizontal scrolling tabs */}
<div className="md:hidden overflow-x-auto bg-canvas border-b border-ink shrink-0">
  <div className="flex gap-2">
    <button className="px-3 py-2 whitespace-nowrap">Tab 1</button>
    <button className="px-3 py-2 whitespace-nowrap">Tab 2</button>
  </div>
</div>
```

**Key principles:**
- Use `shrink-0` to prevent flex compression
- Add `overflow-x-auto` for horizontal scrolling
- Use `whitespace-nowrap` to prevent text wrapping
- Include `bg-canvas` for visual separation

#### Flexbox Space Allocation

For layouts with fixed headers and scrolling content:

```tsx
<div className="h-[calc(100vh-140px)] flex flex-col">
  {/* Fixed header - won't shrink */}
  <header className="shrink-0">...</header>

  {/* Fixed tabs (mobile) - won't shrink */}
  <div className="md:hidden shrink-0">...</div>

  {/* Scrolling content - grows to fill space */}
  <div className="flex-grow overflow-hidden">
    <div className="overflow-y-auto h-full">
      {/* Content scrolls here */}
    </div>
  </div>
</div>
```

### Responsive Component Examples

#### Responsive Button

```tsx
<button className="
  bg-ink text-white
  px-2 md:px-4
  py-1.5 md:py-2
  text-xs md:text-sm
  font-mono uppercase font-semibold
  border border-ink
  hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal
  transition-all duration-brutal
  flex items-center
">
  <i className="fas fa-download md:mr-2"></i>
  <span className="hidden md:inline">Export</span>
</button>
```

#### Responsive Card Grid

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
  <div className="bg-white border border-ink p-4 md:p-8">
    {/* Card content */}
  </div>
</div>
```

#### Responsive Header with Inline Actions

```tsx
<div className="bg-white border border-ink p-4 md:p-8">
  {/* Title */}
  <h2 className="text-lg md:text-2xl font-bold mb-3">Title</h2>

  {/* Stats and actions on same row to save space */}
  <div className="flex flex-col md:flex-row md:justify-between gap-3">
    <div className="flex flex-wrap gap-x-4 text-xs md:text-sm">
      <span>Stat 1</span>
      <span>Stat 2</span>
    </div>
    <div className="flex space-x-2">
      {/* Action buttons */}
    </div>
  </div>
</div>
```

### Mobile-Specific Utilities

| Utility | Purpose |
| :--- | :--- |
| `hidden sm:block` | Hide on mobile, show on desktop |
| `sm:hidden` | Show on mobile, hide on desktop |
| `shrink-0` | Prevent flex item from shrinking |
| `overflow-x-auto` | Enable horizontal scrolling |
| `whitespace-nowrap` | Prevent text wrapping in scrolling containers |
| `-mx-4 px-4` | Extend background to edges (negative margin + padding) |

### Testing Guidelines

When implementing responsive features:
1. **Test at 375px width** (iPhone SE, smallest common mobile)
2. **Test at 768px width** (Tablet breakpoint)
3. **Ensure tap targets are at least 44x44px** (iOS guideline)
4. **Verify horizontal scrolling** works smoothly without bounce
5. **Check z-index stacking** doesn't cause overlap issues

---

## 11. Reference Component Code

Here is a reference snippet for a **"Feature Card"** that encapsulates the core logic of the system:

```html
<!-- 
  Reference: Feature Card 
  System: Flex column, 1px border, Inter font for body, sharp edges
-->
<div style="
    background: #fff;
    border: 1px solid #383838;
    display: flex;
    flex-direction: column;
    height: 420px;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    cursor: default;
"
onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='4px 4px 0 rgba(0,0,0,0.1)'"
onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'"
>
    <!-- Illustration Area -->
    <div style="
        flex-grow: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding-top: 32px;
    ">
        <!-- SVG Placeholder -->
        <svg width="60" height="60" viewBox="0 0 100 100">
            <rect x="20" y="20" width="60" height="60" fill="#2fd1b2" stroke="#383838" stroke-width="2"/>
        </svg>
    </div>

    <!-- Content Area (Inter Font Specification) -->
    <p style="
        font-family: 'Inter', sans-serif;
        font-weight: 300;
        font-size: 20px;
        line-height: 28px;
        letter-spacing: 0.4px;
        color: #383838;
        padding: 32px;
        margin: 0;
        margin-top: auto;
    ">
        Reads YOUR data. <br>
        (plaintext, json, parquet, iceberg, xls, csv)
    </p>
</div>
```