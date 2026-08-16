use std::{sync::Mutex, thread, time::Duration};

use rdev::{listen, Button, EventType};
use serde::Serialize;
use tauri::{menu::MenuItem, AppHandle, Emitter, Manager, Wry};

use crate::app::state::AppState;
use crate::app::window::{syncing_draw_windows, toggling_settings_window};

const SHORTCUT_CTRL_KEYS: [&str; 2] = ["ControlLeft", "ControlRight"];
const SHORTCUT_ALT_KEYS: [&str; 2] = ["Alt", "AltGr"];
const SETTINGS_KEY: &str = "KeyQ";
const DRAW_MODE_KEY: &str = "KeyD";
const DRAW_EXIT_KEY: &str = "Escape";
/// Two toggles closer than this come from one keypress, so the second is dropped.
const DRAW_TOGGLE_DEBOUNCE: Duration = Duration::from_millis(250);

/**
 * Fires Ctrl+Alt shortcuts once per hold. Latch clears as soon as the combo
 * breaks, so a missed key-up cannot keep draw mode stuck on.
 */
fn updating_shortcut_latches(
    app_state: &mut AppState,
    settings_toggle: &mut bool,
    draw_sync: &mut bool,
) {
    if matching_ctrl_alt_key(&app_state.pressed_keys, SETTINGS_KEY) {
        if !app_state.settings_shortcut_latched {
            app_state.settings_shortcut_latched = true;
            *settings_toggle = true;
        }
    } else {
        app_state.settings_shortcut_latched = false;
    }

    if matching_ctrl_alt_key(&app_state.pressed_keys, DRAW_MODE_KEY) {
        if !app_state.draw_shortcut_latched {
            app_state.draw_shortcut_latched = true;
            let allowed = allowing_draw_toggle(app_state);
            println!(
                "[draw] combo hit keys={:?} allowed={} draw_mode={} -> {}",
                app_state.pressed_keys, allowed, app_state.draw_mode, !app_state.draw_mode
            );
            if allowed {
                app_state.draw_mode = !app_state.draw_mode;
                app_state.draw_click_mode = false;
                *draw_sync = true;
            }
        }
    } else {
        app_state.draw_shortcut_latched = false;
    }
}

/**
 * True when enough time has passed since the last draw toggle.
 */
fn allowing_draw_toggle(app_state: &mut AppState) -> bool {
    let now = std::time::Instant::now();
    let recent = app_state
        .draw_toggled_at
        .map(|last| now.duration_since(last) < DRAW_TOGGLE_DEBOUNCE)
        .unwrap_or(false);
    if recent {
        return false;
    }
    app_state.draw_toggled_at = Some(now);
    true
}

/**
 * True when Ctrl, Alt, and the given key are all held.
 * Extra keys are allowed so Windows Ctrl+Alt (often AltGr) still matches.
 */
fn matching_ctrl_alt_key(pressed: &[String], key: &str) -> bool {
    let has_ctrl = pressed
        .iter()
        .any(|name| SHORTCUT_CTRL_KEYS.contains(&name.as_str()));
    let has_alt = pressed
        .iter()
        .any(|name| SHORTCUT_ALT_KEYS.contains(&name.as_str()));
    let has_key = pressed.iter().any(|name| name == key);
    has_ctrl && has_alt && has_key
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type")]
pub enum InputEvent {
    KeyEvent { pressed: bool, name: String },
    MouseButtonEvent { pressed: bool, button: MouseButton },
    MouseMoveEvent { x: f64, y: f64 },
    MouseWheelEvent { delta_x: i64, delta_y: i64 },
}

#[derive(Debug, Clone, Serialize)]
pub enum MouseButton {
    Left,
    Right,
    Middle,
    Other,
}

pub fn map_mouse_button(button: Button) -> MouseButton {
    match button {
        Button::Left => MouseButton::Left,
        Button::Right => MouseButton::Right,
        Button::Middle => MouseButton::Middle,
        _ => MouseButton::Other,
    }
}

pub fn start_listener(app_handle: AppHandle, toggle_menu_item: MenuItem<Wry>) {
    thread::spawn(move || {
        println!("Starting global input listener...");

        if let Err(err) = listen(move |event| {
            let mut settings_toggle = false;
            let mut draw_sync = false;
            let listening;
            let mut already_pressed = false;
            let mut key_releases: Option<Vec<String>> = None;
            let monitor_position;

            {
                let state = app_handle.state::<Mutex<AppState>>();
                let mut app_state = state.lock().unwrap();

                if let EventType::KeyPress(key) = event.event_type {
                    let key_name = format!("{:?}", key);
                    if key_name.contains('(') {
                        return;
                    }
                    already_pressed = app_state.pressed_keys.contains(&key_name);
                    if !already_pressed {
                        app_state.pressed_keys.push(key_name.clone());
                    }

                    if !already_pressed
                        && app_state.draw_mode
                        && key_name == DRAW_EXIT_KEY
                    {
                        app_state.draw_mode = false;
                        app_state.draw_click_mode = false;
                        app_state.draw_toggled_at = Some(std::time::Instant::now());
                        draw_sync = true;
                    } else {
                        updating_shortcut_latches(
                            &mut app_state,
                            &mut settings_toggle,
                            &mut draw_sync,
                        );
                    }

                    if !already_pressed && app_state.toggle_shortcut == app_state.pressed_keys
                    {
                        app_state.toggle_listener(&app_handle, &toggle_menu_item);
                        if !app_state.listening {
                            key_releases = Some(app_state.pressed_keys.clone());
                        }
                    }
                } else if let EventType::KeyRelease(key) = event.event_type {
                    let key_name = format!("{:?}", key);
                    if key_name.contains('(') {
                        return;
                    }
                    app_state.pressed_keys.retain(|k| k != &key_name);
                    updating_shortcut_latches(
                        &mut app_state,
                        &mut settings_toggle,
                        &mut draw_sync,
                    );
                }

                listening = app_state.listening;
                monitor_position = app_state.monitor_position;
            }

            if settings_toggle {
                toggling_settings_window(&app_handle);
            }
            if draw_sync {
                syncing_draw_windows(&app_handle);
            }
            if let Some(names) = key_releases {
                for name in names {
                    let _ = app_handle.emit_to(
                        "main",
                        "input-event",
                        InputEvent::KeyEvent {
                            pressed: false,
                            name,
                        },
                    );
                }
            }

            if !listening {
                return;
            }
            if already_pressed {
                if let EventType::KeyPress(_) = event.event_type {
                    return;
                }
            }

            let input_event = match event.event_type {
                EventType::KeyPress(key) => Some(InputEvent::KeyEvent {
                    pressed: true,
                    name: format!("{:?}", key),
                }),
                EventType::KeyRelease(key) => Some(InputEvent::KeyEvent {
                    pressed: false,
                    name: format!("{:?}", key),
                }),
                EventType::ButtonPress(button) => Some(InputEvent::MouseButtonEvent {
                    pressed: true,
                    button: map_mouse_button(button),
                }),
                EventType::ButtonRelease(button) => Some(InputEvent::MouseButtonEvent {
                    button: map_mouse_button(button),
                    pressed: false,
                }),
                EventType::MouseMove { x, y } => {
                    let (offset_x, offset_y) = monitor_position;
                    Some(InputEvent::MouseMoveEvent {
                        x: x - offset_x as f64,
                        y: y - offset_y as f64,
                    })
                }
                EventType::Wheel { delta_x, delta_y } => {
                    Some(InputEvent::MouseWheelEvent { delta_x, delta_y })
                }
            };

            let _ = app_handle.emit("input-event", input_event);
        }) {
            eprintln!("rdev listen failed: {:?}", err);
        }
    });
}
