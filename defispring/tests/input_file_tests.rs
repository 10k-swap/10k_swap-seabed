use defispring::api::processor::retrieve_valid_files;

/// Tests that only valid files are utilized
#[test]
fn file_names() {
    let path = "./tests/test_empty_input_files".to_string();
    let files = retrieve_valid_files(path.clone());
    let paths: Vec<String> = files.iter().map(|f| f.full_path.clone()).collect();

    // Valid files
    assert!(paths.contains(&(path.clone() + &"/raw_1.zip")));
    assert!(paths.contains(&(path.clone() + &"/raw_1.ZIP")));
    assert!(paths.contains(&(path.clone() + &"/RAW_1.ZIP")));
    assert!(paths.contains(&(path.clone() + &"/raw_100.zip")));

    // Invalid files
    assert!(!paths.contains(&(path.clone() + &"/raw_0.zip")));
    assert!(!paths.contains(&(path.clone() + &"/raw_1.json")));
    assert!(!paths.contains(&(path.clone() + &"/raw_1.JSON")));
    assert!(!paths.contains(&(path.clone() + &"/raw_1.json.zip")));
    assert!(!paths.contains(&(path.clone() + &"/raw-1.zip")));
    assert!(!paths.contains(&(path.clone() + &"/xraw_1.zip")));
}
