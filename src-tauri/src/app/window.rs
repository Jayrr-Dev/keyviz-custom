use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewWindow, WebviewWindowBuilder,
};

const DRAW_TOOLBAR_LABEL: &str = "draw-toolbar";
const DRAW_TOOLBAR_WIDTH: f64 = 620.0;
const DRAW_TOOLBAR_HEIGHT: f64 = 128.0;
const DRAW_TOOLBAR_BOTTOM_GAP: f64 = 20.0;

/**
 * Opens settings, or closes them if that window is already up.
 */
pub fn toggling_settings_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("settings") {
        let visible = window.is_visible().unwrap_or(false);
        if visible {
            let _ = window.close();
            let _ = app.emit_to("main", "settings-window", false);
        } else {
            let _ = window.show();
            let _ = window.set_focus();
            let _ = app.emit_to("main", "settings-window", true);
        }
        return;
    }

    let webview_url = tauri::WebviewUrl::App("index.html#/settings".into());
    let _ = WebviewWindowBuilder::new(app, "settings", webview_url)
        .title("Keyviz")
        .inner_size(800.0, 640.0)
        .min_inner_size(640.0, 480.0)
        .max_inner_size(1000.0, 800.0)
        .maximizable(false)
        .build();

    let _ = app.emit_to("main", "settings-window", true);
}

/**
 * Turns draw mode on or off and lets the overlay take mouse clicks while drawing.
 * The overlay is not focusable in normal use, so we enable focus here so Escape can exit.
 */
pub fn applying_draw_mode(app: &AppHandle, enabled: bool) {
    if let Some(window) = app.get_webview_window("main") {
        if enabled {
            let _ = window.set_focusable(true);
            let _ = window.set_ignore_cursor_events(false);
            let _ = window.set_focus();
        } else {
            let _ = window.set_ignore_cursor_events(true);
            let _ = window.set_focusable(false);
        }
    }
    let _ = app.emit("draw-mode-toggle", enabled);
    let _ = app.emit("draw-click-mode", false);
    if enabled {
        showing_draw_toolbar(app);
    } else {
        hiding_draw_toolbar(app);
    }
}

/**
 * Click mode: drawings stay, mouse clicks go through to other apps.
 */
pub fn applying_draw_click_mode(app: &AppHandle, click_mode: bool) {
    if let Some(window) = app.get_webview_window("main") {
        if click_mode {
            let _ = window.set_ignore_cursor_events(true);
            let _ = window.set_focusable(false);
        } else {
            let _ = window.set_focusable(true);
            let _ = window.set_ignore_cursor_events(false);
            let _ = window.set_focus();
        }
    }
    let _ = app.emit("draw-click-mode", click_mode);
    showing_draw_toolbar(app);
}

/**
 * Pins the draw toolbar to the bottom of the display under the cursor.
 */
fn placing_draw_toolbar(window: &WebviewWindow) {
    let monitors = window.available_monitors().unwrap_or_default();
    if monitors.is_empty() {
        return;
    }
    let cursor = window.cursor_position().ok();
    let monitor = cursor
        .and_then(|point| {
            monitors.iter().find(|row| {
                let pos = row.position();
                let size = row.size();
                let x = point.x as i32;
                let y = point.y as i32;
                x >= pos.x
                    && y >= pos.y
                    && x < pos.x + size.width as i32
                    && y < pos.y + size.height as i32
            })
        })
        .or_else(|| monitors.first());
    let Some(monitor) = monitor else {
        return;
    };
    let scale = monitor.scale_factor();
    let pos = monitor.position();
    let size = monitor.size();
    let width = (DRAW_TOOLBAR_WIDTH * scale).round() as u32;
    let height = (DRAW_TOOLBAR_HEIGHT * scale).round() as u32;
    let gap = (DRAW_TOOLBAR_BOTTOM_GAP * scale).round() as i32;
    let x = pos.x + (size.width as i32 - width as i32) / 2;
    let y = pos.y + size.height as i32 - height as i32 - gap;
    let _ = window.set_size(PhysicalSize { width, height });
    let _ = window.set_position(PhysicalPosition { x, y });

    #[cfg(target_os = "windows")]
    {
        use windows::Win32::Foundation::HWND;
        use windows::Win32::UI::WindowsAndMessaging::{
            SetWindowPos, HWND_TOPMOST, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE,
        };

        if let Ok(hwnd) = window.hwnd() {
            let hwnd = HWND(hwnd.0 as isize);
            unsafe {
                let _ = SetWindowPos(
                    hwnd,
                    HWND_TOPMOST,
                    0,
                    0,
                    0,
                    0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
                );
            }
        }
    }
}

/**
 * Puts the draw toolbar back above the fullscreen overlay.
 */
pub fn raising_draw_toolbar(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(DRAW_TOOLBAR_LABEL) {
        if !window.is_visible().unwrap_or(false) {
            return;
        }
        placing_draw_toolbar(&window);
        let _ = window.set_ignore_cursor_events(false);
        let _ = window.set_always_on_top(true);
    }
}

/**
 * Opens the clickable draw toolbar above the overlay.
 */
fn showing_draw_toolbar(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(DRAW_TOOLBAR_LABEL) {
        placing_draw_toolbar(&window);
        let _ = window.set_ignore_cursor_events(false);
        let _ = window.set_always_on_top(true);
        let _ = window.show();
        return;
    }

    let webview_url = tauri::WebviewUrl::App("index.html#/draw-toolbar".into());
    if let Ok(window) = WebviewWindowBuilder::new(app, DRAW_TOOLBAR_LABEL, webview_url)
        .title("Keyviz Draw")
        .inner_size(DRAW_TOOLBAR_WIDTH, DRAW_TOOLBAR_HEIGHT)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .focused(false)
        .visible(false)
        .build()
    {
        placing_draw_toolbar(&window);
        let _ = window.set_ignore_cursor_events(false);
        let _ = window.show();
    }
}

/**
 * Hides the draw toolbar when draw mode ends.
 */
fn hiding_draw_toolbar(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(DRAW_TOOLBAR_LABEL) {
        let _ = window.hide();
    }
}

pub fn config_window(window: &tauri::WebviewWindow) {
    window
        .set_ignore_cursor_events(true)
        .expect("Failed to set ignore cursor events");

    #[cfg(target_os = "windows")]
    {
        use windows::Win32::Foundation::HWND;
        use windows::Win32::UI::WindowsAndMessaging::{
            SetWindowPos, HWND_TOPMOST, SWP_NOMOVE, SWP_NOSIZE,
        };

        let hwnd = HWND(window.hwnd().unwrap().0 as isize);
        unsafe {
            let _ = SetWindowPos(hwnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE);
        }
    }
    #[cfg(target_os = "macos")]
    {
        if let Ok(Some(monitor)) = window.primary_monitor() {
            let position = monitor.position();
            let size = monitor.size();

            window
                .set_position(tauri::PhysicalPosition {
                    x: position.x,
                    y: position.y,
                })
                .unwrap();
            window
                .set_size(tauri::PhysicalSize {
                    width: size.width,
                    height: size.height,
                })
                .unwrap();
        }

        use cocoa::appkit::{NSWindow, NSWindowCollectionBehavior};
        use cocoa::base::id;

        unsafe {
            let ns_window = window.ns_window().unwrap() as id;
            ns_window.setLevel_(1000);

            ns_window.setCollectionBehavior_(
                NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces,
            );
        }
    }

    window.show().expect("Failed to show window");
}
