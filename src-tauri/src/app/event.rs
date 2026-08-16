use std::{sync::Mutex, thread, time::Duration};

use rdev::{grab, Button, EventType};
use serde::Serialize;
use tauri::{menu::MenuItem, AppHandle, Emitter, Manager, Wry};

use crate::app::state::AppState;
use crate::app::window::{
    syncing_draw_mode, syncing_overlay_pointer, toggling_settings_window,
};

const DRAW_TYPE_EVENT: &str = "draw-type-input";
const SHIFT_KEYS: [&str; 2] = ["ShiftLeft", "ShiftRight"];

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
            if allowing_draw_toggle(app_state) {
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
 * Drops latches when Ctrl+Alt+key is no longer held. Release never toggles.
 */
fn clearing_shortcut_latches(app_state: &mut AppState) {
    if !matching_ctrl_alt_key(&app_state.pressed_keys, SETTINGS_KEY) {
        app_state.settings_shortcut_latched = false;
    }
    if !matching_ctrl_alt_key(&app_state.pressed_keys, DRAW_MODE_KEY) {
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
#[serde(rename_all = "camelCase")]
pub struct TypedInput {
    pub action: String,
    pub value: String,
}

/**
 * Maps a hook key to Type-tool input. The overlay is not focusable, so
 * characters have to come from this hook instead of the webview.
 */
fn reading_typed_input(key_name: &str, pressed: &[String]) -> Option<TypedInput> {
    let shift = pressed
        .iter()
        .any(|name| SHIFT_KEYS.contains(&name.as_str()));
    match key_name {
        "Escape" => Some(TypedInput {
            action: "escape".into(),
            value: String::new(),
        }),
        "Backspace" => Some(TypedInput {
            action: "backspace".into(),
            value: String::new(),
        }),
        "Return" | "KpReturn" => Some(TypedInput {
            action: if shift { "newline".into() } else { "enter".into() },
            value: String::new(),
        }),
        "Space" => Some(TypedInput {
            action: "char".into(),
            value: " ".into(),
        }),
        "Tab" => Some(TypedInput {
            action: "char".into(),
            value: "\t".into(),
        }),
        other => reading_typed_char(other, shift).map(|value| TypedInput {
            action: "char".into(),
            value,
        }),
    }
}

/**
 * Letters, digits, and US-punctuation for the Type tool.
 */
fn reading_typed_char(key_name: &str, shift: bool) -> Option<String> {
    let letter = key_name.strip_prefix("Key")?;
    if letter.len() == 1 && letter.chars().all(|ch| ch.is_ascii_alphabetic()) {
        let ch = letter.chars().next()?;
        return Some(if shift {
            ch.to_ascii_uppercase().to_string()
        } else {
            ch.to_ascii_lowercase().to_string()
        });
    }
    let symbol = match (key_name, shift) {
        ("Num1", false) => "1",
        ("Num1", true) => "!",
        ("Num2", false) => "2",
        ("Num2", true) => "@",
        ("Num3", false) => "3",
        ("Num3", true) => "#",
        ("Num4", false) => "4",
        ("Num4", true) => "$",
        ("Num5", false) => "5",
        ("Num5", true) => "%",
        ("Num6", false) => "6",
        ("Num6", true) => "^",
        ("Num7", false) => "7",
        ("Num7", true) => "&",
        ("Num8", false) => "8",
        ("Num8", true) => "*",
        ("Num9", false) => "9",
        ("Num9", true) => "(",
        ("Num0", false) => "0",
        ("Num0", true) => ")",
        ("Minus", false) => "-",
        ("Minus", true) => "_",
        ("Equal", false) => "=",
        ("Equal", true) => "+",
        ("LeftBracket", false) => "[",
        ("LeftBracket", true) => "{",
        ("RightBracket", false) => "]",
        ("RightBracket", true) => "}",
        ("BackSlash", false) | ("IntlBackslash", false) => "\\",
        ("BackSlash", true) | ("IntlBackslash", true) => "|",
        ("SemiColon", false) => ";",
        ("SemiColon", true) => ":",
        ("Quote", false) => "'",
        ("Quote", true) => "\"",
        ("Comma", false) => ",",
        ("Comma", true) => "<",
        ("Dot", false) => ".",
        ("Dot", true) => ">",
        ("Slash", false) => "/",
        ("Slash", true) => "?",
        ("BackQuote", false) => "`",
        ("BackQuote", true) => "~",
        ("Kp0", _) => "0",
        ("Kp1", _) => "1",
        ("Kp2", _) => "2",
        ("Kp3", _) => "3",
        ("Kp4", _) => "4",
        ("Kp5", _) => "5",
        ("Kp6", _) => "6",
        ("Kp7", _) => "7",
        ("Kp8", _) => "8",
        ("Kp9", _) => "9",
        ("KpMinus", _) => "-",
        ("KpPlus", _) => "+",
        ("KpMultiply", _) => "*",
        ("KpDivide", _) => "/",
        ("KpDecimal", _) => ".",
        _ => return None,
    };
    Some(symbol.into())
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

        if let Err(err) = grab(move |event| {
            let mut settings_toggle = false;
            let mut draw_sync = false;
            let mut pointer_sync = false;
            let listening;
            let mut already_pressed = false;
            let mut key_releases: Option<Vec<String>> = None;
            let mut typed_input: Option<TypedInput> = None;
            let mut swallow_keys = false;
            let monitor_position;

            {
                let state = app_handle.state::<Mutex<AppState>>();
                let mut app_state = state.lock().unwrap();

                if let EventType::KeyPress(key) = event.event_type {
                    let key_name = format!("{:?}", key);
                    if key_name.contains('(') {
                        return if app_state.draw_typing {
                            None
                        } else {
                            Some(event)
                        };
                    }
                    already_pressed = app_state.pressed_keys.contains(&key_name);
                    if !already_pressed {
                        app_state.pressed_keys.push(key_name.clone());
                    }

                    if app_state.draw_typing {
                        swallow_keys = true;
                        if !already_pressed {
                            typed_input =
                                reading_typed_input(&key_name, &app_state.pressed_keys);
                        }
                    }

                    if !already_pressed
                        && app_state.draw_mode
                        && !app_state.draw_typing
                        && key_name == DRAW_EXIT_KEY
                    {
                        app_state.draw_mode = false;
                        app_state.draw_click_mode = false;
                        app_state.draw_typing = false;
                        app_state.draw_toggled_at = Some(std::time::Instant::now());
                        draw_sync = true;
                    } else if !already_pressed && !app_state.draw_typing {
                        updating_shortcut_latches(
                            &mut app_state,
                            &mut settings_toggle,
                            &mut draw_sync,
                        );
                    }

                    if !already_pressed
                        && !app_state.draw_typing
                        && app_state.toggle_shortcut == app_state.pressed_keys
                    {
                        app_state.toggle_listener(&app_handle, &toggle_menu_item);
                        if !app_state.listening {
                            key_releases = Some(app_state.pressed_keys.clone());
                        }
                    }
                } else if let EventType::KeyRelease(key) = event.event_type {
                    let key_name = format!("{:?}", key);
                    if key_name.contains('(') {
                        return if app_state.draw_typing {
                            None
                        } else {
                            Some(event)
                        };
                    }
                    if app_state.draw_typing {
                        swallow_keys = true;
                    }
                    app_state.pressed_keys.retain(|k| k != &key_name);
                    clearing_shortcut_latches(&mut app_state);
                } else if let EventType::MouseMove { x, y } = event.event_type {
                    let over = app_state.touching_toolbar(x, y);
                    if over != app_state.cursor_over_toolbar {
                        app_state.cursor_over_toolbar = over;
                        pointer_sync = app_state.draw_mode && app_state.draw_click_mode;
                    }
                }

                listening = app_state.listening;
                monitor_position = app_state.monitor_position;
            }

            if settings_toggle {
                toggling_settings_window(&app_handle);
            }
            if draw_sync {
                syncing_draw_mode(&app_handle);
            }
            if pointer_sync {
                syncing_overlay_pointer(&app_handle);
            }
            if let Some(typed) = typed_input {
                let _ = app_handle.emit(DRAW_TYPE_EVENT, typed);
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

            if swallow_keys {
                return None;
            }

            if !listening {
                return Some(event);
            }
            if already_pressed {
                if let EventType::KeyPress(_) = event.event_type {
                    return Some(event);
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
            Some(event)
        }) {
            eprintln!("rdev grab failed: {:?}", err);
        }
    });
}
