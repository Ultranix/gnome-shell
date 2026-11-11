# Transparent top bar

This GNOME Shell enhancement makes the top bar transparent and selects its
foreground from the desktop wallpaper's brightness.

The panelBackdrop.js module samples a small strip at the top of the wallpaper
using a 64-pixel-wide image. The average RGB color is converted from sRGB
into linear luminance using Rec. 709 weights. Luminance below 0.334 selects
light text; higher luminance selects dark text. This threshold is a local
appearance policy.

The sampler follows wallpaper settings, the preferred color scheme and
monitor changes. If an image cannot be sampled, it uses the configured
primary background color. Animated XML backgrounds currently use this
fallback. Sampling currently reads the source image's top strip rather
than accounting for every wallpaper scaling or cropping mode.

The panel.js module updates the transparent-panel-desktop style class as the
session enters or leaves desktop mode. The stylesheet uses explicit classes
supported by St to apply the adaptive foreground. Overview and lock-screen
styles retain their own foreground colors.

The optional blurred backdrop is disabled (DRAW_BACKDROP = false), so the
current top bar does not paint an additional background strip.
