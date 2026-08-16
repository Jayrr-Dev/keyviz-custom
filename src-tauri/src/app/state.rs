use std::time::Instant;

use serde::Deserialize;
use tauri::{image::Image, include_image, menu::MenuItem, Emitter, Wry};

pub const ENTER_DRAW_LABEL: &str = "Enter Draw Mode";
pub const EXIT_DRAW_LABEL: &str = "Exit Draw Mode";
use tauri_plugin_store::StoreExt;

/// Toolbar box in physical pixels, relative to the spanning overlay window.
#[derive(Clone, Copy, Debug, Deserialize)]
pub struct ToolbarRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Default)]
pub struct AppState {
    pub listening: bool,
    pub pressed_keys: Vec<String>,
    pub toggle_shortcut: Vec<String>,
    pub draw_mode: bool,
    pub draw_click_mode: bool,
    /// True while a Type-tool field is focused, so Escape does not exit draw mode.
    pub draw_typing: bool,
    pub draw_shortcut_latched: bool,
    pub settings_shortcut_latched: bool,
    /// Guards against a repeated hook event toggling draw mode twice.
    pub draw_toggled_at: Option<Instant>,
    /// Where the in-overlay draw toolbar sits, reported by the webview.
    pub toolbar_rect: Option<ToolbarRect>,
    pub cursor_over_toolbar: bool,
    /// Last click-through value pushed to the overlay window.
    pub overlay_click_through: bool,
    /// Tray item that flips between Enter and Exit Draw Mode.
    pub draw_tray_item: Option<MenuItem<Wry>>,

    pub monitor_name: Option<String>,
    pub monitor_scale: f64,
    pub monitor_position: (i32, i32),
}

impl AppState {
    pub fn new(app: &tauri::AppHandle) -> Self {
        let mut toggle_shortcut = vec!["Shift".to_string(), "F10".to_string()];

        // load saved config from store
        if let Ok(store) = app.store("store.json") {
            if let Some(value) = store.get("key_event_store") {
                // the value comes in as a String: "{\"state\": ...}"
                if let Some(json_str) = value.as_str() {
                    // parse the inner string
                    match serde_json::from_str::<KeyEventStore>(json_str) {
                        Ok(parsed) => {
                            toggle_shortcut = parsed.state.toggle_shortcut;
                        }
                        Err(e) => eprintln!("Failed to parse inner config JSON: {}", e),
                    }
                }
            }
        }

        Self {
            listening: true,
            pressed_keys: vec![],
            toggle_shortcut,
            draw_mode: false,
            draw_click_mode: false,
            draw_typing: false,
            draw_shortcut_latched: false,
            settings_shortcut_latched: false,
            draw_toggled_at: None,
            toolbar_rect: None,
            cursor_over_toolbar: false,
            overlay_click_through: true,
            draw_tray_item: None,
            monitor_name: None,
            monitor_scale: 1.0,
            monitor_position: (0, 0),
        }
    }

    /// True when a desktop point sits inside the reported toolbar box.
    pub fn touching_toolbar(&self, screen_x: f64, screen_y: f64) -> bool {
        let Some(rect) = self.toolbar_rect else {
            return false;
        };
        let left = self.monitor_position.0 as f64 + rect.x;
        let top = self.monitor_position.1 as f64 + rect.y;
        screen_x >= left
            && screen_y >= top
            && screen_x < left + rect.width
            && screen_y < top + rect.height
    }
    pub fn toggle_listener(&mut self, app: &tauri::AppHandle, toggle: &tauri::menu::MenuItem<Wry>) {
        self.listening = !self.listening;

        if self.listening {
            println!("🟢 Listening enabled");
            toggle.set_text("Stop").unwrap();
            app.tray_by_id("keyviz-tray")
                .unwrap()
                .set_icon(Some(Image::from(include_image!("icons/tray.png"))))
                .unwrap();
        } else {
            println!("🔴 Listening disabled");
            toggle.set_text("Start").unwrap();
            app.tray_by_id("keyviz-tray")
                .unwrap()
                .set_icon(Some(Image::from(include_image!("icons/tray-disabled.png"))))
                .unwrap();
        }

        app.emit_to("main", "listening-toggle", self.listening)
            .unwrap();
    }
}

#[derive(Debug, Deserialize)]
struct KeyEventStore {
    pub state: KeyEventState,
    // pub version: u32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct KeyEventState {
    // pub drag_threshold: u32,
    // pub filter_hotkeys: bool,
    // pub ignore_modifiers: Vec<String>,
    // pub show_event_history: bool,
    // pub max_history: u32,
    // pub linger_duration_ms: u32,
    // pub show_mouse_events: bool,
    pub toggle_shortcut: Vec<String>,
}
