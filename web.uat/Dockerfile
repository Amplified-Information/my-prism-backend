# cd prism/web.uat # yes, need access to protos in other dirs
# cat ../docker-compose-monolith.yml | grep image:
# export VERSION=0.4.12
# docker build -f ./Dockerfile -t ghcr.io/prismmarketlabs/web.uat:$VERSION .
# docker push ghcr.io/prismmarketlabs/web.uat:$VERSION

# source loadEnv.sh local
# docker run -p 5173:80 -e IS_PASSWORD_PROTECTED=${IS_PASSWORD_PROTECTED} -e HTUSER=${HTUSER} -e HTPASSWD=${HTPASSWD} ghcr.io/prismmarketlabs/web.uat:$VERSION

# BUILD stage
FROM node:24 AS build

WORKDIR /app/web

COPY ./package*.json ./

RUN npm i --legacy-peer-deps

COPY . /app/web

RUN npm run build

# RUN stage
FROM nginx:alpine

# htpasswd
RUN apk add --no-cache apache2-utils

# Add custom nginx config for SPA routing
COPY ./nginx.conf /etc/nginx/conf.d/default.conf

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
