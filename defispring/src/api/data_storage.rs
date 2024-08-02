use lazy_static::lazy_static;
use std::sync::Arc;
use tokio::sync::{RwLock, RwLockReadGuard};

use crate::api::structs::RoundTreeData;

use super::processor::read_allocations;

// Use RwLock to allow for mutable access to the data
lazy_static! {
    static ref ROUND_DATA: Arc<RwLock<Vec<RoundTreeData>>> = Arc::new(RwLock::new(Vec::new()));
}

pub async fn get_all_data<'a>() -> RwLockReadGuard<'a, Vec<RoundTreeData>> {
    ROUND_DATA.read().await
}

pub async fn update_api_data() {
    let mut data = ROUND_DATA.write().await;

    let drops = read_allocations("./raw_input".to_string());

    *data = drops;
}
