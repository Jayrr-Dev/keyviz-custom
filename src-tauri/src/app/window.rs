use tauri::{AppHandle, Emitter, Manager, WebviewWindowBuilder};

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
 */
pub fn applying_draw_mode(app: &AppHandle, enabled: bool) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_ignore_cursor_events(!enabled);
        if enabled {
            let _ = window.set_focus();
        }
    }
    let _ = app.emit("draw-mode-toggle", enabled);
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
