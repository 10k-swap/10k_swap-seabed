/// This file tests the function "read_allocations"
use std::{
    fs::{self, File},
    io::{Read, Write},
    panic,
    path::Path,
};

use defispring::api::processor::read_allocations;
use zip::{write::FileOptions, CompressionMethod, ZipWriter};

/// Single valid file
#[test]
fn valid_single_file() {
    let path = "./tests/test_data_input_files/valid".to_string();

    zip_files(&path);

    let files = read_allocations(path.clone());

    remove_zips(&path);

    assert!(files.len() == 1);
    assert!(files[0].accumulated_total_amount == 340282366920938463463374607431768211 + 700);
    assert!(files[0].round_total_amount == 340282366920938463463374607431768211 + 700);
    assert!(files[0].round == 1);
}

/// Single file with invalid contents
#[test]
fn invalid_single_file() {
    let path = "./tests/test_data_input_files/invalid_contents".to_string();

    zip_files(&path);

    let result = panic::catch_unwind(|| read_allocations(path.clone()));
    assert!(result.is_err());

    remove_zips(&path);
}

/// Single file with incorrect zip file
#[test]
fn invalid_zip_file() {
    let path = "./tests/test_data_input_files/invalid_zip_file".to_string();

    let result = panic::catch_unwind(|| read_allocations(path.clone()));
    assert!(result.is_err());
}

/// Removes all ZIP files
fn remove_zips(folder: &String) {
    for entry in fs::read_dir(folder).unwrap() {
        let entry = entry.unwrap();
        let path = entry.path();
        if path.is_dir() {
            remove_zips(&path.to_str().unwrap().to_string());
        } else if path.extension().unwrap() == "zip" {
            fs::remove_file(path).unwrap();
        }
    }
}

/// Zips all files in a folder
fn zip_files(folder: &String) {
    let path = Path::new(&folder);
    for entry in path.read_dir().expect("read_dir call failed") {
        if let Ok(entry) = entry {
            let input_file: String = entry.file_name().to_str().unwrap().to_string();
            let output_file = format!(
                "{}/{}.zip",
                folder,
                Path::new(&entry.file_name())
                    .file_stem()
                    .unwrap()
                    .to_string_lossy()
            );
            // Specify compression options
            let options = FileOptions::default().compression_method(CompressionMethod::Deflated);

            // Open the file you want to add to the ZIP archive
            let file_to_zip = File::open(entry.path()).unwrap();
            let mut buffer = Vec::new();
            file_to_zip.take(1024).read_to_end(&mut buffer).unwrap();

            let file = File::create(output_file).unwrap();
            let mut zip = ZipWriter::new(file);

            // Add the file to the ZIP archive
            zip.start_file(input_file.to_string(), options).unwrap();

            // Write the contents of the file to the ZIP archive
            zip.write_all(&buffer).unwrap();

            // Finish writing the ZIP archive
            zip.finish().unwrap();
        }
    }
}
