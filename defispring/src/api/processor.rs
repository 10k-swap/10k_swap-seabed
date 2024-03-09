use regex::Regex;
use serde_json::from_slice;
use std::{collections::HashMap, fs::File, io::Read, path::Path};

use super::{
    data_storage::get_all_data,
    merkle_tree::felt_to_b16,
    structs::{
        CairoCalldata, CumulativeAllocation, FileNameInfo, JSONAllocation, MerkleTree,
        RootQueryResult, RoundAmountMaps, RoundAmounts, RoundTreeData,
    },
};
use zip::ZipArchive;

pub fn get_raw_calldata(round: Option<u8>, address: &String) -> Result<CairoCalldata, String> {
    let relevant_data = match get_round_data(round) {
        Ok(value) => value,
        Err(value) => {
            return Err(value);
        }
    };

    let calldata: CairoCalldata = match relevant_data.tree.address_calldata(&address) {
        Ok(v) => v,
        Err(value) => {
            return Err(value);
        }
    };
    Ok(calldata)
}

pub fn get_raw_allocation_amount(round: Option<u8>, address: &String) -> Result<u128, String> {
    let relevant_data = match get_round_data(round) {
        Ok(value) => value,
        Err(value) => return Err(value),
    };

    let drop = match relevant_data
        .tree
        .allocations
        .iter()
        .find(|a| a.address.to_lowercase() == address.to_lowercase())
    {
        Some(v) => v,
        None => return Ok(0_u128),
    };

    Ok(drop.cumulative_amount)
}

pub fn get_raw_root(round: Option<u8>) -> Result<RootQueryResult, String> {
    let relevant_data = match get_round_data(round) {
        Ok(value) => value,
        Err(value) => return Err(value),
    };
    let res = RootQueryResult {
        root: felt_to_b16(&relevant_data.tree.root.value),
        accumulated_total_amount: relevant_data.accumulated_total_amount,
        round_total_amount: relevant_data.round_total_amount,
    };
    Ok(res)
}

// Gets data for a specific round
fn get_round_data(round: Option<u8>) -> Result<RoundTreeData, String> {
    let round_data = get_all_data();
    // Use round if it's provided. Otherwise use the latest round
    let use_round = match round {
        Some(v) => v,
        None => match round_data.iter().max_by_key(|&p| p.round) {
            None => return Err("No allocation data found".to_string()),
            Some(p) => p.round,
        },
    };
    let relevant_data: Vec<RoundTreeData> = round_data
        .iter()
        .filter(|&p| p.round == use_round)
        .cloned()
        .collect();
    if relevant_data.len() != 1 {
        return Err("No allocation data available".to_string());
    }
    Ok(relevant_data.get(0).unwrap().clone())
}

/// Converts JSON allocation data into cumulative tree+data per round
pub fn transform_allocations_to_cumulative_rounds(
    mut allocations: Vec<RoundAmounts>,
) -> Vec<RoundTreeData> {
    if allocations.len() == 0 {
        return Vec::new();
    }
    allocations.sort_by(|a, b| a.round.cmp(&b.round));

    let cumulative_amount_maps = map_cumulative_amounts(allocations);

    let mut accumulated_total_amount = 0_u128;

    let mut rounds: Vec<RoundTreeData> = Vec::new();
    for cum_map in cumulative_amount_maps.iter() {
        let mut curr_round_data: Vec<CumulativeAllocation> = Vec::new();
        let mut round_total_amount = 0_u128;

        // The cumulative map has all addresses that have any allocation in this round and all previous rounds
        for key in cum_map.cumulative_amounts.keys() {
            let address_cumulative = CumulativeAllocation {
                address: key.to_string().to_lowercase(),
                cumulative_amount: cum_map.cumulative_amounts[key],
            };
            // If this round has this address add its amount to the round total amount
            if cum_map.round_amounts.contains_key(key) {
                round_total_amount += cum_map.round_amounts[key];
            }
            curr_round_data.push(address_cumulative);
        }
        accumulated_total_amount += round_total_amount;

        if curr_round_data.len() > 0 {
            // Sort because hashmap iterator returns keys in arbitrary order
            curr_round_data.sort_by(|a, b| a.address.to_lowercase().cmp(&b.address.to_lowercase()));

            let tree = MerkleTree::new(curr_round_data);

            let round_drop = RoundTreeData {
                round: cum_map.round,
                tree: tree,
                accumulated_total_amount: accumulated_total_amount,
                round_total_amount: round_total_amount,
            };

            println!(
                "Extracted data from round {:?}: 
                Round total token amount: {:?}, 
                Cumulative token amount: {:?}",
                cum_map.round, round_drop.round_total_amount, round_drop.accumulated_total_amount
            );

            rounds.push(round_drop);
        }
    }
    rounds
}

/// Converts JSON allocation data into cumulative map-per-round data
pub fn map_cumulative_amounts(allocations: Vec<RoundAmounts>) -> Vec<RoundAmountMaps> {
    let mut all_rounds_cums: HashMap<String, u128> = HashMap::new();
    let mut round_maps: Vec<RoundAmountMaps> = Vec::new();

    for allocation in allocations.iter() {
        let mut curr_round_amounts: HashMap<String, u128> = HashMap::new();

        for data in allocation.amounts.iter() {
            let amount = match data.amount.parse::<u128>() {
                Ok(value) => value,
                Err(_) => 0_u128, // If number is invalid assign 0
            };

            *curr_round_amounts
                .entry(data.address.to_lowercase().clone())
                .or_insert_with(|| 0) += amount;

            *all_rounds_cums
                .entry(data.address.to_lowercase().clone())
                .or_insert_with(|| 0) += amount;
        }
        let map = RoundAmountMaps {
            round: allocation.round,
            round_amounts: curr_round_amounts,
            cumulative_amounts: all_rounds_cums.clone(),
        };

        round_maps.push(map);
    }

    round_maps
}

// Reads and accumulates all allocation info for all rounds
pub fn read_allocations(filepath: String) -> Vec<RoundTreeData> {
    let files = retrieve_valid_files(filepath);
    let mut round_amounts: Vec<RoundAmounts> = vec![];

    for file in files.iter() {
        let zipfile = File::open(file.clone().full_path).expect("Failed to open zip file");
        let mut archive: zip::ZipArchive<File> = ZipArchive::<File>::new(zipfile).unwrap();
        if archive.len() > 0 {
            // Only read the first file in the zip archive
            let mut archive_file = archive.by_index(0).unwrap();
            let mut buffer = Vec::new();
            archive_file
                .read_to_end(&mut buffer)
                .expect("problem reading zip");

            let allocation: Vec<JSONAllocation> =
                from_slice(&buffer).expect("Failed to deserialize allocation");

            let round_amount = RoundAmounts {
                amounts: allocation.clone(),
                round: file.round,
            };
            round_amounts.push(round_amount);
        }
    }
    transform_allocations_to_cumulative_rounds(round_amounts)
}

/// Returns all files that have the correct filename syntax
pub fn retrieve_valid_files(filepath: String) -> Vec<FileNameInfo> {
    let mut valid_files: Vec<FileNameInfo> = vec![];
    let path = Path::new(&filepath);

    // Case in-sensitive, find pattern
    let template_pattern = r"(?i)^raw_(\d+)\.zip$";
    let regex = Regex::new(&template_pattern).expect("Invalid regex pattern");

    for entry in path.read_dir().expect("read_dir call failed") {
        if let Ok(entry) = entry {
            if let Some(captures) = regex.captures(entry.file_name().to_str().unwrap()) {
                // Collect valid file names
                if let Some(round) = captures.get(1) {
                    // Don't allow 0 round
                    if round.as_str() != "0".to_string() {
                        let fileinfo = FileNameInfo {
                            full_path: entry.path().to_str().unwrap().to_string(),
                            round: round.as_str().parse::<u8>().unwrap(),
                        };
                        valid_files.push(fileinfo);
                    }
                }
            }
        }
    }
    println!("Found {} valid input files", valid_files.len());
    valid_files
}

impl RoundTreeData {
    /// Retrieve allocated amount for an address in a specific round
    pub fn address_amount(&self, address: &str) -> Result<u128, String> {
        let address_drop: Vec<CumulativeAllocation> = self
            .tree
            .allocations
            .iter()
            .filter(|a| a.address.to_lowercase() == address.to_lowercase())
            .cloned()
            .collect();

        if address_drop.len() == 0 {
            Ok(0_u128)
        } else {
            Ok(address_drop.get(0).unwrap().cumulative_amount)
        }
    }
}
