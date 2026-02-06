# cd prism/db
# cat ../docker-compose-data.yml | grep image:
# export VERSION=0.1.1
# docker build -t ghcr.io/prismmarketlabs/db:$VERSION .
# docker push ghcr.io/prismmarketlabs/db:$VERSION
# 
# source loadEnv.sh local
# docker run -p 5432:5432 -v /mnt/external/postgresdata:/var/lib/postgresql -e POSTGRES_USER=${DB_UNAME} -e POSTGRES_PASSWORD=${DB_PWORD} -e POSTGRES_DB=${DB_NAME} ghcr.io/prismmarketlabs/db:$VERSION

FROM postgres:18-trixie

# Install pg_partman
RUN apt-get update && apt-get install -y postgresql-18-partman
RUN echo "CREATE SCHEMA IF NOT EXISTS partman;" >> /docker-entrypoint-initdb.d/pg_partman_setup.sql
RUN echo "CREATE EXTENSION IF NOT EXISTS pg_partman SCHEMA partman;" >> /docker-entrypoint-initdb.d/pg_partman_setup.sql

CMD ["postgres"]
