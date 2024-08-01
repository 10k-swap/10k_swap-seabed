FROM rust:1.76.0 as builder

WORKDIR /build
COPY . .
RUN cargo build --release

FROM ubuntu:22.04

WORKDIR /app

RUN apt-get update
COPY --from=builder /build .

EXPOSE 8080

CMD ["./target/release/api_run"]
