# Accessibility Handoff Guide
**Bridge Design-to-Engineering: W3C ARIA Patterns**

This document defines the expected behavior of components for development. **Do not implement without consulting the keyboard patterns below.**

## 1. Component Interaction Patterns (W3C APG)

### 🔘 Button
*   **ARIA Attributes:** `role="button"`. For Toggles: `aria-pressed="true/false"`.
*   **Keyboard Behavior:** `Enter` or `Space` activates the button.
*   **Handoff Tip:** Define an `aria-label` for icon-only buttons.

### 🖼️ Modal Dialog
*   **ARIA Attributes:** `role="dialog"`, `aria-modal="true"`, `aria-labelledby`.
*   **Keyboard Behavior:**
    *   **Focus Trap:** Focus must remain inside the modal.
    *   `Esc`: Closes the modal.
    *   **Return:** Focus returns to the trigger element upon closing.

### 📑 Tabs
*   **ARIA Attributes:** `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`.
*   **Keyboard Behavior:** `Arrows` to navigate, `Space/Enter` to activate.

### 🪗 Accordion
*   **ARIA Attributes:** Header as `role="button"`, `aria-expanded`, `aria-controls`.
*   **Keyboard Behavior:** `Space/Enter` to toggle, `Arrows` to navigate headers.

### 📽️ Media (Video/Audio)
*   **Requirements:**
    *   **Captions:** Provide SRT or VTT files.
    *   **Audio Description:** Specify if a secondary audio track is needed.
    *   **Controls:** All player controls must be keyboard accessible and labeled.

---

## 2. Design Inspection Checklist (Design Ops)

### Visual & Interaction
- [ ] **Contrast:** Text (4.5:1) and UI (3:1) checked.
- [ ] **Target Size:** Primary buttons/links at least **44x44px**.
- [ ] **Focus Indicator:** Visible and high-contrast on all interactive elements.
- [ ] **Alt Text:** Defined for all functional images.

### Structure & Navigation
- [ ] **Landmarks:** `<main>`, `<nav>`, and `<header>` regions defined.
- [ ] **Heading Order:** H1 -> H2 -> H3 hierarchy preserved.
- [ ] **Tab Order:** Documented logical sequence.
- [ ] **Skip Links:** "Skip to content" link designed for the top of the page.

---

## Navigation
*   [SKILL.md](./SKILL.md) - Skills Framework.
*   [RESOURCES.md](./RESOURCES.md) - Technical Library.
