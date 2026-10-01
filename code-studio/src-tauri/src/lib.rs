mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::filesystem::list_directory,
            commands::filesystem::read_file,
            commands::filesystem::write_file,
            commands::filesystem::create_item,
            commands::terminal::run_terminal_command
        ])
        .run(tauri::generate_context!())
        .expect("error while running Code Studio");
}
