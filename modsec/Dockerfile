FROM owasp/modsecurity-crs:3.3.8-nginx-202603150103

# Allow application/grpc-web-text content type for gRPC-Web traffic
# The zz- prefix ensures it loads after CRS.
COPY custom-rules.conf /etc/modsecurity.d/owasp-crs/rules/zz-custom-rules.conf

# (Optional) Copy custom configuration or rules here
# COPY ./my-custom.conf /etc/modsecurity.d/
# COPY ./rules/*.conf /etc/modsecurity.d/rules/

## Environment variables (BACKEND, PARANOIA, ANOMALY_INBOUND, ANOMALY_OUTBOUND) should be set at runtime via docker-compose or docker run
## Example:
#   docker run -e BACKEND=http://proxy:8090 -e PARANOIA=1 -e ANOMALY_INBOUND=5 -e ANOMALY_OUTBOUND=4 ...
## Or in docker-compose.yml:
#   environment:
#     - BACKEND=http://proxy:8090
#     - PARANOIA=1
#     - ANOMALY_INBOUND=5
#     - ANOMALY_OUTBOUND=4

# Default command (inherited from base image)
CMD ["nginx", "-g", "daemon off;"]
