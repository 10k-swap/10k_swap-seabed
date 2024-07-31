use serde::{Deserialize, Serialize};
use starknet_crypto::FieldElement;
use std::collections::{HashMap, HashSet};
use utoipa::ToSchema;

/// Contains all data used in one round
#[derive(Debug, Clone)]
pub struct RoundTreeData {
    /// Which round
    pub round: u8,
    /// Cumulative amounts for each address in a Merkle tree
    pub tree: MerkleTree,
    /// The accumulated amount of tokens to be distributed in a round. Includes amounts from all previous rounds
    pub accumulated_total_amount: u128,
    /// The total amount of tokens to be distributed in a round. Includes amounts only from one round
    pub round_total_amount: u128,
}

/// Used for some intermediary calculations
pub struct RoundAmounts {
    pub round: u8,
    pub amounts: Vec<JSONAllocation>,
}

/// Temporary storage inside processing
pub struct RoundAmountMaps {
    pub round: u8,
    pub round_amounts: HashMap<FieldElement, u128>,
    pub cumulative_amounts: HashMap<FieldElement, u128>,
}

/// A Merkle tree with extra allocation data for easier access
#[derive(Debug, Clone)]
pub struct MerkleTree {
    pub root: Node,
    pub allocations: Vec<CumulativeAllocation>,
}

/// Calldata to be used for the associated Cairo contract
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct CairoCalldata {
    /// The amount to claim
    pub amount: String,
    /// Merkle proof for the claim
    pub proof: Vec<String>,
}

/// Result for querying root data
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct RootQueryResult {
    /// The Merkle root for this round
    pub root: String,
    /// The accumulated amount of tokens to be distributed in a round. Includes amounts from all previous rounds
    pub accumulated_total_amount: String,
    /// The total amount of tokens to be distributed in a round. Includes amounts only from one round
    pub round_total_amount: String,
}

/// A node in a Merkle tree
#[derive(Debug, Clone)]
pub struct Node {
    pub left_child: Option<Box<Node>>,
    pub right_child: Option<Box<Node>>,
    pub accessible_addresses: HashSet<FieldElement>,
    pub value: FieldElement,
}

/// Data coming directly from raw JSONs
#[derive(Deserialize, Debug, Clone)]
pub struct JSONAllocation {
    pub address: String,
    pub amount: String,
}

/// Accumulated allocation data. Based on JSON data plus
#[derive(Debug, Clone)]
pub struct CumulativeAllocation {
    pub address: FieldElement,
    pub cumulative_amount: u128,
}

/// Information about a raw JSON file
#[derive(Debug, Clone)]
pub struct FileNameInfo {
    pub round: u8,
    pub full_path: String,
}
