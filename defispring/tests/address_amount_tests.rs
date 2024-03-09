use defispring::api::structs::{CumulativeAllocation, MerkleTree, RoundTreeData};

/// Tests the "address_amount" function
#[test]
fn normal_address_amount() {
    let mut allocations = Vec::<CumulativeAllocation>::new();
    allocations.push(CumulativeAllocation {
        address: "0x1".to_string(),
        cumulative_amount: 1,
    });
    allocations.push(CumulativeAllocation {
        address: "0x2a".to_string(),
        cumulative_amount: 2,
    });
    allocations.push(CumulativeAllocation {
        address: "0x3".to_string(),
        cumulative_amount: 3,
    });

    let round_data = RoundTreeData {
        round: 1_u8,
        accumulated_total_amount: 10_u128,
        round_total_amount: 6_u128,
        tree: MerkleTree::new(allocations),
    };

    assert!(round_data.address_amount("0x1").unwrap() == 1_u128);
    assert!(round_data.address_amount("0x3").unwrap() == 3_u128);

    // no address results in zero data
    assert!(round_data.address_amount("0x4").unwrap() == 0_u128);

    // casing doesn't matter
    assert!(round_data.address_amount("0x2A").unwrap() == 2_u128);
    assert!(round_data.address_amount("0x2A").unwrap() == 2_u128);
}
