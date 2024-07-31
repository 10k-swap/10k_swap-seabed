use std::str::FromStr;

use defispring::api::structs::{CumulativeAllocation, MerkleTree, RoundTreeData};
use starknet_crypto::FieldElement;

/// Tests the "address_amount" function
#[test]
fn normal_address_amount() {
    let first = FieldElement::from_str("0x1").unwrap();
    let second = FieldElement::from_str("0x2a").unwrap();
    let third = FieldElement::from_str("0x3").unwrap();

    let mut allocations = Vec::<CumulativeAllocation>::new();
    allocations.push(CumulativeAllocation {
        address: first,
        cumulative_amount: 1,
    });
    allocations.push(CumulativeAllocation {
        address: second,
        cumulative_amount: 2,
    });
    allocations.push(CumulativeAllocation {
        address: third,
        cumulative_amount: 3,
    });

    let round_data = RoundTreeData {
        round: 1_u8,
        accumulated_total_amount: 10_u128,
        round_total_amount: 6_u128,
        tree: MerkleTree::new(allocations),
    };

    assert!(round_data.address_amount(first).unwrap() == 1_u128);
    assert!(round_data.address_amount(third).unwrap() == 3_u128);

    // no address results in zero data
    assert!(
        round_data
            .address_amount(FieldElement::from_str("0x4").unwrap())
            .unwrap()
            == 0_u128
    );

    // casing doesn't matter
    assert!(
        round_data
            .address_amount(FieldElement::from_str("0x2A").unwrap())
            .unwrap()
            == 2_u128
    );
    assert!(
        round_data
            .address_amount(FieldElement::from_str("0x2a").unwrap())
            .unwrap()
            == 2_u128
    );
}

/// Tests fields in various formats
#[test]
fn various_format_field_parsing() {
    let mut same = vec![];
    same.push(FieldElement::from_str("0x005").unwrap());
    same.push(FieldElement::from_str("0x5").unwrap());
    same.push(FieldElement::from_str("5").unwrap());
    same.push(FieldElement::from_str("0x00000005").unwrap());

    for val in same.iter() {
        assert!(val.to_string() == "5".to_string());
    }
}
