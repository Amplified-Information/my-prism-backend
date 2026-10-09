# Note: this Dockerfile is intended to be built from the repo's root
# Note: this Dockerfile assumes that prism-front-end is a submodule of prism (web)
# Note: this Dockerfile will not run standalone in the prism-front-end repo as it needs the protobufs in api/proto and clob/proto
#
# cd prism # yes, need access to protos in other dirs
# cat ../docker-compose-monolith.yml | grep image:
# export VERSION=0.1.0
#
# docker build -f ./web/Dockerfile -t ghcr.io/prismmarketlabs/web:$VERSION .
# docker push ghcr.io/prismmarketlabs/web:$VERSION
#
# docker run -p 5173:80 ghcr.io/prismmarketlabs/web:$VERSION

# BUILD stage
FROM node:24 AS build

WORKDIR /app/web

COPY ./web/package*.json ./
COPY ./web/docker-entrypoint.sh ./

RUN npm i --legacy-peer-deps

COPY ./web /app/web

# need to copy the protobuf definitions which are outside the web directory:
COPY ./api/proto /app/api/proto
COPY ./clob/proto /app/clob/proto
RUN npm run gen

RUN npm run build

# RUN stage
FROM nginx:alpine

# htpasswd
RUN apk add --no-cache apache2-utils

# Add custom nginx config for SPA routing
COPY ./web/nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/web/dist /usr/share/nginx/html

# Set basic auth at run-time using an entrypoint script (env var)
COPY --from=build /app/web/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# need:
# - IS_PASSWORD_PROTECTED
# - HTUSER
# - HTPASSWD
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
