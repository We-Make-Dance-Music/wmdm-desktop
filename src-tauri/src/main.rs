// WMDM Desktop App — Entry Point
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    wmdm_desktop_lib::run()
}
