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

## 9. Common Tailwind CSS Configuration

If you were implementing this in Tailwind, extend your `tailwind.config.js` as follows:

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        canvas: '#F4EFEA',
        ink: '#383838',
        'duck-yellow': '#FFD700',
        'link-blue': '#007AFF',
      },
      fontFamily: {
        mono: ['"Aeonik Mono"', 'ui-monospace', 'monospace'],
        sans: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'brutal': '2px 2px 0px #383838',
        'brutal-lg': '4px 4px 0px rgba(0,0,0,0.1)',
        'terminal': '6px 6px 0px rgba(0,0,0,0.1)',
      },
      letterSpacing: {
        'tight-mono': '0.32px',
        'wide-head': '1.44px',
      },
      fontSize: {
        'mega': ['72px', '86.4px'], // The Hero H1
        'card': ['20px', '28px'],   // The Card Body
      }
    }
  }
}
```

### Common Tailwind Class Strings
*   **Hero Header:** `font-mono text-ink text-mega uppercase tracking-wide-head font-normal`
*   **Primary Button:** `bg-ink text-white font-mono uppercase font-semibold border border-ink px-6 py-3 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal transition-all duration-200`
*   **Card Container:** `bg-white border border-black p-0 hover:-translate-y-1 hover:shadow-brutal-lg transition-transform duration-200`
*   **Card Text:** `font-sans font-light text-card tracking-[0.4px] text-ink p-8`

---

## 10. Reference Component Code

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