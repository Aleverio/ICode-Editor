use serde::Serialize;
use std::path::Path;
use std::process::Command;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalResult {
    pub output: String,
    pub exit_code: i32,
}

#[tauri::command]
pub async fn run_terminal_command(
    workspace_path: String,
    command: String,
) -> Result<TerminalResult, String> {
    tauri::async_runtime::spawn_blocking(move || execute_command(&workspace_path, &command))
        .await
        .map_err(|error| error.to_string())?
}

fn execute_command(workspace_path: &str, command: &str) -> Result<TerminalResult, String> {
    let directory = Path::new(workspace_path);
    if !directory.is_dir() {
        return Err("Workspace tidak ditemukan atau bukan folder.".to_string());
    }
    let output = if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args(["/C", command])
            .current_dir(directory)
            .output()
    } else {
        Command::new("sh")
            .args(["-lc", command])
            .current_dir(directory)
            .output()
    }
    .map_err(|error| error.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let result = match (stdout.is_empty(), stderr.is_empty()) {
        (true, true) => String::new(),
        (false, true) => stdout.into_owned(),
        (true, false) => stderr.into_owned(),
        (false, false) => format!("{stdout}\n{stderr}"),
    };
    Ok(TerminalResult {
        output: result,
        exit_code: output.status.code().unwrap_or(-1),
    })
}
