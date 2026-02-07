# cd prism/eventbus
# cat ../docker-compose-data.yml | grep image:
# export VERSION=0.1.1
# docker build -t ghcr.io/prismmarketlabs/eventbus:$VERSION .
# docker push ghcr.io/prismmarketlabs/eventbus:$VERSION
# 
# source loadEnv.sh local
# docker run -p 4222:4222 -p 6222:6222 ghcr.io/prismmarketlabs/eventbus:$VERSION

# BUILD stage
FROM nats:2.12-alpine

# # Ensure required environment variables are set:
# ARG NATS_PORT
# ARG NATS_CLUSTER_PORT
# ARG NATS_CLUSTER_NAME
# ARG NATS_JETSTREAM
# ARG NATS_JETSTREAM_STORE_DIR
# ARG NATS_JETSTREAM_MAX_MEMORY
# ARG NATS_JETSTREAM_MAX_STORAGE

# RUN : "${NATS_PORT:?NATS_PORT is not set!}" \
#   && : "${NATS_CLUSTER_PORT:?NATS_CLUSTER_PORT is not set!}" \
#   && : "${NATS_CLUSTER_NAME:?NATS_CLUSTER_NAME is not set!}" \
#   && : "${NATS_JETSTREAM:?NATS_JETSTREAM is not set!}" \
#   && : "${NATS_JETSTREAM_STORE_DIR:?NATS_JETSTREAM_STORE_DIR is not set!}" \
#   && : "${NATS_JETSTREAM_MAX_MEMORY:?NATS_JETSTREAM_MAX_MEMORY is not set!}" \
#   && : "${NATS_JETSTREAM_MAX_STORAGE:?NATS_JETSTREAM_MAX_STORAGE is not set!}"

# ENV NATS_PORT=$NATS_PORT
# ENV NATS_CLUSTER_PORT=$NATS_CLUSTER_PORT
# ENV NATS_CLUSTER_NAME=$NATS_CLUSTER_NAME
# ENV NATS_JETSTREAM=$NATS_JETSTREAM
# ENV NATS_JETSTREAM_STORE_DIR=$NATS_JETSTREAM_STORE_DIR
# ENV NATS_JETSTREAM_MAX_MEMORY=$NATS_JETSTREAM_MAX_MEMORY
# ENV NATS_JETSTREAM_MAX_STORAGE=$NATS_JETSTREAM_MAX_STORAGE

# EXPOSE $NATS_PORT
# EXPOSE $NATS_CLUSTER_PORT

CMD ["nats-server"]
# , \
#   "--port", "${NATS_PORT}", \
#   "--cluster", "nats://${NATS_CLUSTER_NAME}:${NATS_CLUSTER_PORT}", \
#   "--jetstream", "--store_dir", "${NATS_JETSTREAM_STORE_DIR}", \
#   "--max_mem_store", "${NATS_JETSTREAM_MAX_MEMORY}", \
#   "--max_file_store", "${NATS_JETSTREAM_MAX_STORAGE}" \
# ]
