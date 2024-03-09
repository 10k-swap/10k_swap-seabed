# Backend documentation

The backend is written in Rust. Running the project launches a REST API that can be used to generate allocation data.

## Deployment

The backend can be run in a Docker container. It can be be deployed to any cloud architecture that supports containers, it is expected that it will be run behind a reverse proxy that provides e.g. HTTPS.

```
$ cd backend
$ docker build -t allocation-backend
$ docker run -v DIR_WITH_INPUT_ZIP:/app/raw_input -p 8080:8080 allocation-backend
```

Make sure that DIR_WITH_INPUT_ZIP is a folder on your machine that contains .zip files with the allocation specifications. These .zip files are processed on the container start.

TODO: push Docker image to a registry.

You can naturally also run it like any other compiled program; use `cargo build --release ` to build it and then use the binary in target/.

## Startup time

As the whole tree is built on startup and saved in memory, startup can take tens of minutes, up to hours on very slow hardware and/or big trees.

## Running the project locally for testing purposes

You can launch the API locally by first installing Rust and then running `cargo run`. The API will be available at http://127.0.0.1:8080 .

## Endpoints

The endpoints are documented with OpenAPI documentation. A Swagger UI is generated on top of the documentation at address /swagger-ui/ (remember the last /) when running the APIs somewhere.

The Swagger UI can be used also to test the endpoints.

An example deployment, with Swagger UI, can be found at TODO.

## Concepts

The project utilizies the following concepts:

- _round_: Allocations are organized in various rounds. One round can contain any number of allocations for addresses. Typically rounds start from 1 but as long as the number is increasing you can start from any (small) number.
- _root_: Refers to the root of a Merkle tree. This root dictates which addresses are eligible for how many tokens. One root exists for one round.

## Adding new data for allocations

Once you launch the backend the program first extracts all of the allocation information from files. The information is then stored in the program memory, for the backend/API endpoints to utilize.

If you add new allocation files you need to restart the backend so it starts processing the files.

The input files should be located in the _./raw_input_ folder.

The files have the following characteristics:

- The files should be JSON files compressed with ZIP. Don't use encryption or other non-default options
- Each ZIP file should have the format: raw_X.zip where X is the round number
- Each ZIP file should contain only one file with the same name, but with file extension _.JSON_
- Each JSON file should have the following format:

```
[
  {
    "address": "0x11",
    "amount": "123"
  },
  {
    "address": "0x12",
    "amount": "234"
  },
]

```

The addresses in the JSON files should be Starknet wallet addresses for the recipients of the allocation. The amounts should be the amount in its base units: 1 full STRK token is expressed as _1000000000000000000_. No decimal amounts are allowed.

Addition of new data has to be connected with reinitializing the backend docker container.

## Program logic

### Startup

Once you start the program, either through Docker or locally with `cargo run`, the following things happen:

1. Function _main_ in file _api_run.rs_ is called.
1. It calls _update_api_data_ in _data_storage.rs_. This starts the data extraction process in _processor.rs_ function _read_allocations_.
1. Function _retrieve_valid_files_ is called, which checks the input folder and extracts all file names that have the correct syntax
1. Function _read_allocations_ continues processing the found files. For each file, it extracts the contents. It takes the first content file and parses it into a raw allocation struct. A separate struct is created to contain the raw allocation data with the round number. The round number is extracted from the file name.
1. Once all of the raw allocations are extracted, function _transform_allocations_to_cumulative_rounds_ is called for further processing
1. Function _transform_allocations_to_cumulative_rounds_ calls function _map_cumulative_amounts_ to transform the raw allocations into one main hashmap per round. These hashmaps contain data about round amounts and cumulative amounts, mapped from address to amount.
1. Once the mappings are calculated, function _transform_allocations_to_cumulative_rounds_ continues by iterating through every address in the maps and calculating cumulative amounts for rounds. It then continues to call the Merkle tree generation in file _merkle_tree.rs_.
1. The Merkle tree generation takes all the entries given to it and builds the tree recursively.
1. Once the Merkle trees are generated, all of the data is ready.
1. The data is given back all the way to function _update_api_data_ which stores the data in memory.
1. At this point, the data is ready and the API is started in _api_run.rs_.

### Endpoints

Each endpoint is in file _endpoints.rs_. OpenAPI documentation is associated with each endpoint.

Each endpoint prepares the parameters and calls another function _get_raw_xxx_ in file _processor.rs_. These functions basically just retrieve all of the data from memory, filter it based on parameters and return it.

## Notes

### Performance

If there are a lot of entries in the input files it may take a while to get the backend started. Processing a file with a million entries may take an hour. The program is single-threaded. The backend will output "API ready" once everything has been processed.

The main problem with this is that the same processing is performed every time the backend is started, because all the trees are only stored in memory. This approach may need to be revised in the future.

The main bottleneck in the performance is calculating the hash values for the tree. There isn't much that can be done to improve that directly.

### Extraction of the capital from the smart contract by the owner account

At this point, there is no need to have "extraction of the capital by the owner/foundation" functionality, but there is a way to do this. This means that the owner of the smart contract has to be properly secured/safe.

Imagine there is 100 tokens on the smart contract. Malicious owner account can submit root that corresponds to a tree that would send the 100 to itself, even though this account is not eligible at all.

### Removal of root(s) from smart contract is not possible

It is not possible to remove or overwrite root(s) in the smart contract. It is required for the protocols to store root in the smart contract that has been checked that is correct.

In can case that a mistake happens here is what can be done:

- If an account has been omitted or account has lower allocation that it should have a new root that corrects the state can be added.
- If an account has been added or has higher allocation

1. In case account owner stores new root that does corrects this error, someone with the knowledge of the tree that has the mistake can potentially provide the information to the given account that can claim more than it should.
1. Possible way would be to extract all capital through storing a new merkle root that would allow for sending the remaining capital on the smart contract to a newly deployed distribution smart contract (it would likely have to go through a third account). This newly redeployed contract would have to have trees adjusted for the already claimed tokens in the previous one.
