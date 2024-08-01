use lazy_static::lazy_static;
use std::sync::Mutex;
// use std::sync::RwLockReadGuard;

use crate::api::structs::RoundTreeData;

use super::processor::read_allocations;

// Use RwLock to allow for mutable access to the data
lazy_static! {
    static ref ROUND_DATA: Mutex<Option<Vec<RoundTreeData>>> = Mutex::new(None);
}

pub fn get_all_data() -> Vec<RoundTreeData> {
    let data = ROUND_DATA.lock().expect("Failed to acquire lock");
    data.clone().unwrap_or_else(Vec::new)
}

pub fn update_api_data() {
    let mut data = ROUND_DATA.lock().expect("Failed to acquire lock");

    let drops = read_allocations("./raw_input".to_string());

    *data = Some(drops);
}
