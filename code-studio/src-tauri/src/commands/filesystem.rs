use serde::Serialize;
use std::fs;
use std::path::Path;

const MAX_TEXT_FILE_BYTES: u64 = 5 * 1024 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
}

#[tauri::command]
pub fn list_directory(path: String) -> Result<Vec<FileEntry>, String> {
    let mut entries = fs::read_dir(&path)
        .map_err(|error| error.to_string())?
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let name = entry.file_name().to_string_lossy().into_owned();
            if matches!(name.as_str(), ".git" | "node_modules" | "target" | "dist") {
                return None;
            }
            let file_type = entry.file_type().ok()?;
            if file_type.is_symlink() {
                return None;
            }
            Some(FileEntry {
                name,
                path: entry.path().to_string_lossy().into_owned(),
                is_directory: file_type.is_dir(),
            })
        })
        .collect::<Vec<_>>();

    entries.sort_by(|left, right| {
        right
            .is_directory
            .cmp(&left.is_directory)
            .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
    });
    Ok(entries)
}

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    let metadata = fs::metadata(&path).map_err(|error| error.to_string())?;
    if !metadata.is_file() {
        return Err("Path bukan file biasa.".to_string());
    }
    if metadata.len() > MAX_TEXT_FILE_BYTES {
        return Err("File lebih besar dari batas editor 5 MiB.".to_string());
    }
    fs::read_to_string(path).map_err(|error| format!("File bukan teks UTF-8: {error}"))
}

#[tauri::command]
pub fn write_file(path: String, contents: String) -> Result<(), String> {
    fs::write(path, contents).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn create_item(parent: String, name: String, is_directory: bool) -> Result<FileEntry, String> {
    let relative = Path::new(&name);
    if relative.components().count() != 1 || relative.file_name().is_none() {
        return Err("Nama file tidak boleh berisi path.".to_string());
    }
    let path = Path::new(&parent).join(relative);
    if is_directory {
        fs::create_dir(&path).map_err(|error| error.to_string())?;
    } else {
        fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&path)
            .map_err(|error| error.to_string())?;
    }
    Ok(FileEntry {
        name,
        path: path.to_string_lossy().into_owned(),
        is_directory,
    })
}

#[cfg(test)]
mod tests {
    use super::{create_item, read_file, MAX_TEXT_FILE_BYTES};
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temporary_directory() -> std::path::PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock must be after the Unix epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("code-studio-{}-{nonce}", std::process::id()))
    }

    #[test]
    fn create_item_rejects_parent_path_components() {
        let result = create_item(".".to_string(), "../outside.txt".to_string(), false);

        assert!(matches!(
            result,
            Err(error) if error == "Nama file tidak boleh berisi path."
        ));
    }

    #[test]
    fn read_file_rejects_files_over_the_size_limit() {
        let directory = temporary_directory();
        fs::create_dir_all(&directory).expect("temporary directory should be created");
        let path = directory.join("large.txt");
        fs::File::create(&path)
            .expect("temporary file should be created")
            .set_len(MAX_TEXT_FILE_BYTES + 1)
            .expect("file size should be set");

        let result = read_file(path.to_string_lossy().into_owned());

        fs::remove_dir_all(directory).expect("temporary directory should be removed");
        assert_eq!(
            result.unwrap_err(),
            "File lebih besar dari batas editor 5 MiB."
        );
    }
}
