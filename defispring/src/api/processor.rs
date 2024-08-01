use rayon::prelude::*;
use regex::Regex;
use serde_json::from_slice;
use starknet_crypto::FieldElement;
use std::{collections::HashMap, fs::File, io::Read, path::Path, str::FromStr};

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

    let field: FieldElement = FieldElement::from_str(address).expect("Invalid address");

    let drop = match relevant_data
        .tree
        .allocations
        .iter()
        .find(|a| a.address == field)
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
        accumulated_total_amount: relevant_data.accumulated_total_amount.to_string(),
        round_total_amount: relevant_data.round_total_amount.to_string(),
    };
    Ok(res)
}

// Gets data for a specific round
fn get_round_data(round: Option<u8>) -> Result<RoundTreeData, String> {
    let use_round;
    {
        let round_data = get_all_data();

        use_round = match round {
            Some(v) => v,
            None => match round_data.iter().max_by_key(|p| p.round) {
                None => return Err("No allocation data found".to_string()),
                Some(p) => p.round,
            },
        };
    }

    let round_data = get_all_data();
    let relevant_data = round_data.iter().find(|&p| p.round == use_round);

    match relevant_data {
        Some(data) => Ok(data.clone()),
        None => Err("No allocation data available".to_string()),
    }
}

/// Converts JSON allocation data into cumulative tree+data per round
pub fn transform_allocations_to_cumulative_rounds(
    mut allocations: Vec<RoundAmounts>,
) -> Vec<RoundTreeData> {
    if allocations.is_empty() {
        return Vec::new();
    }

    allocations.sort_by_key(|a| a.round);

    let cumulative_amount_maps = map_cumulative_amounts(allocations);

    let results: Vec<_> = cumulative_amount_maps
        .par_iter()
        .map(|cum_map| {
            let mut round_total_amount = 0_u128;

            let curr_round_data: Vec<CumulativeAllocation> = cum_map
                .cumulative_amounts
                .iter()
                .map(|(&address, &cumulative_amount)| {
                    let amount = cum_map.round_amounts.get(&address).copied().unwrap_or(0);
                    round_total_amount += amount;
                    CumulativeAllocation {
                        address,
                        cumulative_amount,
                    }
                })
                .collect();

            let mut sorted_curr_round_data = curr_round_data;
            sorted_curr_round_data.sort_by_key(|a| a.address);

            let tree = MerkleTree::new(sorted_curr_round_data);

            (cum_map.round, tree, round_total_amount)
        })
        .collect();

    let mut accumulated_total_amount = 0_u128;
    let mut rounds = Vec::with_capacity(results.len());

    for (round, tree, round_total_amount) in results {
        accumulated_total_amount += round_total_amount;

        let round_drop = RoundTreeData {
            round,
            tree,
            accumulated_total_amount,
            round_total_amount,
        };

        println!(
            "Extracted data from round {:?}: 
            Round total token amount: {:?}, 
            Cumulative token amount: {:?}",
            round, round_drop.round_total_amount, round_drop.accumulated_total_amount
        );

        rounds.push(round_drop);
    }

    rounds
}

/// Converts JSON allocation data into cumulative map-per-round data
pub fn map_cumulative_amounts(allocations: Vec<RoundAmounts>) -> Vec<RoundAmountMaps> {
    let mut all_rounds_cums: HashMap<FieldElement, u128> = HashMap::new();
    let mut round_maps: Vec<RoundAmountMaps> = Vec::new();

    for allocation in allocations.iter() {
        let mut curr_round_amounts: HashMap<FieldElement, u128> = HashMap::new();

        for data in allocation.amounts.iter() {
            let amount = match data.amount.parse::<u128>() {
                Ok(value) => value,
                Err(_) => 0_u128, // If number is invalid assign 0
            };

            let field = FieldElement::from_str(&data.address).unwrap();

            *curr_round_amounts.entry(field).or_insert_with(|| 0) += amount;
            *all_rounds_cums.entry(field).or_insert_with(|| 0) += amount;
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
    pub fn address_amount(&self, address: FieldElement) -> Result<u128, String> {
        let address_drop = self.tree.allocations.iter().find(|&a| a.address == address);

        match address_drop {
            Some(drop) => Ok(drop.cumulative_amount),
            None => Ok(0_u128),
        }
    }
}
