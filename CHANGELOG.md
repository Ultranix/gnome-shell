# Changelog

Fork-specific changes; upstream release history remains in `NEWS`.

## Unreleased — 2026-11-15

- Replace the strong wallpaper texture cache with weak references. Active
  backgrounds retain current entries; unused historical images can be collected
  without invalidating textures still owned by fading background actors.
- Deduplicate concurrent wallpaper loads and allow retries after failed loads.
- Prevent invalidated pending loads from replacing newer cache entries.
- Ignore cancelled and superseded asynchronous background results, and release
  animation cache entries when frames change or no frame is available.
- Add four cache tests covering sharing, retries, invalidation races and garbage
  collection. Validate compilation and an isolated Vulkan wallpaper-switch test.
- Document fork features and measured memory results in the README.

## 2026-11-11

- Add a transparent desktop top bar with wallpaper-adaptive foreground colors.
- Follow wallpaper, color-scheme and monitor changes while preserving separate
  overview and lock-screen styling.
