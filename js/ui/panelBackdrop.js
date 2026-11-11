// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/* Sample the wallpaper beneath GNOME Shell's transparent top bar to select
 * a contrasting foreground. An optional backdrop reuses Meta.Background
 * with an actor blur effect; it is disabled for the transparent panel.
 * Use ACTOR blur for the backdrop to avoid sampling the panel itself.
 */

import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GdkPixbuf from 'gi://GdkPixbuf';
import GDesktopEnums from 'gi://GDesktopEnums';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from './main.js';

/* Set true to restore blurred desktop-capture strip under the menu bar. */
const DRAW_BACKDROP = false;

/* BlurEffect handles downscaling internally. */
const BLUR_RADIUS = 28;
const BLUR_BRIGHTNESS = 1.0;
/* Opacity of the optional painted backdrop. */
const BACKDROP_OPACITY = 255;

const SRGB_CUT = 0.04045;
const SRGB_DIV_LO = 12.92;
const SRGB_ADD = 0.055;
const SRGB_DIV_HI = 1.055;
const SRGB_GAMMA = 2.4;
const REC709_R = 0.2126;
const REC709_G = 0.7152;
const REC709_B = 0.0722;
const DARK_BG_LUMINANCE_THRESH = 0.334;

const BACKGROUND_SCHEMA = 'org.gnome.desktop.background';
const INTERFACE_SCHEMA = 'org.gnome.desktop.interface';
const PRIMARY_COLOR_KEY = 'primary-color';
const BACKGROUND_STYLE_KEY = 'picture-options';
const PICTURE_URI_KEY = 'picture-uri';
const PICTURE_URI_DARK_KEY = 'picture-uri-dark';
const COLOR_SCHEME_KEY = 'color-scheme';
const SAMPLE_WIDTH = 64;

function _srgbChannelToLinear(c) {
    if (c <= SRGB_CUT)
        return c / SRGB_DIV_LO;
    return Math.pow((c + SRGB_ADD) / SRGB_DIV_HI, SRGB_GAMMA);
}

function luminanceForColor(r, g, b) {
    return REC709_R * _srgbChannelToLinear(r) +
           REC709_G * _srgbChannelToLinear(g) +
           REC709_B * _srgbChannelToLinear(b);
}

function parseCssColor(colorString) {
    const [ok, color] = Cogl.Color.from_string(colorString);
    if (!ok)
        return null;
    return color;
}

export const PanelBackdrop = GObject.registerClass({
    Signals: {
        'dark-background-changed': {param_types: [GObject.TYPE_BOOLEAN]},
    },
}, class PanelBackdrop extends St.Widget {
    _init() {
        super._init({
            name: 'panelBackdrop',
            reactive: false,
            request_mode: Clutter.RequestMode.HEIGHT_FOR_WIDTH,
            x_expand: true,
            y_expand: true,
            /* No painted strip: stay fully transparent so wallpaper shows. */
            opacity: DRAW_BACKDROP ? BACKDROP_OPACITY : 0,
            style: 'background-color: transparent !important;',
        });

        this._bgActor = null;
        this._bgChangedId = 0;
        this._darkBackground = null;
        this._sampleSerial = 0;
        this._sampleIdleId = 0;
        this._blur = null;

        if (DRAW_BACKDROP) {
            this._blur = new Shell.BlurEffect({
                name: 'transparent-panel-blur',
                mode: Shell.BlurMode.ACTOR,
                brightness: BLUR_BRIGHTNESS,
                radius: BLUR_RADIUS,
            });
            this.add_effect(this._blur);
        }

        this._themeContext = St.ThemeContext.get_for_stage(global.stage);
        if (DRAW_BACKDROP) {
            this._themeContext.connectObject('notify::scale-factor',
                () => this._updateBlur(), this);
        }

        this._bgSettings = new Gio.Settings({schema_id: BACKGROUND_SCHEMA});
        this._ifaceSettings = new Gio.Settings({schema_id: INTERFACE_SCHEMA});
        this._bgSettings.connectObject(
            'changed', () => {
                if (DRAW_BACKDROP)
                    this._rebuildBackground();
                this._queueSampleLuminance();
            }, this);
        this._ifaceSettings.connectObject(
            `changed::${COLOR_SCHEME_KEY}`,
            () => {
                if (DRAW_BACKDROP)
                    this._rebuildBackground();
                this._queueSampleLuminance();
            }, this);

        Main.layoutManager.connectObject(
            'monitors-changed',
            () => {
                if (DRAW_BACKDROP)
                    this._rebuildBackground();
                this._queueSampleLuminance();
            }, this);
        if (DRAW_BACKDROP) {
            Main.layoutManager.connectObject(
                'startup-complete',
                () => this._rebuildBackground(), this);
        } else {
            Main.layoutManager.connectObject(
                'startup-complete',
                () => this._queueSampleLuminance(), this);
        }

        this.connect('destroy', this._onDestroy.bind(this));
        if (DRAW_BACKDROP) {
            this._rebuildBackground();
            this._updateBlur();
        }
        this._queueSampleLuminance();
    }

    get darkBackground() {
        return this._darkBackground;
    }

    setActive(active) {
        /* When not drawing, stay invisible regardless of overview. */
        this.visible = DRAW_BACKDROP ? !!active : false;
    }

    _updateBlur() {
        if (!this._blur)
            return;
        const scale = this._themeContext.scale_factor;
        this._blur.set({
            brightness: BLUR_BRIGHTNESS,
            radius: BLUR_RADIUS * scale,
        });
    }

    _clearBackground() {
        if (this._bgChangedId && this._bgTrack) {
            this._bgTrack.disconnect(this._bgChangedId);
            this._bgChangedId = 0;
            this._bgTrack = null;
        }
        if (this._bgActor) {
            this._bgActor.destroy();
            this._bgActor = null;
        }
        this.destroy_all_children();
    }

    _desktopBackground() {
        const monitorIndex = Main.layoutManager.primaryIndex;
        const managers = Main.layoutManager._bgManagers;
        const mgr = managers?.[monitorIndex];
        return mgr?.backgroundActor?.content?.background ?? null;
    }

    _rebuildBackground() {
        if (!DRAW_BACKDROP)
            return;

        this._clearBackground();

        const monitorIndex = Main.layoutManager.primaryIndex;
        if (monitorIndex < 0)
            return;

        const background = this._desktopBackground();
        if (!background) {
            /* Desktop backgrounds not ready yet — retry shortly. */
            GLib.idle_add(GLib.PRIORITY_LOW, () => {
                if (!this._bgActor && this._desktopBackground())
                    this._rebuildBackground();
                return GLib.SOURCE_REMOVE;
            });
            return;
        }

        this._bgActor = new Meta.BackgroundActor({
            meta_display: global.display,
            monitor: monitorIndex,
            request_mode: Clutter.RequestMode.HEIGHT_FOR_WIDTH,
            x_expand: true,
            y_expand: true,
        });
        this._bgActor.content.set({
            background,
            vignette: false,
            brightness: 1.0,
            vignette_sharpness: 0.0,
        });
        this.insert_child_at_index(this._bgActor, 0);
        log(`transparent-panel: desktop capture attached (monitor ${monitorIndex})`);

        /* When the desktop wallpaper object is replaced, refresh. */
        const managers = Main.layoutManager._bgManagers;
        const mgr = managers?.[monitorIndex];
        if (mgr) {
            this._bgTrack = mgr;
            this._bgChangedId = mgr.connect('changed',
                () => this._rebuildBackground());
        }

        this.queue_relayout();
        this._queueSampleLuminance();
    }

    _queueSampleLuminance() {
        if (this._sampleIdleId)
            return;

        this._sampleIdleId = GLib.idle_add(GLib.PRIORITY_LOW, () => {
            this._sampleIdleId = 0;
            try {
                this._sampleLuminance();
            } catch (e) {
                logError(e);
            }
            return GLib.SOURCE_REMOVE;
        });
    }

    _sampleLuminance() {
        const serial = ++this._sampleSerial;
        const monitor = Main.layoutManager.primaryMonitor;
        const panelHeight = Main.panel ? Main.panel.height : 32;
        const monitorHeight = monitor ? monitor.height : 1080;
        const stripFrac = Math.min(1, Math.max(0.02, panelHeight / monitorHeight));

        let avg = null;
        const style = this._bgSettings.get_enum(BACKGROUND_STYLE_KEY);
        if (style !== GDesktopEnums.BackgroundStyle.NONE) {
            const colorScheme = this._ifaceSettings.get_enum(COLOR_SCHEME_KEY);
            const uri = this._bgSettings.get_string(
                colorScheme === GDesktopEnums.ColorScheme.PREFER_DARK
                    ? PICTURE_URI_DARK_KEY
                    : PICTURE_URI_KEY);
            avg = this._averageFromUri(uri, stripFrac);
        }

        if (!avg) {
            const colorString = this._bgSettings.get_string(PRIMARY_COLOR_KEY);
            const color = parseCssColor(colorString);
            if (color) {
                avg = {
                    r: color.red / 255,
                    g: color.green / 255,
                    b: color.blue / 255,
                };
            }
        }

        if (serial !== this._sampleSerial || !avg)
            return;

        const dark = luminanceForColor(avg.r, avg.g, avg.b) < DARK_BG_LUMINANCE_THRESH;
        if (this._darkBackground === dark)
            return;

        this._darkBackground = dark;
        this.emit('dark-background-changed', dark);
    }

    _averageFromUri(uri, stripFrac) {
        if (!uri)
            return null;

        let file;
        try {
            file = Gio.File.new_for_commandline_arg(uri);
        } catch {
            return null;
        }

        if (!file.query_exists(null) || file.get_basename().endsWith('.xml'))
            return null;

        const path = file.get_path();
        if (!path)
            return null;

        let pixbuf;
        try {
            pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(path, SAMPLE_WIDTH, -1);
        } catch {
            return null;
        }

        return this._averagePixbufStrip(pixbuf, stripFrac);
    }

    _averagePixbufStrip(pixbuf, stripFrac) {
        const width = pixbuf.get_width();
        const height = pixbuf.get_height();
        if (width < 1 || height < 1)
            return null;

        const stripH = Math.max(1, Math.round(height * stripFrac));
        const nChannels = pixbuf.get_n_channels();
        const rowstride = pixbuf.get_rowstride();
        const pixels = pixbuf.get_pixels();
        const hasAlpha = pixbuf.get_has_alpha();

        let sumR = 0, sumG = 0, sumB = 0, count = 0;
        for (let y = 0; y < stripH; y++) {
            const row = y * rowstride;
            for (let x = 0; x < width; x++) {
                const i = row + x * nChannels;
                if (hasAlpha && pixels[i + 3] / 255 < 0.01)
                    continue;
                sumR += pixels[i];
                sumG += pixels[i + 1];
                sumB += pixels[i + 2];
                count++;
            }
        }

        if (count === 0)
            return null;

        return {
            r: sumR / (count * 255),
            g: sumG / (count * 255),
            b: sumB / (count * 255),
        };
    }

    vfunc_allocate(box) {
        this.set_allocation(box);

        if (!DRAW_BACKDROP || !this._bgActor)
            return;

        const width = box.get_width();
        const height = box.get_height();
        if (width < 1 || height < 1)
            return;

        const monitor = Main.layoutManager.primaryMonitor;
        const monitorHeight = monitor ? monitor.height : height;

        /* Clip to the menu-bar strip; wallpaper actor is full-monitor tall
         * so texture mapping matches the desktop (capture rect stand-in). */
        this.set_clip(0, 0, width, height);

        const childBox = new Clutter.ActorBox();
        childBox.set_origin(0, 0);
        childBox.set_size(width, monitorHeight);
        this._bgActor.allocate(childBox);
    }

    _onDestroy() {
        if (this._sampleIdleId) {
            GLib.source_remove(this._sampleIdleId);
            this._sampleIdleId = 0;
        }
        this._clearBackground();
        Main.layoutManager.disconnectObject(this);
        this._themeContext.disconnectObject(this);
        this._bgSettings.disconnectObject(this);
        this._ifaceSettings.disconnectObject(this);
    }
});
