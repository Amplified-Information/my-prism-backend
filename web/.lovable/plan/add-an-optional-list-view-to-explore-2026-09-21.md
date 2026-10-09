# Add an optional list view to Explore

## Goal
Let users switch `/explore` between the existing card grid and a denser list without changing search, category filtering, counts, or navigation.

## Changes
- Add a compact grid/list segmented control beside the result count, using familiar icons and accessible labels/tooltips.
- Keep the current card grid as the default.
- Add a responsive market-row presentation with thumbnail, market statement, category labels, market ID, and the existing YES/NO outcome widget.
- On small screens, reflow each row vertically so labels and outcomes remain readable.
- Use the existing market query and price query behavior; switching views will only change presentation.

## Verification
- Confirm both controls switch immediately and preserve the active search/category filters.
- Confirm list rows open the correct market.
- Check desktop and mobile layouts, loading state, and empty results.
- Confirm the project builds without errors.
