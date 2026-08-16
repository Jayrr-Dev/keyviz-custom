use std::sync::Mutex;

use tauri::{
    image::Image,
    include_image,
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager,
};

mod app;
use app::commands::{
    log, reading_draw_state, reading_foreground_app, set_draw_click_mode, set_draw_mode,
    set_draw_typing,
    set_main_window_monitor, set_toggle_shortcut, setting_toolbar_rect,
    spanning_all_monitors,
};
use app::event::start_listener;
use app::state::AppState;
use app::window::{
    config_window, restarting_app, syncing_draw_mode, toggling_settings_window,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|_, __, ___| {}))
        .plugin(tauri_plugin_prevent_default::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_handle = app.handle().clone();
            app.manage(Mutex::new(AppState::new(&app_handle)));

            if let Some(window) = app.get_webview_window("main") {
                config_window(&window);
                let state = app.state::<Mutex<AppState>>();
                let mut app_state = state.lock().unwrap();
                spanning_all_monitors(&window, None, &mut app_state);
            }

            // tray actions
            let toggle_item = MenuItem::with_id(app, "toggle", "Stop", true, None::<&str>)?;
            let settings_item = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
            let draw_item = MenuItem::with_id(
                app,
                "toggle-draw",
                app::state::ENTER_DRAW_LABEL,
                true,
                None::<&str>,
            )?;
            {
                let state = app.state::<Mutex<AppState>>();
                let mut app_state = state.lock().unwrap();
                app_state.draw_tray_item = Some(draw_item.clone());
            }
            let restart_item = MenuItem::with_id(app, "restart", "Restart", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

            // start global input listener
            start_listener(app_handle.clone(), toggle_item.clone());

            // setup tray menu
            let menu = Menu::with_items(
                app,
                &[
                    &toggle_item,
                    &settings_item,
                    &draw_item,
                    &restart_item,
                    &quit_item,
                ],
            )?;
            let _ = TrayIconBuilder::with_id("keyviz-tray")
                .icon(Image::from(include_image!("icons/tray.png")))
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "toggle" => {
                        let state = app.state::<Mutex<AppState>>();
                        let mut app_state = state.lock().unwrap();
                        app_state.toggle_listener(app, &toggle_item);
                    }
                    "settings" => {
                        toggling_settings_window(app);
                    }
                    "toggle-draw" => {
                        {
                            let state = app.state::<Mutex<AppState>>();
                            let mut app_state = state.lock().unwrap();
                            app_state.draw_mode = !app_state.draw_mode;
                            if !app_state.draw_mode {
                                app_state.draw_click_mode = false;
                                app_state.draw_typing = false;
                            }
                            app_state.draw_toggled_at =
                                Some(std::time::Instant::now());
                        }
                        syncing_draw_mode(app);
                    }
                    "restart" => restarting_app(),
                    "quit" => std::process::exit(0),
                    _ => println!("um... what?"),
                })
                .build(app);

            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != "settings" {
                return;
            }
            match event {
                tauri::WindowEvent::CloseRequested { .. } => {
                    window
                        .app_handle()
                        .emit_to("main", "settings-window", false)
                        .unwrap();
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            log,
            set_toggle_shortcut,
            set_draw_mode,
            set_draw_click_mode,
            set_draw_typing,
            set_main_window_monitor,
            setting_toolbar_rect,
            reading_draw_state,
            reading_foreground_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
