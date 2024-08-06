use lazy_static::lazy_static;
use std::sync::Arc;
use tokio::sync::{Mutex, MutexGuard};

use crate::api::structs::RoundTreeData;

use super::processor::read_allocations;

// Use RwLock to allow for mutable access to the data
lazy_static! {
    static ref ROUND_DATA: Arc<Mutex<Vec<RoundTreeData>>> = Arc::new(Mutex::new(Vec::new()));
}

pub async fn get_all_data<'a>() -> MutexGuard<'a, Vec<RoundTreeData>> {
    ROUND_DATA.lock().await
}

pub async fn update_api_data() {
    let mut data = ROUND_DATA.lock().await;

    let drops = read_allocations("./raw_input".to_string());

    *data = drops;
}
