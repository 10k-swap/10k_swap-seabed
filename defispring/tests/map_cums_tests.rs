/// This file tests the "map_cumulative_amounts" function
use defispring::api::{
    processor::map_cumulative_amounts,
    structs::{JSONAllocation, RoundAmounts},
};

#[test]
fn test_empty_data() {
    let drop: Vec<JSONAllocation> = vec![];

    let mut round_data: Vec<RoundAmounts> = Vec::new();
    round_data.push(RoundAmounts {
        round: 1u8,
        amounts: drop,
    });
    let res = map_cumulative_amounts(round_data);

    assert!(res.len() == 1);
    assert!(res[0].cumulative_amounts.len() == 0);
    assert!(res[0].round_amounts.len() == 0);
    assert!(res[0].round == 1_u8);
}

#[test]
fn test_cumulative_one_round() {
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
    let res = map_cumulative_amounts(round_data);

    assert!(res.len() == 1);
    assert!(res[0].cumulative_amounts.len() == 3);
    assert!(res[0].round_amounts.len() == 3);
    assert!(res[0].round == 1_u8);

    assert!(res[0].cumulative_amounts["0x1"] == 5_u128);
    assert!(res[0].cumulative_amounts["0x2"] == 6_u128);
    assert!(res[0].cumulative_amounts["0x3"] == 7_u128);

    assert!(res[0].round_amounts["0x1"] == 5_u128);
    assert!(res[0].round_amounts["0x2"] == 6_u128);
    assert!(res[0].round_amounts["0x3"] == 7_u128);
}

#[test]
fn test_cumulative_two_rounds() {
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
    let res = map_cumulative_amounts(round_data);

    assert!(res.len() == 2);

    assert!(res[0].cumulative_amounts.len() == 3);
    assert!(res[0].round_amounts.len() == 3);
    assert!(res[0].round == 1_u8);

    assert!(res[1].cumulative_amounts.len() == 3);
    assert!(res[1].round_amounts.len() == 1);
    assert!(res[1].round == 2_u8);

    assert!(res[0].cumulative_amounts["0x1"] == 5_u128);
    assert!(res[0].cumulative_amounts["0x2"] == 6_u128);
    assert!(res[0].cumulative_amounts["0x3"] == 7_u128);

    assert!(res[0].round_amounts["0x1"] == 5_u128);
    assert!(res[0].round_amounts["0x2"] == 6_u128);
    assert!(res[0].round_amounts["0x3"] == 7_u128);

    assert!(res[1].cumulative_amounts["0x1"] == 5_u128);
    assert!(res[1].cumulative_amounts["0x2"] == 6_u128);
    assert!(res[1].cumulative_amounts["0x3"] == 30_u128);

    assert!(!res[1].round_amounts.contains_key("0x1"));
    assert!(!res[1].round_amounts.contains_key("0x2"));
    assert!(res[1].round_amounts["0x3"] == 23_u128);
}

#[test]
fn test_cumulative_three_rounds() {
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
    drop3.push(JSONAllocation {
        address: "0x4".to_string(),
        amount: "50".to_string(),
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
    let res = map_cumulative_amounts(round_data);

    assert!(res.len() == 3);

    assert!(res[2].cumulative_amounts.len() == 4);
    assert!(res[2].round_amounts.len() == 2);
    assert!(res[2].round == 3_u8);

    assert!(res[2].round_amounts["0x2"] == 33_u128);
    assert!(res[2].round_amounts["0x4"] == 50_u128);

    assert!(res[2].cumulative_amounts["0x1"] == 5_u128);
    assert!(res[2].cumulative_amounts["0x2"] == 39_u128);
    assert!(res[2].cumulative_amounts["0x3"] == 30_u128);
    assert!(res[2].cumulative_amounts["0x4"] == 50_u128);

    assert!(!res[2].round_amounts.contains_key("0x1"));
    assert!(res[2].round_amounts["0x2"] == 33_u128);
    assert!(!res[2].round_amounts.contains_key("0x3"));
    assert!(res[2].round_amounts["0x4"] == 50_u128);
}

#[test]
fn test_skip_round() {
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
    let res = map_cumulative_amounts(round_data);

    assert!(res.len() == 2);

    assert!(res[0].cumulative_amounts.len() == 3);
    assert!(res[0].round_amounts.len() == 3);
    assert!(res[0].round == 1_u8);

    assert!(res[1].cumulative_amounts.len() == 3);
    assert!(res[1].round_amounts.len() == 1);
    assert!(res[1].round == 3_u8);

    assert!(res[0].cumulative_amounts["0x1"] == 5_u128);
    assert!(res[0].cumulative_amounts["0x2"] == 6_u128);
    assert!(res[0].cumulative_amounts["0x3"] == 7_u128);

    assert!(res[0].round_amounts["0x1"] == 5_u128);
    assert!(res[0].round_amounts["0x2"] == 6_u128);
    assert!(res[0].round_amounts["0x3"] == 7_u128);

    assert!(res[1].cumulative_amounts["0x1"] == 5_u128);
    assert!(res[1].cumulative_amounts["0x2"] == 39_u128);
    assert!(res[1].cumulative_amounts["0x3"] == 7_u128);

    assert!(!res[1].round_amounts.contains_key("0x1"));
    assert!(res[1].round_amounts["0x2"] == 33_u128);
    assert!(!res[1].round_amounts.contains_key("0x3"));
}
