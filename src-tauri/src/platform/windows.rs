use dirs;

pub fn default_download_path() -> String {
    dirs::document_dir()
        .map(|d| d.join("WMDM"))
        .unwrap_or_default()
        .to_string_lossy()
        .to_string()
}

pub fn default_daw_paths(daw_id: &str) -> (String, String) {
    let docs = dirs::document_dir().unwrap_or_default();
    match daw_id {
        "logic" => (String::new(), String::new()), // Logic not on Windows
        "ableton" => {
            let p = docs.join("Ableton").join("User Library");
            (p.to_string_lossy().to_string(), p.to_string_lossy().to_string())
        }
        "cubase" => {
            let p = docs.join("Steinberg").join("Cubase");
            (p.to_string_lossy().to_string(), p.to_string_lossy().to_string())
        }
        "flstudio" => {
            let p = docs.join("Image-Line").join("FL Studio");
            (p.to_string_lossy().to_string(), p.to_string_lossy().to_string())
        }
        "bitwig" => {
            let p = docs.join("Bitwig Studio").join("Library");
            (p.to_string_lossy().to_string(), p.to_string_lossy().to_string())
        }
        "studio_one" => {
            let p = docs.join("Studio One");
            (p.to_string_lossy().to_string(), p.to_string_lossy().to_string())
        }
        _ => {
            let p = docs.join("WMDM");
            (p.to_string_lossy().to_string(), p.to_string_lossy().to_string())
        }
    }
}

pub fn daw_scan_paths() -> Vec<(String, String, Vec<String>)> {
    vec![
        (
            "ableton".into(),
            "Ableton Live".into(),
            vec![
                r"C:\ProgramData\Ableton\Live 12 Suite\Program\Ableton Live 12 Suite.exe".into(),
                r"C:\ProgramData\Ableton\Live 12 Standard\Program\Ableton Live 12 Standard.exe".into(),
                r"C:\ProgramData\Ableton\Live 11 Suite\Program\Ableton Live 11 Suite.exe".into(),
                r"C:\ProgramData\Ableton\Live 11 Standard\Program\Ableton Live 11 Standard.exe".into(),
            ],
        ),
        (
            "cubase".into(),
            "Cubase".into(),
            vec![
                r"C:\Program Files\Steinberg\Cubase 14\Cubase14.exe".into(),
                r"C:\Program Files\Steinberg\Cubase 13\Cubase13.exe".into(),
                r"C:\Program Files\Steinberg\Cubase 12\Cubase12.exe".into(),
            ],
        ),
        (
            "flstudio".into(),
            "FL Studio".into(),
            vec![
                r"C:\Program Files\Image-Line\FL Studio 2024\FL64.exe".into(),
                r"C:\Program Files\Image-Line\FL Studio 21\FL64.exe".into(),
                r"C:\Program Files (x86)\Image-Line\FL Studio 20\FL64.exe".into(),
            ],
        ),
        (
            "bitwig".into(),
            "Bitwig Studio".into(),
            vec![
                r"C:\Program Files\Bitwig Studio\5.3\Bitwig Studio.exe".into(),
                r"C:\Program Files\Bitwig Studio\5.2\Bitwig Studio.exe".into(),
                r"C:\Program Files\Bitwig Studio\5.1\Bitwig Studio.exe".into(),
                r"C:\Program Files\Bitwig Studio\Bitwig Studio.exe".into(),
            ],
        ),
        (
            "studio_one".into(),
            "Studio One".into(),
            vec![
                r"C:\Program Files\PreSonus\Studio One 6\Studio One.exe".into(),
                r"C:\Program Files\PreSonus\Studio One 5\Studio One.exe".into(),
            ],
        ),
    ]
}
