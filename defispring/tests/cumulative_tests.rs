use defispring::api::{
    processor::transform_allocations_to_cumulative_rounds,
    structs::{JSONAllocation, RoundAmounts},
};
use starknet_crypto::FieldElement;
use std::str::FromStr;

#[test]
fn test_odd_data() {
    let one: FieldElement = FieldElement::from_str("0x1").unwrap();
    let two: FieldElement = FieldElement::from_str("0x2").unwrap();

    let mut drop: Vec<JSONAllocation> = vec![];
    drop.push(JSONAllocation {
        address: "".to_string(),
        amount: "0".to_string(),
    });
    drop.push(JSONAllocation {
        address: "0x1".to_string(),
        amount: "0".to_string(),
    });

    let mut round_data: Vec<RoundAmounts> = Vec::new();
    round_data.push(RoundAmounts {
        round: 1u8,
        amounts: drop,
    });
    let res = transform_allocations_to_cumulative_rounds(round_data);

    assert!(res[0].address_amount(one).unwrap() == 0_u128);
    assert!(res[0].address_amount(two).unwrap() == 0_u128);
}

#[test]
fn test_empty_data() {
    let drop: Vec<JSONAllocation> = vec![];

    let mut round_data: Vec<RoundAmounts> = Vec::new();
    round_data.push(RoundAmounts {
        round: 1u8,
        amounts: drop,
    });
    let res = transform_allocations_to_cumulative_rounds(round_data);

    assert!(res.len() == 0);
}

#[test]
fn test_cumulative_one_round() {
    let one: FieldElement = FieldElement::from_str("0x1").unwrap();
    let two: FieldElement = FieldElement::from_str("0x2").unwrap();
    let three: FieldElement = FieldElement::from_str("0x3").unwrap();

    let mut drop: Vec<JSONAllocation> = vec![];
    drop.push(JSONAllocation {
        address: "0x1".to_string(),
        amount: "5".to_string(),
    });
    drop.push(JSONAllocation {
        address: "0x2".to_string(),
        amount: "6".to_string(),
    });
    drop.push(JSONAllocation {
        address: "0x3".to_string(),
        amount: "7".to_string(),
    });

    let mut round_data: Vec<RoundAmounts> = Vec::new();
    round_data.push(RoundAmounts {
        round: 1u8,
        amounts: drop,
    });
    let res = transform_allocations_to_cumulative_rounds(round_data);

    assert!(res[0].address_amount(one).unwrap() == 5_u128);
    assert!(res[0].address_amount(two).unwrap() == 6_u128);
    assert!(res[0].address_amount(three).unwrap() == 7_u128);
}

#[test]
fn test_cumulative_two_rounds() {
    let one: FieldElement = FieldElement::from_str("0x1").unwrap();
    let two: FieldElement = FieldElement::from_str("0x2").unwrap();
    let three: FieldElement = FieldElement::from_str("0x3").unwrap();

    let mut drop1: Vec<JSONAllocation> = vec![];
    let mut drop2: Vec<JSONAllocation> = vec![];
    drop1.push(JSONAllocation {
        address: "0x1".to_string(),
        amount: "5".to_string(),
    });
    drop1.push(JSONAllocation {
        address: "0x2".to_string(),
        amount: "6".to_string(),
    });
    drop1.push(JSONAllocation {
        address: "0x3".to_string(),
        amount: "7".to_string(),
    });
    drop2.push(JSONAllocation {
        address: "0x3".to_string(),
        amount: "23".to_string(),
    });

    let mut round_data: Vec<RoundAmounts> = Vec::new();
    round_data.push(RoundAmounts {
        round: 1u8,
        amounts: drop1,
    });
    round_data.push(RoundAmounts {
        round: 2u8,
        amounts: drop2,
    });
    let res = transform_allocations_to_cumulative_rounds(round_data);

    assert!(res[0].address_amount(one).unwrap() == 5_u128);
    assert!(res[0].address_amount(two).unwrap() == 6_u128);
    assert!(res[0].address_amount(three).unwrap() == 7_u128);

    assert!(res[1].address_amount(one).unwrap() == 5_u128);
    assert!(res[1].address_amount(two).unwrap() == 6_u128);
    assert!(res[1].address_amount(three).unwrap() == 30_u128);
}

#[test]
fn test_cumulative_three_rounds() {
    let one: FieldElement = FieldElement::from_str("0x1").unwrap();
    let two: FieldElement = FieldElement::from_str("0x2").unwrap();
    let three: FieldElement = FieldElement::from_str("0x3").unwrap();

    let mut drop1: Vec<JSONAllocation> = vec![];
    let mut drop2: Vec<JSONAllocation> = vec![];
    let mut drop3: Vec<JSONAllocation> = vec![];
    drop1.push(JSONAllocation {
        address: "0x1".to_string(),
        amount: "5".to_string(),
    });
    drop1.push(JSONAllocation {
        address: "0x2".to_string(),
        amount: "6".to_string(),
    });
    drop1.push(JSONAllocation {
        address: "0x3".to_string(),
        amount: "7".to_string(),
    });
    drop2.push(JSONAllocation {
        address: "0x3".to_string(),
        amount: "23".to_string(),
    });
    drop3.push(JSONAllocation {
        address: "0x2".to_string(),
        amount: "33".to_string(),
    });

    let mut round_data: Vec<RoundAmounts> = Vec::new();
    round_data.push(RoundAmounts {
        round: 1u8,
        amounts: drop1,
    });
    round_data.push(RoundAmounts {
        round: 2u8,
        amounts: drop2,
    });
    round_data.push(RoundAmounts {
        round: 3u8,
        amounts: drop3,
    });
    let res = transform_allocations_to_cumulative_rounds(round_data);

    assert!(res[0].address_amount(one).unwrap() == 5_u128);
    assert!(res[0].address_amount(two).unwrap() == 6_u128);
    assert!(res[0].address_amount(three).unwrap() == 7_u128);

    assert!(res[1].address_amount(one).unwrap() == 5_u128);
    assert!(res[1].address_amount(two).unwrap() == 6_u128);
    assert!(res[1].address_amount(three).unwrap() == 30_u128);

    assert!(res[2].address_amount(one).unwrap() == 5_u128);
    assert!(res[2].address_amount(two).unwrap() == 39_u128);
    assert!(res[2].address_amount(three).unwrap() == 30_u128);
}

#[test]
fn test_skip_round() {
    let one: FieldElement = FieldElement::from_str("0x1").unwrap();
    let two: FieldElement = FieldElement::from_str("0x2").unwrap();
    let three: FieldElement = FieldElement::from_str("0x3").unwrap();

    let mut drop1: Vec<JSONAllocation> = vec![];
    let mut drop3: Vec<JSONAllocation> = vec![];
    drop1.push(JSONAllocation {
        address: "0x1".to_string(),
        amount: "5".to_string(),
    });
    drop1.push(JSONAllocation {
        address: "0x2".to_string(),
        amount: "6".to_string(),
    });
    drop1.push(JSONAllocation {
        address: "0x3".to_string(),
        amount: "7".to_string(),
    });
    drop3.push(JSONAllocation {
        address: "0x2".to_string(),
        amount: "33".to_string(),
    });

    let mut round_data: Vec<RoundAmounts> = Vec::new();
    round_data.push(RoundAmounts {
        round: 1u8,
        amounts: drop1,
    });
    round_data.push(RoundAmounts {
        round: 3u8,
        amounts: drop3,
    });
    let res = transform_allocations_to_cumulative_rounds(round_data);

    assert!(res[0].round == 1u8);
    assert!(res[1].round == 3u8);

    assert!(res[0].address_amount(one).unwrap() == 5_u128);
    assert!(res[0].address_amount(two).unwrap() == 6_u128);
    assert!(res[0].address_amount(three).unwrap() == 7_u128);

    assert!(res[1].address_amount(one).unwrap() == 5_u128);
    assert!(res[1].address_amount(two).unwrap() == 39_u128);
    assert!(res[1].address_amount(three).unwrap() == 7_u128);
}

/// Tests big allocation amounts
#[test]
fn test_big_amounts() {
    let one: FieldElement = FieldElement::from_str("0x1").unwrap();
    let two: FieldElement = FieldElement::from_str("0x2").unwrap();

    let mut drop: Vec<JSONAllocation> = vec![];
    drop.push(JSONAllocation {
        address: "0x1".to_string(),
        amount: (u128::MAX / 2).to_string(),
    });
    drop.push(JSONAllocation {
        address: "0x2".to_string(),
        amount: (u128::MAX / 2 - 5).to_string(),
    });
    drop.push(JSONAllocation {
        address: "0x2".to_string(),
        amount: "3".to_string(),
    });

    let mut round_data: Vec<RoundAmounts> = Vec::new();
    round_data.push(RoundAmounts {
        round: 1u8,
        amounts: drop,
    });
    let res = transform_allocations_to_cumulative_rounds(round_data);

    assert!(res[0].address_amount(one).unwrap() == u128::MAX / 2);
    assert!(res[0].address_amount(two).unwrap() == u128::MAX / 2 - 2);
}
