use std::sync::Mutex;

use serde::Serialize;
use tauri::{Manager, PhysicalPosition, PhysicalSize, WebviewWindow};

use crate::app::state::AppState;

/// Key-overlay box inside the spanning visualization window, in physical pixels.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OverlayLayout {
    pub key_x: i32,
    pub key_y: i32,
    pub key_width: u32,
    pub key_height: u32,
}

#[tauri::command]
pub fn log(message: String) {
    println!("[LOG] {}", message);
}

#[tauri::command]
pub fn set_toggle_shortcut(app: tauri::AppHandle, shortcut: Vec<String>) {
    let state = app.state::<Mutex<AppState>>();
    let mut app_state = state.lock().unwrap();
    app_state.toggle_shortcut = shortcut;
}

/// Turns draw mode on or off from Settings.
#[tauri::command]
pub fn set_draw_mode(app: tauri::AppHandle, enabled: bool) {
    let state = app.state::<Mutex<AppState>>();
    let mut app_state = state.lock().unwrap();
    app_state.draw_mode = enabled;
    app_state.draw_click_mode = false;
    crate::app::window::applying_draw_mode(&app, enabled);
}

/// Click mode keeps drawings and lets the mouse through to other apps.
#[tauri::command]
pub fn set_draw_click_mode(app: tauri::AppHandle, enabled: bool) {
    let state = app.state::<Mutex<AppState>>();
    let mut app_state = state.lock().unwrap();
    if !app_state.draw_mode {
        return;
    }
    app_state.draw_click_mode = enabled;
    crate::app::window::applying_draw_click_mode(&app, enabled);
}

/// Spans the overlay across every display. `monitor_name` only places the keycaps.
#[tauri::command]
pub fn set_main_window_monitor(
    app: tauri::AppHandle,
    monitor_name: Option<String>,
) -> Option<OverlayLayout> {
    let window = app.get_webview_window("main")?;
    let layout = {
        let state = app.state::<Mutex<AppState>>();
        let mut app_state = state.lock().unwrap();
        spanning_all_monitors(&window, monitor_name.as_deref(), &mut app_state)
    };
    crate::app::window::raising_draw_toolbar(&app);
    layout
}

/// Virtual desktop origin and size in the same space as the mouse hook.
fn reading_virtual_desktop(window: &WebviewWindow) -> Option<(i32, i32, u32, u32)> {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::Foundation::HWND;
        use windows::Win32::UI::WindowsAndMessaging::{
            GetSystemMetrics, SetWindowPos, HWND_TOPMOST, SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN,
            SM_XVIRTUALSCREEN, SM_YVIRTUALSCREEN, SWP_NOACTIVATE,
        };

        unsafe {
            let x = GetSystemMetrics(SM_XVIRTUALSCREEN);
            let y = GetSystemMetrics(SM_YVIRTUALSCREEN);
            let width = GetSystemMetrics(SM_CXVIRTUALSCREEN);
            let height = GetSystemMetrics(SM_CYVIRTUALSCREEN);
            let hwnd = HWND(window.hwnd().ok()?.0 as isize);
            let _ = SetWindowPos(hwnd, HWND_TOPMOST, x, y, width, height, SWP_NOACTIVATE);
            return Some((x, y, width as u32, height as u32));
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let monitors = window.available_monitors().unwrap_or_default();
        if monitors.is_empty() {
            return None;
        }
        let min_x = monitors.iter().map(|monitor| monitor.position().x).min()?;
        let min_y = monitors.iter().map(|monitor| monitor.position().y).min()?;
        let max_x = monitors
            .iter()
            .map(|monitor| monitor.position().x + monitor.size().width as i32)
            .max()?;
        let max_y = monitors
            .iter()
            .map(|monitor| monitor.position().y + monitor.size().height as i32)
            .max()?;
        let _ = window.set_position(PhysicalPosition { x: min_x, y: min_y });
        let _ = window.set_size(PhysicalSize {
            width: (max_x - min_x) as u32,
            height: (max_y - min_y) as u32,
        });
        Some((
            min_x,
            min_y,
            (max_x - min_x) as u32,
            (max_y - min_y) as u32,
        ))
    }
}

/// Sizes the main window to the virtual desktop and keeps keycaps on one display.
pub fn spanning_all_monitors(
    window: &WebviewWindow,
    key_monitor_name: Option<&str>,
    app_state: &mut AppState,
) -> Option<OverlayLayout> {
    let monitors = window.available_monitors().unwrap_or_default();
    if monitors.is_empty() {
        return None;
    }

    let (origin_x, origin_y, _width, _height) = reading_virtual_desktop(window)?;
    app_state.monitor_position = (origin_x, origin_y);
    app_state.monitor_name = key_monitor_name.map(|name| name.to_string());

    let key_index = key_monitor_name
        .and_then(|name| {
            monitors
                .iter()
                .position(|monitor| monitor.name().map(|n| n.as_str()) == Some(name))
        })
        .or_else(|| {
            window.primary_monitor().ok().flatten().and_then(|primary| {
                let primary_name = primary.name().map(|name| name.to_string());
                monitors
                    .iter()
                    .position(|monitor| monitor.name().map(|name| name.to_string()) == primary_name)
            })
        })
        .unwrap_or(0);

    let key_monitor = monitors.get(key_index)?;
    app_state.monitor_scale = key_monitor.scale_factor();

    Some(OverlayLayout {
        key_x: key_monitor.position().x - origin_x,
        key_y: key_monitor.position().y - origin_y,
        key_width: key_monitor.size().width,
        key_height: key_monitor.size().height,
    })
}

/// Foreground app used to pick a hotkey set.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ForegroundApp {
    pub process_name: String,
    pub window_title: String,
}

/// Reads the focused window's process name and title.
#[tauri::command]
pub fn reading_foreground_app() -> ForegroundApp {
    reading_foreground_app_inner().unwrap_or(ForegroundApp {
        process_name: String::new(),
        window_title: String::new(),
    })
}

fn reading_foreground_app_inner() -> Option<ForegroundApp> {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::Foundation::{CloseHandle, HMODULE, MAX_PATH};
        use windows::Win32::System::ProcessStatus::GetModuleFileNameExW;
        use windows::Win32::System::Threading::{OpenProcess, PROCESS_QUERY_INFORMATION, PROCESS_VM_READ};
        use windows::Win32::UI::WindowsAndMessaging::{
            GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId,
        };

        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.0 == 0 {
                return None;
            }

            let mut title_buf = [0u16; 512];
            let title_len = GetWindowTextW(hwnd, &mut title_buf);
            let window_title = String::from_utf16_lossy(&title_buf[..title_len as usize]);

            let mut process_id = 0u32;
            GetWindowThreadProcessId(hwnd, Some(&mut process_id));
            if process_id == 0 {
                return Some(ForegroundApp {
                    process_name: String::new(),
                    window_title,
                });
            }

            let handle =
                OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, false, process_id).ok()?;
            let mut path_buf = [0u16; MAX_PATH as usize];
            let written = GetModuleFileNameExW(handle, HMODULE(0), &mut path_buf);
            let _ = CloseHandle(handle);
            let full_path = if written > 0 {
                String::from_utf16_lossy(&path_buf[..written as usize])
            } else {
                String::new()
            };
            let process_name = full_path
                .rsplit(['\\', '/'])
                .next()
                .unwrap_or(&full_path)
                .to_string();

            Some(ForegroundApp {
                process_name,
                window_title,
            })
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        None
    }
}
