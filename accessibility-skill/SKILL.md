---
name: accessibility-skill
description: AI Skill for accessibility auditing and implementation, following WCAG standards and best practices.
metadata:
  {
    "clawdbot":
      {
        "emoji": "♿",
        "homepage": "https://github.com/idevabatista/accessibility-skill",
        "requires": { "bins": ["bankr"] },
      },
  }
---


# Accessibility Skills Taxonomy (V5.2 - Definitive Edition)
**Governance Framework for Design Ops & Product**

This framework consolidates 100% of the accumulated knowledge, mapping core competencies to **WCAG 2.1/2.2** and **W3C ARIA Patterns**.

## 1. Strategic Compliance Mapping

| Category | Core Skill | WCAG Level | Product Impact | Technical Ref. |
| :--- | :--- | :--- | :--- | :--- |
| **Structure** | 1. Hierarchy, Semantics & Landmarks | **A / AA** | Structural Navigation & SEO | WCAG 1.3.1, 2.4.1 |
| **Structure** | 2. Lists and Data Tables | **A** | Data Integrity | WCAG 1.3.1 |
| **Design** | 3. Contrast and Discernibility | **AA / AAA** | Universal Readability | WCAG 1.4.3, 1.4.11 |
| **Interaction** | 4. Focus & Target Size | **A / AA** | Keyboard & Touch Precision | WCAG 2.1.1, 2.5.8 |
| **Forms** | 5. Input & Error Management | **A / AA** | Conversion & UX | WCAG 3.3.1, 3.3.3 |
| **Content** | 6. Alternative Text (Alt Text) | **A** | Visual Inclusion | WCAG 1.1.1 |
| **Content** | 7. Accessible Media (Video/Audio) | **A / AA** | Sensory Inclusion | WCAG 1.2.2, 1.2.5 |
| **Dynamic** | 8. ARIA & Rich Components | **A / AA** | Interface Robustness | W3C ARIA APG |

---

## 2. Detailed Competencies

### 1. Hierarchy, Semantics & Landmarks
*   **The "Why":** Defines the "Accessibility Tree". Allows users to understand the structure and "jump" between sections.
*   **Technical Criteria:**
    *   **Landmarks:** Mandatory use of `<main>`, `<nav>`, `<header>`, `<aside>`, `<footer>`.
    *   **Headings:** Logical order H1 > H2 > H3. Never skip levels for aesthetic reasons.
*   **How to Test:** Page outline verification and landmark audits.

### 2. Lists and Data Tables
*   **The "Why":** Informs the user about the number of items and relationships between complex data.
*   **Technical Criteria:**
    *   **Lists:** Use `<ul>`/`<ol>` for groups of 2+ items.
    *   **Tables:** Use `<th>` with `scope` and `<caption>`. Never use tables for layout.
*   **How to Test:** Verify screen reader announcements ("List, X items").

### 3. Contrast and Discernibility
*   **The "Why":** Ensures readability in adverse conditions.
*   **Technical Criteria:**
    *   **Text:** 4.5:1 (normal) / 3:1 (large).
    *   **UI Elements:** 3:1 for boundaries (inputs, buttons) and functional icons.
    *   **Protection:** Use overlays on images or text halos on gradients.
*   **How to Test:** Colour Contrast Analyser.

### 4. Focus & Target Size (Interaction)
*   **The "Why":** Critical for keyboard and mobile users.
*   **Technical Criteria:**
    *   **Focus Ring:** High-contrast indicator visible against both component and background.
    *   **Target Size:** Minimum **44x44px** (primary) or 24x24px (secondary with spacing).
    *   **Focus Trapping:** Focus must remain trapped inside modals until closed.
*   **How to Test:** Exclusive `Tab` navigation and touch target audit.

### 5. Input & Error Management
*   **The "Why":** Reduces filling friction and prevents task abandonment.
*   **Technical Criteria:**
    *   **Labels:** `<label>` correctly linked to `<input>` ID.
    *   **Validation:** Use `role="alert"` and provide clear correction suggestions.
*   **How to Test:** Submit forms with incorrect data; check if errors are announced.

### 6. Alternative Text (Alt Text)
*   **The "Why":** Delivers image value to screen reader users. Improves SEO.
*   **Technical Criteria:**
    *   **Descriptive:** Focused on the image's function, not just appearance.
    *   **Decorative:** Use `alt=""` for aesthetic elements to be ignored by screen readers.
*   **How to Test:** Disable images and verify if the page context remains clear.

### 7. Accessible Media (Video & Audio)
*   **The "Why":** Inclusion for deaf and blind users.
*   **Technical Criteria:**
    *   **Captions:** Synchronized for all relevant audio (Level A).
    *   **Audio Description:** Description of visual actions not narrated (Level AA).
    *   **Transcripts:** Text versions for podcasts or standalone videos.
*   **How to Test:** Watch without sound and listen only to audio to validate.

### 8. ARIA & Rich Components (W3C APG)
*   **The "Why":** Communicates states and behaviors for complex UI (SPAs).
*   **Technical Criteria:**
    *   **Roles:** Correct use of roles (e.g., `tablist`, `dialog`, `accordion`).
    *   **States:** Use of `aria-expanded`, `aria-selected`, `aria-hidden`.
    *   **Patterns:** Implementation of W3C Keyboard Patterns (Arrows for navigation, Esc to close).
*   **How to Test:** Screen reader validation of state changes.

---

## Navigation
*   [RESOURCES.md](./RESOURCES.md) - Reference Library.
*   [HANDOFF.md](./HANDOFF.md) - Engineering Specifications.
