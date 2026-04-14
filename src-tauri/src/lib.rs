use std::path::PathBuf;
use std::process::{Command, Output};

use serde::Serialize;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
};

#[derive(Serialize)]
struct CommandCheckResult {
    installed: bool,
    version: Option<String>,
    path: Option<String>,
}

#[derive(Serialize)]
struct HermesStatus {
    installed: bool,
    version: Option<String>,
    path: Option<String>,
}

/// Get the hermes home directory (~/.hermes)
fn get_hermes_home() -> Result<PathBuf, String> {
    let home = std::env::var("HOME")
        .map_err(|_| "HOME environment variable not set".to_string())?;
    Ok(PathBuf::from(home).join(".hermes"))
}

fn is_safe_command_name(command: &str) -> bool {
    !command.is_empty()
        && command
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.' | '+'))
}

fn output_to_text(output: &Output) -> String {
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if !stdout.is_empty() {
        stdout
    } else {
        stderr
    }
}

fn normalize_version_token(token: &str) -> Option<String> {
    let cleaned = token.trim_matches(|ch: char| {
        !(ch.is_ascii_alphanumeric() || matches!(ch, '.' | '-' | '_' | '+'))
    });

    if cleaned.is_empty() {
        return None;
    }

    let cleaned = cleaned
        .strip_prefix('v')
        .or_else(|| cleaned.strip_prefix('V'))
        .unwrap_or(cleaned);

    if cleaned.contains('.') && cleaned.chars().any(|ch| ch.is_ascii_digit()) {
        Some(cleaned.to_string())
    } else {
        None
    }
}

fn extract_version(output: &str) -> Option<String> {
    let first_line = output.lines().find(|line| !line.trim().is_empty())?.trim();

    for token in first_line.split(|ch: char| ch.is_whitespace() || matches!(ch, ',' | '(' | ')' | ':')) {
        if let Some(version) = normalize_version_token(token) {
            return Some(version);
        }
    }

    Some(first_line.chars().take(64).collect())
}

/// Get the full PATH by sourcing shell profile
fn get_login_shell_path() -> String {
    let home = std::env::var("HOME").unwrap_or_default();

    if let Ok(output) = Command::new("/bin/zsh")
        .args(["-l", "-c", "echo $PATH"])
        .output()
    {
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !path.is_empty() {
            return path;
        }
    }

    format!(
        "{}/.local/bin:{}/.cargo/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin",
        home, home
    )
}

fn build_extended_path() -> String {
    let home = std::env::var("HOME").unwrap_or_default();
    format!(
        "{}/.local/bin:{}/.cargo/bin:{}",
        home,
        home,
        get_login_shell_path()
    )
}

fn resolve_command_path(command: &str) -> Result<Option<String>, String> {
    if !is_safe_command_name(command) {
        return Err("Invalid command name".to_string());
    }

    let script = format!("command -v {}", command);
    let output = Command::new("/bin/zsh")
        .args(["-l", "-c", &script])
        .output()
        .map_err(|err| format!("Failed to resolve command: {}", err))?;

    if !output.status.success() {
        return Ok(None);
    }

    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if path.is_empty() {
        Ok(None)
    } else {
        Ok(Some(path))
    }
}

fn read_command_version(path: &str) -> Option<String> {
    for flag in ["--version", "-version"] {
        if let Ok(output) = Command::new(path)
            .arg(flag)
            .env("PATH", build_extended_path())
            .output()
        {
            let text = output_to_text(&output);
            if let Some(version) = extract_version(&text) {
                return Some(version);
            }
        }
    }

    None
}

/// Get the hermes CLI path
fn find_hermes_cli() -> Option<String> {
    let home = std::env::var("HOME").unwrap_or_default();
    let candidate_paths = [
        "/usr/local/bin/hermes".to_string(),
        "/opt/homebrew/bin/hermes".to_string(),
        format!("{}/.local/bin/hermes", home),
        format!("{}/.hermes/bin/hermes", home),
    ];

    for path in candidate_paths {
        if std::path::Path::new(&path).exists() {
            return Some(path);
        }
    }

    resolve_command_path("hermes").ok().flatten()
}

fn build_command_from_shebang(shebang: &str) -> Option<Command> {
    let interpreter = shebang.strip_prefix("#!")?.trim();
    if interpreter.is_empty() {
        return None;
    }

    let mut parts = interpreter.split_whitespace();
    let executable = parts.next()?;
    let mut command = Command::new(executable);
    for part in parts {
        command.arg(part);
    }
    Some(command)
}

fn find_hermes_python_command() -> Result<Command, String> {
    let cli = find_hermes_cli().ok_or_else(|| "hermes is not installed".to_string())?;
    let contents =
        std::fs::read_to_string(&cli).map_err(|err| format!("Failed to inspect hermes launcher: {}", err))?;
    let first_line = contents
        .lines()
        .next()
        .ok_or_else(|| "Hermes launcher is empty".to_string())?;

    build_command_from_shebang(first_line)
        .ok_or_else(|| "Unable to resolve Hermes Python interpreter".to_string())
}

/// Run a hermes CLI command
#[tauri::command]
async fn run_hermes_command(args: Vec<String>) -> Result<String, String> {
    let cli = find_hermes_cli().unwrap_or_else(|| "hermes".to_string());

    let output = Command::new(&cli)
        .args(&args)
        .env("PATH", build_extended_path())
        .output()
        .map_err(|err| format!("Failed to execute hermes: {}", err))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(format!("hermes command failed: {}", output_to_text(&output)))
    }
}

/// Run the Python interpreter backing the Hermes CLI.
#[tauri::command]
async fn run_hermes_python(args: Vec<String>) -> Result<String, String> {
    let mut command = find_hermes_python_command()?;
    let output = command
        .args(&args)
        .env("PATH", build_extended_path())
        .output()
        .map_err(|err| format!("Failed to execute Hermes Python: {}", err))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(format!("Hermes Python failed: {}", output_to_text(&output)))
    }
}

/// Check whether a system command is installed and return its version.
#[tauri::command]
async fn check_command(command: String) -> Result<CommandCheckResult, String> {
    let path = resolve_command_path(&command)?;
    let version = path.as_deref().and_then(read_command_version);

    Ok(CommandCheckResult {
        installed: path.is_some(),
        version,
        path,
    })
}

/// Check if hermes is installed
#[tauri::command]
async fn check_hermes_installed() -> Result<bool, String> {
    Ok(find_hermes_cli().is_some())
}

/// Return hermes install details using the login-shell environment.
#[tauri::command]
async fn get_hermes_status() -> Result<HermesStatus, String> {
    let path = find_hermes_cli();
    let version = path.as_deref().and_then(read_command_version);

    Ok(HermesStatus {
        installed: path.is_some(),
        version,
        path,
    })
}

/// Get hermes version
#[tauri::command]
async fn get_hermes_version() -> Result<String, String> {
    let cli = find_hermes_cli().ok_or_else(|| "hermes is not installed".to_string())?;
    read_command_version(&cli).ok_or_else(|| "Failed to get hermes version".to_string())
}

/// Read a config file from ~/.hermes/
#[tauri::command]
async fn read_config_file(path: String) -> Result<String, String> {
    let hermes_home = get_hermes_home()?;
    let full_path = hermes_home.join(&path);

    let canonical = full_path
        .canonicalize()
        .map_err(|err| format!("Path does not exist: {}", err))?;

    if !canonical.starts_with(&hermes_home) {
        return Err("Access denied: path must be within ~/.hermes/".to_string());
    }

    std::fs::read_to_string(&canonical).map_err(|err| format!("Failed to read file: {}", err))
}

/// Write a config file to ~/.hermes/
#[tauri::command]
async fn write_config_file(path: String, content: String) -> Result<(), String> {
    let hermes_home = get_hermes_home()?;
    let full_path = hermes_home.join(&path);

    if path.contains("..") {
        return Err("Invalid path: path traversal not allowed".to_string());
    }

    if let Some(parent) = full_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|err| format!("Failed to create directory: {}", err))?;
    }

    std::fs::write(&full_path, content).map_err(|err| format!("Failed to write file: {}", err))
}

/// List files in a directory under ~/.hermes/
#[tauri::command]
async fn list_config_files(path: String) -> Result<Vec<String>, String> {
    let hermes_home = get_hermes_home()?;
    let full_path = hermes_home.join(&path);

    if path.contains("..") {
        return Err("Invalid path: path traversal not allowed".to_string());
    }

    let entries =
        std::fs::read_dir(&full_path).map_err(|err| format!("Failed to read directory: {}", err))?;

    let mut files = Vec::new();
    for entry in entries.flatten() {
        if let Some(name) = entry.file_name().to_str() {
            files.push(name.to_string());
        }
    }

    files.sort();
    Ok(files)
}

/// Check if a file exists in ~/.hermes/
#[tauri::command]
async fn config_file_exists(path: String) -> Result<bool, String> {
    let hermes_home = get_hermes_home()?;
    let full_path = hermes_home.join(&path);

    if path.contains("..") {
        return Err("Invalid path: path traversal not allowed".to_string());
    }

    Ok(full_path.exists())
}

/// Delete a file in ~/.hermes/
#[tauri::command]
async fn delete_config_file(path: String) -> Result<(), String> {
    let hermes_home = get_hermes_home()?;
    let full_path = hermes_home.join(&path);

    if path.contains("..") {
        return Err("Invalid path: path traversal not allowed".to_string());
    }

    if full_path == hermes_home {
        return Err("Cannot delete hermes home directory".to_string());
    }

    if full_path.is_dir() {
        std::fs::remove_dir_all(&full_path)
            .map_err(|err| format!("Failed to delete directory: {}", err))
    } else {
        std::fs::remove_file(&full_path).map_err(|err| format!("Failed to delete file: {}", err))
    }
}

/// Run a shell command (for install scripts, etc.)
#[tauri::command]
async fn run_shell_command(command: String, args: Vec<String>) -> Result<String, String> {
    let cmd_str = format!("{} {}", command, args.join(" "));
    let output = Command::new("/bin/zsh")
        .args(["-l", "-c", &cmd_str])
        .output()
        .map_err(|err| format!("Failed to execute command: {}", err))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(format!("Command failed: {}", output_to_text(&output)))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&quit])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("Hermes Desktop")
                .on_menu_event(|app, event| {
                    if event.id.as_ref() == "quit" {
                        app.exit(0);
                    }
                })
                .build(app)?;

            Ok(())
        })
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            run_hermes_command,
            run_hermes_python,
            check_command,
            check_hermes_installed,
            get_hermes_status,
            get_hermes_version,
            read_config_file,
            write_config_file,
            list_config_files,
            config_file_exists,
            delete_config_file,
            run_shell_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
