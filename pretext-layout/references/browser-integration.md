# Browser Integration Guide

## Standard Pattern
1. Import Pretext in your browser entry point.
2. Ensure fonts are loaded before measurement:
   ```javascript
   await document.fonts.ready;
   ```
3. Use a cached layout handle for your UI components.
