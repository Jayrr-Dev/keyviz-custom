use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager, WebviewWindowBuilder};

use crate::app::state::{AppState, ENTER_DRAW_LABEL, EXIT_DRAW_LABEL};

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
 * Click-through rule for the overlay:
 * - idle: clicks pass through
 * - inking: overlay takes clicks so strokes land
 * - click mode: clicks pass through except over the toolbar
 */
fn wanting_click_through(app_state: &AppState) -> bool {
    if !app_state.draw_mode {
        return true;
    }
    if !app_state.draw_click_mode {
        return false;
    }
    !app_state.cursor_over_toolbar
}

/**
 * Pushes the click-through rule to the overlay, skipping no-op calls.
 * Window work runs on the UI thread.
 */
pub fn syncing_overlay_pointer(app: &AppHandle) {
    let click_through = {
        let state = app.state::<Mutex<AppState>>();
        let mut app_state = state.lock().unwrap();
        let wanted = wanting_click_through(&app_state);
        if wanted == app_state.overlay_click_through {
            return;
        }
        app_state.overlay_click_through = wanted;
        wanted
    };

    let handle = app.clone();
    let _ = app.clone().run_on_main_thread(move || {
        if let Some(window) = handle.get_webview_window("main") {
            let _ = window.set_ignore_cursor_events(click_through);
        }
    });
}

/**
 * Applies the draw flags: overlay click-through plus a broadcast so every
 * webview can follow. Leaving draw mode drops the stale toolbar box.
 */
pub fn syncing_draw_mode(app: &AppHandle) {
    let (draw_mode, click_mode) = {
        let state = app.state::<Mutex<AppState>>();
        let mut app_state = state.lock().unwrap();
        if !app_state.draw_mode {
            app_state.toolbar_rect = None;
            app_state.cursor_over_toolbar = false;
            app_state.draw_typing = false;
        }
        if let Some(item) = &app_state.draw_tray_item {
            let label = if app_state.draw_mode {
                EXIT_DRAW_LABEL
            } else {
                ENTER_DRAW_LABEL
            };
            let _ = item.set_text(label);
        }
        (app_state.draw_mode, app_state.draw_click_mode)
    };

    syncing_overlay_pointer(app);
    let _ = app.emit("draw-mode-toggle", draw_mode);
    let _ = app.emit("draw-click-mode", click_mode);
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

/**
 * Project root for a cargo-built exe at …/src-tauri/target/{debug|release}/keyviz.exe.
 */
fn reading_dev_project_root(exe: &std::path::Path) -> Option<std::path::PathBuf> {
    let root = exe.ancestors().nth(4)?;
    if root.join("package.json").is_file() && root.join("src-tauri").is_dir() {
        Some(root.to_path_buf())
    } else {
        None
    }
}

/**
 * Starts a new Keyviz process after this one exits.
 * Dev builds need `npx tauri dev` so Vite comes back on localhost:1420.
 * Packaged builds only relaunch the exe.
 */
pub fn restarting_app() {
    let Ok(exe) = std::env::current_exe() else {
        std::process::exit(0);
    };

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;

        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        const DETACHED_PROCESS: u32 = 0x0000_0008;

        let raw = exe.to_string_lossy();
        let path = raw.strip_prefix(r"\\?\").unwrap_or(&raw).replace('"', "");
        let exe_path = std::path::Path::new(&path);
        let is_cargo_build = path.contains(r"\target\debug\")
            || path.contains(r"\target\release\");

        if is_cargo_build {
            if let Some(root) = reading_dev_project_root(exe_path) {
                let root = root.to_string_lossy().replace('"', "");
                // Wait for this process to die, then relaunch the full Vite + Tauri stack.
                let command = format!(
                    "/C ping 127.0.0.1 -n 3 >nul & cd /d \"{root}\" & start \"Keyviz\" cmd /k \"npx tauri dev\""
                );
                let _ = std::process::Command::new("cmd")
                    .raw_arg(command)
                    .creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS)
                    .spawn();
                std::process::exit(0);
            }
        }

        // Packaged build: relaunch the exe only.
        let _ = std::process::Command::new("cmd")
            .raw_arg(format!(
                "/C ping 127.0.0.1 -n 2 >nul & start \"\" \"{path}\""
            ))
            .creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS)
            .spawn();
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = std::process::Command::new(exe).spawn();
    }

    std::process::exit(0);
}
