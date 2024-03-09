use lazy_static::lazy_static;
use std::sync::RwLock;

use crate::api::structs::RoundTreeData;

use super::processor::read_allocations;

// Use RwLock to allow for mutable access to the data
lazy_static! {
    static ref ROUND_DATA: RwLock<Vec<RoundTreeData>> = RwLock::new(Vec::new());
}

pub fn get_all_data() -> Vec<RoundTreeData> {
    ROUND_DATA
        .read()
        .expect("Failed to acquire read lock")
        .clone()
}

pub fn update_api_data() {
    let mut data = ROUND_DATA.write().expect("Failed to acquire write lock");

    let drops = read_allocations("./raw_input".to_string());

    *data = drops;
}
