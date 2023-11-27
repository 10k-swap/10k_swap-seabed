FROM node:16-alpine

# For @dydxprotocol/starkex-lib
RUN apk add g++ make python3 git

WORKDIR /app
COPY . .
RUN yarn install --network-timeout 600000 && yarn run build