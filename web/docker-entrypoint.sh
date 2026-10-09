#!/bin/sh
set -e

REQUIRED_VARS="IS_PASSWORD_PROTECTED HTUSER HTPASSWD ROBOTS_TAG_VALUE"
for VAR in $REQUIRED_VARS; do
  eval "VAR_IS_SET=\${$VAR+x}"
  if [ -z "$VAR_IS_SET" ]; then
    echo "Error: $VAR environment variable is not set."
    exit 1
  fi
done

# Create an empty auth.conf file by default - need a reference to this file even when no auth is set
touch /etc/nginx/conf.d/auth.conf

if [ "$IS_PASSWORD_PROTECTED" = "1" ]; then
  # Ensure required environment variables are set
  if [ -z "$HTUSER" ] || [ -z "$HTPASSWD" ]; then
    echo "Error: HTUSER and HTPASSWD must be set when IS_PASSWORD_PROTECTED is 1."
    exit 1
  fi

  # Create htpasswd file
  htpasswd -bc /etc/nginx/.htpasswd "$HTUSER" "$HTPASSWD"

  # Create nginx config snippet for basic auth
  AUTH_SNIPPET="/etc/nginx/conf.d/auth.conf"
  cat > "$AUTH_SNIPPET" <<EOF
auth_basic "Restricted";
auth_basic_user_file /etc/nginx/.htpasswd;
EOF
fi

# Write only the value (no set directive) for $robots_tag, to be read by nginx.conf
# echo "${ROBOTS_TAG_VALUE}" > /etc/nginx/conf.d/robots-tag.conf

# Executes the command and arguments passed to the script, replacing the current shell process.
# This is commonly used as the last line in Docker entrypoint scripts to run the container's main process.
exec "$@"
