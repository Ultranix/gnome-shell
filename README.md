# GNOME Shell

GNOME Shell provides core user interface functions for the GNOME desktop,
like switching to windows and launching applications. GNOME Shell takes
advantage of the capabilities of modern graphics hardware and introduces
innovative user interface concepts to provide a visually attractive and
easy-to-use experience.

All interactions with the project should follow the [Code of Conduct][conduct].

[conduct]: https://conduct.gnome.org/

## Features in this fork

This fork adds desktop appearance and memory-lifetime improvements:

- **Transparent top bar with adaptive foreground.** Text and icons switch
  between light and dark according to wallpaper luminance. Wallpaper,
  color-scheme and monitor changes update the selection; overview and lock
  screen keep their own styling. See [Transparent top bar](doc/transparent-panel.md)
  for sampling behavior and limitations.
- **Wallpaper texture lifetime management.** The cache weakly references
  historical entries, while active backgrounds retain their current image or
  animation frames. Switching wallpapers can release unused textures after
  garbage collection, native-reference release and GPU completion.
- **Shared asynchronous loading.** Concurrent requests for the same wallpaper
  share a load. Failed requests can be retried, file invalidation cannot let an
  older request replace a newer entry, and cancelled or superseded backgrounds
  ignore late results.
- **Integration with the Vulkan compositor fork.** Vulkan rendering and its
  allocation retirement are provided by [Ultranix/mutter](https://github.com/Ultranix/mutter).
  Build against the matching Mutter library ABI.

In an Intel i915, 1920×1080 headless Vulkan test with six wallpaper switches,
matching overview operations and explicit garbage collection, the rendering
client's final resident allocation decreased from about **568 MiB to 378 MiB**.
Process PSS changed from about **225 MiB to 217 MiB**. These are separate memory
metrics and must not be added together; this test does not predict a full
session's memory usage or immediate reclamation during normal use. This change
does not downscale source wallpapers or force global garbage collection.

See [Changelog](CHANGELOG.md) for fork changes. Report fork-specific problems
at [Ultranix/gnome-shell issues](https://github.com/Ultranix/gnome-shell/issues).
The following support and contribution sections describe the upstream project.

## Supported versions

Upstream gnome-shell only supports the most recent stable release series,
the previous stable release series, and the current development release
series. Any older stable release series are no longer supported, although
they may still receive backported security updates in long-term support
distributions. Such support is up to the distributions, though.

Please refer to the [schedule] to see when a new version will be released.

[schedule]: https://release.gnome.org/calendar

## Reporting bugs

Bugs should be reported to the [issue tracking system][bug-tracker].

The [GNOME handbook][bug-handbook] has useful information for creating
effective issue reports.

If you are using extensions, please confirm that an issue still happens
without extensions. To properly disable extensions, you can use the
[extensions-app] and then restart your session. Disabling extensions
without a restart is not sufficient to rule out extensions as the
cause of a bug. If an issue can only be reproduced with a certain
extension, please file an issue report against that extension first.

Please note that the issue tracker is meant to be used for
actionable issues only.

For support questions, feedback on changes or general discussions,
you can use:

 - the [#gnome-shell matrix room][matrix-room]
 - the `Desktop` category or `shell` tag on [GNOME Discourse][discourse]

[bug-tracker]: https://gitlab.gnome.org/GNOME/gnome-shell/issues
[bug-handbook]: https://handbook.gnome.org/issues/reporting.html
[extensions-app]: https://apps.gnome.org/Extensions
[matrix-room]: https://matrix.to/#/#gnome-shell:gnome.org
[discourse]: https://discourse.gnome.org

## Feature requests

gnome-shell is a core component of the GNOME desktop experience.
As such, any changes in behavior or appearance only happen in
accordance with the [GNOME design team][design-team].

For major changes, it is best to start a discussion on [discourse]
and reach out on the [#gnome-design matrix room][design-room],
and only involve the issue tracker once agreement has been reached.

In particular, mockups must be approved by the design team to be
considered for implementation.

For enhancements that are limited in scope and well-defined,
it is acceptable to directly open a feature request.

When in doubt, it is better to ask before opening an issue.

[design-team]: https://gitlab.gnome.org/Teams/Design
[discourse]: https://discourse.gnome.org
[design-room]: https://matrix.to/#/#gnome-design:gnome.org

## Contributing

To contribute, open merge requests at https://gitlab.gnome.org/GNOME/gnome-shell.

It can be useful to first look at the [GNOME handbook][mr-handbook].

If a change likely requires discussion beyond code review, it is probably better to
open an issue first or follow the process for [feature requests](#feature-requests).
Otherwise, creating a separate issue is not required.

The following guidelines will help your change to be successfully merged:

 * Keep the change as small as possible. If you can split it into multiple
   merge requests, please do so.
 * Use multiple commits. This makes it easier to review and helps to diagnose
   bugs in the future.
 * Use clear commit messages following the [conventions][commit-messages].
 * Pay attention to the CI results. Merge requests cannot be merged until the
   CI passes.

There's also a [small guide for newcomers][newcomers-contribution-guide] with
a few more basic tips and tricks.

[mr-handbook]: https://handbook.gnome.org/development/change-submission.html
[commit-messages]: docs/commit-messages.md
[newcomers-contribution-guide]: docs/newcomers-contribution-guide.md

## Documentation

 * [Coding style and conventions for JavaScript][js-style]
 * [Coding style and conventions for C code][c-style]
 * [The GJS Developer Guide][gjs-guide]
 * [Building and Running][building]
 * [Debugging][debugging]

[js-style]: docs/js-coding-style.md
[c-style]: docs/c-coding-style.md
[gjs-guide]: https://gjs.guide
[building]: docs/building-and-running.md
[debugging]: docs/debugging.md

## API Reference

 * [Meta][meta-docs]: Display server and window manager
 * [St][st-docs]: Shell toolkit
 * [Clutter][clutter-docs]: OpenGL based scene graph
 * [Shell][shell-docs]: Non-ui shell objects and utilities
 * See the [mutter page][mutter-docs] for additional documentation

[st-docs]: <https://gnome.pages.gitlab.gnome.org/gnome-shell/st/>
[shell-docs]: <https://gnome.pages.gitlab.gnome.org/gnome-shell/shell/>
[clutter-docs]: <https://mutter.gnome.org/clutter/>
[meta-docs]: <https://mutter.gnome.org/meta/>
[mutter-docs]: <https://mutter.gnome.org>

## License

GNOME Shell is distributed under the terms of the GNU General Public License,
version 2 or later. See the [COPYING][license] file for details.

[license]: COPYING
