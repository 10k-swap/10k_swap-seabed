use lazy_static::lazy_static;
use std::sync::{Arc, RwLock, RwLockReadGuard};

use crate::api::structs::RoundTreeData;

use super::processor::read_allocations;

// Use RwLock to allow for mutable access to the data
lazy_static! {
    static ref ROUND_DATA: Arc<RwLock<Vec<RoundTreeData>>> = Arc::new(RwLock::new(Vec::new()));
}

pub fn get_all_data<'a>() -> RwLockReadGuard<'a, Vec<RoundTreeData>> {
    ROUND_DATA.read().expect("Failed to acquire read lock")
}

pub fn update_api_data() {
    let mut data = ROUND_DATA.write().expect("Failed to acquire write lock");

    let drops = read_allocations("./raw_input".to_string());

    *data = drops;
}
