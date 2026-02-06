# BUILD stage
# cd prism # yes, need access to protos in other dirs
# export VERSION=0.1.0
# docker build -f ./web.lp/Dockerfile -t ghcr.io/prismmarketlabs/web:$VERSION .
# docker push ghcr.io/prismmarketlabs/web:$VERSION
# docker run -p 5173:80 ghcr.io/prismmarketlabs/web:$VERSION
# http://localhost:5173

# BUILD stage
FROM node:24 AS build

WORKDIR /app/web

COPY ./web.lp/package*.json ./

RUN npm install

COPY ./web.lp /app/web

# need to copy the protobuf definitions which are outside the web directory:
COPY ./api/proto /app/api/proto
COPY ./clob/proto /app/clob/proto
RUN npm run gen

RUN npm run build

# RUN stage
FROM nginx:alpine

COPY --from=build /app/web/dist /usr/share/nginx/html

CMD ["nginx", "-g", "daemon off;"]
