use starknet_crypto::{pedersen_hash, poseidon_hash, FieldElement};
use std::str::FromStr;

use defispring::api::structs::{CairoCalldata, CumulativeAllocation, MerkleTree};

// mockup of a function that will be used in the SC
// root will not be passed as an argument but stored in the SC
fn cairo_root_generating(
    original_address: String,
    original_calldata: CairoCalldata,
    root: FieldElement,
) -> bool {
    if original_calldata.proof.len() < 1 || original_calldata.amount.len() < 1 {
        println!("Wrong parameters");
        return false;
    }

    let amount = FieldElement::from_str(&original_calldata.amount).unwrap();
    let address = FieldElement::from_str(&original_address).unwrap();

    // leaf is hashed address and amount (base16)
    let mut hash_value = poseidon_hash(address, amount);

    println!("{}", hash_value);

    let mut proof = original_calldata.proof.clone();

    loop {
        if proof.len() == 0 {
            break;
        }
        let next_hash = FieldElement::from_str(&proof.remove(0)).unwrap();
        if hash_value.lt(&next_hash) {
            hash_value = pedersen_hash(&hash_value, &next_hash);
        } else {
            hash_value = pedersen_hash(&next_hash, &hash_value);
        }
        println!("{}", hash_value);
    }
    println!("Root: {}", root);

    if hash_value.eq(&root) {
        println!("Sending {} to the address {}", amount, address);
        return true;
    } else {
        println!("Hacking attempt!");
        return false;
    }
}

// Tests that the tree gets generated correctly
#[test]
fn valid_addresses() {
    let mut allocations = Vec::<CumulativeAllocation>::new();
    allocations.push(CumulativeAllocation {
        address: "0x1".to_string(),
        cumulative_amount: 1,
    });
    allocations.push(CumulativeAllocation {
        address: "0x2".to_string(),
        cumulative_amount: 2,
    });
    allocations.push(CumulativeAllocation {
        address: "0x3".to_string(),
        cumulative_amount: 3,
    });

    let mt = MerkleTree::new(allocations.clone());
    let root = mt.root.value.clone();

    for alloc in allocations.iter() {
        let calldata = mt
            .address_calldata(&alloc.address)
            .expect("Failed getting calldata");
        assert!(cairo_root_generating(
            alloc.address.clone(),
            calldata,
            root.clone()
        ));
    }
}

/// Tests that using incorrect addresses fails to generate a tree
#[test]
fn fail_with_random_addresses() {
    let mut allocations = Vec::<CumulativeAllocation>::new();
    allocations.push(CumulativeAllocation {
        address: "0x123q".to_string(),
        cumulative_amount: 1,
    });

    let mut result = std::panic::catch_unwind(|| MerkleTree::new(allocations.clone()));
    assert!(result.is_err());

    allocations = Vec::<CumulativeAllocation>::new();
    allocations.push(CumulativeAllocation {
        address: "123h".to_string(),
        cumulative_amount: 1,
    });

    result = std::panic::catch_unwind(|| MerkleTree::new(allocations.clone()));
    assert!(result.is_err());

    allocations = Vec::<CumulativeAllocation>::new();
    allocations.push(CumulativeAllocation {
        address: "5.6".to_string(),
        cumulative_amount: 1,
    });

    result = std::panic::catch_unwind(|| MerkleTree::new(allocations.clone()));
    assert!(result.is_err());
}

/// Tests that empty data fails to generate a tree
#[test]
fn fail_with_no_data() {
    let allocations = Vec::<CumulativeAllocation>::new();

    let result = std::panic::catch_unwind(|| MerkleTree::new(allocations.clone()));
    assert!(result.is_err());
}

/// Tests that modifying the calldata fails
#[test]
fn fail_with_calldata_tempering() {
    let mut allocations = Vec::<CumulativeAllocation>::new();
    allocations.push(CumulativeAllocation {
        address: "0x1".to_string(),
        cumulative_amount: 1,
    });
    allocations.push(CumulativeAllocation {
        address: "0x2".to_string(),
        cumulative_amount: 2,
    });
    allocations.push(CumulativeAllocation {
        address: "0x3".to_string(),
        cumulative_amount: 3,
    });

    let mt = MerkleTree::new(allocations.clone());

    let hacked_amount = 10_u128;
    let root = mt.root.value.clone();

    for alloc in allocations.iter() {
        let mut calldata = mt
            .address_calldata(&alloc.address)
            .expect("Failed getting calldata");
        calldata.amount = hacked_amount.to_string();

        assert!(!cairo_root_generating(
            alloc.address.clone(),
            calldata,
            root.clone()
        ));
    }
}
