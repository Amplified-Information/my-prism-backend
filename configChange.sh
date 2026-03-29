#!/bin/bash

# this script touches the relevant docker-compose-$MACHINE.yml file 
# which then causes a restart of services (source /home/admin/1_loadEnvVars.sh && /home/admin/2_dockerComposeUp.sh)

echo "This script reloads \`docker compose\` services on the specified machine and environment by touching the relevant docker-compose-$MACHINE.$ENV.yml file, which triggers a restart of services with the new configuration."

# Require the following variables to be passed as positional arguments:
if [ $# -ne 2 ]; then
  echo "Usage: $0 <ENV> <MACHINE>" >&2
  exit 1
fi
ENV="$1"
MACHINE="$2"

# machine should be one of: proxy, monolith, data
if [[ ! "$MACHINE" =~ ^(proxy|monolith|data)$ ]]; then
  echo "Invalid machine: $MACHINE. Must be one of: proxy, monolith, data" >&2
  exit 1
fi
# env should be one of: dev, uat, prod
if [[ ! "$ENV" =~ ^(dev|uat|prod)$ ]]; then
  echo "Invalid environment: $ENV. Must be one of: dev, uat, prod" >&2
  exit 1
fi




FILENAME="docker-compose-$MACHINE.$ENV.yml"

# Touch the file to trigger a restart of services
# add a whitespace character to the end of the file
# if more than one whitespace is at the the of the file, delete one whitespace character to avoid the file growing indefinitely
if [ -f "$FILENAME" ]; then
  # Check if the last character is a whitespace  if [ -s "$FILENAME" ] && [ "$(tail -c1 "$FILENAME")" = " " ]; then
  if [ -s "$FILENAME" ] && [ "$(tail -c1 "$FILENAME")" = " " ]; then
    # If it is, remove the last character
    truncate -s -1 "$FILENAME"
  else
    # If it is not, add a whitespace character
    echo " " >> "$FILENAME"
  fi
fi

echo "Touched $FILENAME to trigger a restart of services on $MACHINE in $ENV environment"


# now check in the $FILENAME
# prompt user if they want to commit the change to git
read -p "Do you want to commit the change to git? (y/N) "
if [[ "$REPLY" =~ ^[Yy]$ ]]; then
  git add "$FILENAME"
  git commit -m "configChange: $MACHINE ($ENV)"
  echo "Change committed to git."
  git push
  echo "Change pushed to remote repository."
else
  echo "Change not committed to git."
fi
