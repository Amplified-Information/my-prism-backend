# Disable /rewards in production while keeping it in preview

## Goal
Hide the `/rewards` page and its navigation links from published builds, while keeping it accessible in the local/preview dev environment so work can continue.

## Current state
- `components/Routes.tsx` registers `<Route path='/rewards' element={<RewardsPage />} />` unconditionally.
- `components/Header.tsx` lists "Rewards" in both `navItems` (desktop) and `mobileMenuItems` (mobile) unconditionally.
- Page source lives at `src/pages/RewardsPage.tsx`.

## Proposed change
Use Vite's built-in `import.meta.env.DEV` flag to conditionally expose `/rewards` only in development/preview builds.

1. **Route gating in `components/Routes.tsx`**
   - Import `RewardsPage` dynamically or conditionally render the route only when `import.meta.env.DEV` is true.
   - In production builds the `/rewards` path will fall through to the catch-all `<Navigate to='/' replace />`.

2. **Navigation gating in `components/Header.tsx`**
   - Filter the "Rewards" item out of `navItems` and `mobileMenuItems` when `import.meta.env.DEV` is false.
   - Keeps the page file and all existing work intact; only its discoverability is toggled.

3. **Verification**
   - Confirm the route no longer resolves in a production build.
   - Confirm the link is absent from desktop and mobile headers in production.
   - Confirm `/rewards` still loads in the dev preview.

## Out of scope
- No changes to `src/pages/RewardsPage.tsx` itself.
- No removal of assets, hooks, or utilities used by the rewards page.
