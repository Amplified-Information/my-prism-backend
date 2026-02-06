# postgres

## Command to run postgres

```bash
cd db
mkdir -p /mnt/external/postgresdata

source ./loadEnv.sh local
# docker run --rm -it -p 5432:5432 -e POSTGRES_USER=$DB_UNAME -e POSTGRES_PASSWORD=$DB_PWORD -e POSTGRES_DB=$DB_NAME -v /mnt/external/postgresdata:/var/lib/postgresql postgres:18
export VERSION=0.1.1
docker run -p 5432:5432 -e POSTGRES_USER=$DB_UNAME -e POSTGRES_PASSWORD=$DB_PWORD -e POSTGRES_DB=$DB_NAME -v /mnt/external/postgresdata:/var/lib/postgresql ghcr.io/prismmarketlabs/db:$VERSION
```

## postgres cli client

`sudo apt-get install postgresql-client`

`psql`

You can connect with (prompted for password):

`psql -h 127.0.0.1 -d your_db_name -U your_db_user`

## pg_partman

`pg_partman` is used to manage table partitioning (https://github.com/pgpartman/pg_partman)

Configuration is set up in the Dockerfile

Verify it's installed with the following SQL query:

`SELECT * FROM pg_available_extensions WHERE name = 'pg_partman';`

## postgresql extension

Use the VSCode postgresql extension (`ms-ossdata.vscode-pgsql`) for connecting to the database.
