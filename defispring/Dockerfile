FROM rust:1.76.0 as builder

WORKDIR /build
COPY . .
RUN cargo build --release

FROM debian:latest

WORKDIR /app

RUN apt-get update && apt install -y libpq-dev openssl ca-certificates
COPY --from=builder /build .

EXPOSE 8080

CMD ["./target/release/api_run"]
