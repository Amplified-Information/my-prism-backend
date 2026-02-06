#!/bin/bash

####
# part 1 - prompt user input
####
read -p "Enter SERVICE (api, clob, proxy, eventbus, web, web.eng, web.uat, web.lp): " SERVICE
SERVICE=${SERVICE:-api}

docker info > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "ERROR: 'docker info' failed. Please ensure Docker is running and you have permission to access it."
  exit 1
fi


read -p "Enter TAG_SRC ***ensure your build pipeline has completed successfully*** (default: latest): " TAG_SRC
TAG_SRC=${TAG_SRC:-latest}

# Find latest tag in ${SERVICE}/TAGS
if [ -f "${SERVICE}/TAGS" ]; then
  TAG_DST_DEFAULT=$(grep -E '^[0-9]+(\.[0-9]+)+$' "${SERVICE}/TAGS" | tail -n 1)
  TAG_DST_DEFAULT=${TAG_DST_DEFAULT:-latest}
elif [ -d "${SERVICE}/TAGS" ] && [ "$(ls -A "${SERVICE}/TAGS" 2>/dev/null)" ]; then
  TAG_DST_DEFAULT=$(ls -1 "${SERVICE}/TAGS" | sort -V | tail -n 1)
else
  TAG_DST_DEFAULT="latest"
fi
read -p "Enter TAG_DST (default: ${TAG_DST_DEFAULT}): " TAG_DST
TAG_DST=${TAG_DST:-$TAG_DST_DEFAULT}

IMAGE_SRC_DEFAULT="ghcr.io/prismmarketlabs/${SERVICE}"
read -p "Enter IMAGE_SRC (default: ${IMAGE_SRC_DEFAULT}): " IMAGE_SRC
IMAGE_SRC=${IMAGE_SRC:-$IMAGE_SRC_DEFAULT}

# read -p "Enter IMAGE_DST (default: ${IMAGE_SRC}): " IMAGE_DST
# IMAGE_DST=${IMAGE_DST:-$IMAGE_SRC}

echo "Before proceeding, please confirm that the tags in docker-compose-${SERVICE}.yml and docker-compose-${SERVICE}.{ENV}.yml correspond to the version you specified in the ${SERVICE}/TAGS file."
read -p "Have you verified the version of the tags? (y/N): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo "Aborting. Please verify the version of the tags before proceeding."
  exit 1
fi

# Auto-verify that TAG_DST exists in docker-compose files:
# Note: ensure you're using the Python version of yq
FOUND_TAG=false
for FILE in docker-compose-*.yml; do
  [ -f "$FILE" ] || continue
  IMAGE_LINE=$(yq -r ".services.${SERVICE}.image" "$FILE" 2>/dev/null)
  echo "Checking $FILE: $IMAGE_LINE"
  IMAGE_TAG=$(echo "$IMAGE_LINE" | grep -oE '[^:]+$')
  if [ "$IMAGE_TAG" = "$TAG_DST" ]; then
    FOUND_TAG=true
    break
  fi
done
if [ "$FOUND_TAG" = false ]; then
  echo "ERROR: Tag '${TAG_DST}' not found in any docker-compose-*.yml under services.${SERVICE}.image"
  exit 1
fi

echo "OK. Found the version specified in the TAG file. Proceeding..."
sleep 1





####
# part 2 - tag and push
####
VER_SRC=$TAG_SRC
VER_DST=$TAG_DST

echo "Tagging and pushing image..."
IMAGE_DST=$IMAGE_SRC # for now, same image

docker pull $IMAGE_SRC:$VER_SRC
# never add a tag to derived namespaces such as web.eng!
docker tag $IMAGE_SRC:$VER_SRC $IMAGE_DST:$VER_DST

docker images | grep $IMAGE_DST


# now do:
docker push $IMAGE_DST:$VER_DST


echo "Pushed $IMAGE_DST:$VER_DST"
echo "Done."