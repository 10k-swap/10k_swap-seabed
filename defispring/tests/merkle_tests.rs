use starknet_crypto::{pedersen_hash, poseidon_hash, FieldElement};
use std::str::FromStr;

use defispring::api::structs::{CairoCalldata, CumulativeAllocation, MerkleTree};

// mockup of a function that will be used in the SC
// root will not be passed as an argument but stored in the SC
fn cairo_root_generating(
    original_address: FieldElement,
    original_calldata: CairoCalldata,
    root: FieldElement,
) -> bool {
    if original_calldata.proof.len() < 1 || original_calldata.amount.len() < 1 {
        println!("Wrong parameters");
        return false;
    }

    let amount = FieldElement::from_str(&original_calldata.amount).unwrap();

    // leaf is hashed address and amount (base16)
    let mut hash_value = poseidon_hash(original_address, amount);

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
        println!("Sending {} to the address {}", amount, original_address);
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
        address: FieldElement::from_str("0x1").unwrap(),
        cumulative_amount: 1,
    });
    allocations.push(CumulativeAllocation {
        address: FieldElement::from_str("0x2").unwrap(),
        cumulative_amount: 2,
    });
    allocations.push(CumulativeAllocation {
        address: FieldElement::from_str("0x3").unwrap(),
        cumulative_amount: 3,
    });

    let mt = MerkleTree::new(allocations.clone());
    let root = mt.root.value.clone();

    for alloc in allocations.iter() {
        let str = FieldElement::to_string(&alloc.address);
        let calldata = mt.address_calldata(&str).expect("Failed getting calldata");
        assert!(cairo_root_generating(
            alloc.address.clone(),
            calldata,
            root.clone()
        ));
    }
}

/// Tests that empty data fails to generate a tree
#[test]
fn fail_with_no_data() {
    let allocations = Vec::<CumulativeAllocation>::new();

    let result = std::panic::catch_unwind(|| MerkleTree::new(allocations.clone()));
    assert!(result.is_err());
}

// Fails for wrongly formatted addresses
#[test]
fn invalid_calldata_address() {
    let mut allocations = Vec::<CumulativeAllocation>::new();
    allocations.push(CumulativeAllocation {
        address: FieldElement::from_str("0x1").unwrap(),
        cumulative_amount: 1,
    });

    let mt = MerkleTree::new(allocations.clone());

    assert_eq!(
        mt.address_calldata("blah").unwrap_err(),
        "invalid character"
    );
    assert_eq!(mt.address_calldata("0xq").unwrap_err(), "invalid character");
    assert_eq!(mt.address_calldata("1q").unwrap_err(), "invalid character");
}

/// Tests that modifying the calldata fails
#[test]
fn fail_with_calldata_tempering() {
    let mut allocations = Vec::<CumulativeAllocation>::new();
    allocations.push(CumulativeAllocation {
        address: FieldElement::from_str("0x1").unwrap(),
        cumulative_amount: 1,
    });
    allocations.push(CumulativeAllocation {
        address: FieldElement::from_str("0x2").unwrap(),
        cumulative_amount: 2,
    });
    allocations.push(CumulativeAllocation {
        address: FieldElement::from_str("0x3").unwrap(),
        cumulative_amount: 3,
    });

    let mt = MerkleTree::new(allocations.clone());

    let hacked_amount = 10_u128;
    let root = mt.root.value.clone();

    for alloc in allocations.iter() {
        let str = FieldElement::to_string(&alloc.address);
        let mut calldata = mt.address_calldata(&str).expect("Failed getting calldata");
        calldata.amount = hacked_amount.to_string();

        assert!(!cairo_root_generating(
            alloc.address.clone(),
            calldata,
            root.clone()
        ));
    }
}
