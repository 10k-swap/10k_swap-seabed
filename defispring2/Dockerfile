FROM node:18-alpine

RUN apk add g++ make python3 git

WORKDIR /app
COPY . .
RUN npm install && npm run build