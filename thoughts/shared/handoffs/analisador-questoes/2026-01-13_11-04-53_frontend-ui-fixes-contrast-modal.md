---
date: 2026-01-13T11:04:53-03:00
session_name: analisador-questoes
researcher: Claude
git_commit: 89251c6e741efed14b0dd54a42d843f10592af4f
branch: main
repository: acssjr/analisador-questoes-concurso
topic: "Frontend UI Fixes: Contrast, Icons, Modal Scroll"
tags: [frontend, ui, accessibility, tailwind, css]
status: complete
last_updated: 2026-01-13
last_updated_by: Claude
type: implementation_strategy
root_span_id:
turn_span_id:
---

# Handoff: Frontend UI Fixes - Contrast, Modal Scroll, Stepper Numbers

## Task(s)
| Task | Status |
|------|--------|
| Fix poor text contrast in various parts | Completed |
| Fix missing icons in "Recursos" section (showing solid green circles) | Completed |
| Fix stepper numbers not showing in upload modal | Completed |
| Fix modal scroll scrolling background instead of modal content | Completed |
| Fix frontend test failures (11 failing tests) | Completed |
| Configure build to exclude test files | Completed |

## Critical References
- `frontend/src/index.css:26-33` - CSS variables for text colors (WCAG AA compliance)
- `frontend/src/components/ui/Modal.tsx` - Modal scroll isolation pattern

## Recent changes

### Tailwind Opacity Fix (Root Cause of Icon/Stepper Issues)
The core issue was using `bg-opacity-XX` which applies opacity to the ENTIRE element, not just the background:

- `frontend/src/components/features/EditalWorkflowModal.tsx:92-128` - Changed `bg-[var(--accent-green)] bg-opacity-15` to `bg-[rgba(27,67,50,0.15)]`
- `frontend/src/pages/Home.tsx:84-90` - Fixed FeatureCard icon background
- `frontend/src/pages/Home.tsx:409-419` - Fixed CTA section icon background

### Text Contrast Improvements
- `frontend/src/index.css:26-33` - Darkened text colors:
  ```css
  --text-secondary: #374151;  /* from #4B5563 */
  --text-tertiary: #4B5563;   /* from #6B7280 */
  --text-muted: #6B7280;      /* from #9CA3AF */
  ```

### Modal Scroll Isolation
- `frontend/src/components/ui/Modal.tsx:45` - Added `overflow-hidden` to container
- `frontend/src/components/ui/Modal.tsx:68` - Added `onClick={(e) => e.stopPropagation()}`
- `frontend/src/components/ui/Modal.tsx:71` - Added `flex-shrink-0` to header
- `frontend/src/components/ui/Modal.tsx:87` - Added `overscroll-contain` to body

### Build Configuration
- `frontend/tsconfig.app.json:28` - Added exclude patterns for test files

### Test Fixes
- `frontend/src/test/mocks.ts` - Created missing mock data file
- `frontend/src/pages/Dashboard.test.tsx` - Fixed store mocking (wrong property names)
- `frontend/src/components/ui/Modal.test.tsx:5-24` - Updated mock to identify backdrop by className

## Learnings

### Tailwind Opacity Pitfall
**Critical Pattern:** Never use `bg-opacity-XX` with CSS variables or when you need text inside the element to remain visible.

```tsx
// BAD - applies opacity to entire element including children
className="bg-[var(--accent-green)] bg-opacity-15"

// GOOD - opacity only on background color
className="bg-[rgba(27,67,50,0.15)]"
// or
className="bg-green-600/15"  // Tailwind's /XX syntax
```

### WCAG AA Contrast Minimums
- Normal text (< 18px): 4.5:1 ratio minimum
- Large text (>= 18px or 14px bold): 3:1 ratio minimum
- Interactive elements: 3:1 ratio minimum

### CSS Scroll Isolation
For modals with internal scrolling:
1. Container: `overflow-hidden` prevents body scroll
2. Modal content: `overflow-y-auto overscroll-contain` isolates scroll
3. Header: `flex-shrink-0` prevents header from shrinking
4. Click: `stopPropagation()` prevents click-through to backdrop

### Zustand Store Mocking
The store mock must match EXACT property names from the actual store:
- `activeEdital` not `currentEdital`
- `questoes` not `provas`
- Include all actions used by the component

## Post-Mortem (Required for Artifact Index)

### What Worked
- **Diagnosis approach**: Reading component code to understand class usage before proposing fixes
- **Incremental fixes**: Fixed one issue at a time, verified each before moving on
- **Test-first verification**: Ran tests after each change to catch regressions
- **RGBA pattern**: Using explicit rgba() values avoids Tailwind opacity inheritance issues

### What Failed
- Tried: Using `bg-opacity-XX` with CSS variables -> Failed because: Opacity applies to entire element
- Tried: Initial store mock with wrong property names -> Failed because: Store structure changed since mock was written
- Error: Build including test files -> Fixed by: Adding exclude patterns to tsconfig.app.json

### Key Decisions
- Decision: Use `bg-[rgba(r,g,b,a)]` instead of Tailwind's `/XX` syntax
  - Alternatives considered: `bg-green-600/15`, CSS custom property with embedded alpha
  - Reason: Explicit rgba() is clearest, works with any color value, doesn't require Tailwind color palette

- Decision: Darken text colors in CSS variables rather than component-level overrides
  - Alternatives considered: Per-component text color overrides
  - Reason: Single source of truth, consistent contrast across entire app

## Artifacts
- `frontend/src/index.css:26-33` - Updated text color variables
- `frontend/src/index.css:452-455` - New badge-muted style
- `frontend/src/components/ui/Modal.tsx` - Scroll isolation fixes
- `frontend/src/components/features/EditalWorkflowModal.tsx:92-128` - Stepper opacity fix
- `frontend/src/pages/Home.tsx:84-90` - FeatureCard icon fix
- `frontend/src/pages/Home.tsx:409-419` - CTA icon fix
- `frontend/tsconfig.app.json:28` - Test exclusion config
- `frontend/src/test/mocks.ts` - Created mock data file
- `frontend/src/pages/Dashboard.test.tsx` - Fixed store mocking
- `frontend/src/components/ui/Modal.test.tsx` - Updated backdrop mock

## Action Items & Next Steps
1. **Verify visual changes**: Open http://localhost:5174 and check:
   - Stepper numbers visible in EditalWorkflowModal
   - Icons visible in "Recursos" section on Home page
   - Modal scroll stays within modal bounds
   - Text contrast readable throughout

2. **Run full test suite**: `cd frontend && npm test` - All 101 tests should pass

3. **Consider accessibility audit**: Run axe-core or similar tool to catch remaining contrast issues

## Other Notes
- Backend running on http://127.0.0.1:8000
- Frontend running on http://localhost:5174
- All 101 frontend tests passing
- No pending linting or type errors
