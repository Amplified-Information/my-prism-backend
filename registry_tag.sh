# Check if authenticated with Docker registry
# if ! docker pull ghcr.io/prismmarketlabs/api:nonexistent-tag-for-auth-test 2>&1 | grep -q 'pull access denied'; then
#   echo "ERROR: Not authenticated with ghcr.io. Please run: echo \$PAT | docker login ghcr.io -u zoikhash --password-stdin"
#   echo "ERROR: Create a PAT here: https://github.com/settings/tokens/new - check \`read:packages\`, \`write:packages\` and \`delete:packages\`"
#   exit 1
# fi

GITHUB_ORG="prismmarketlabs"



# Detect if running on Windows (not WSL)
case "$(uname -s)" in
  CYGWIN*|MINGW*|MSYS*)
    echo "ERROR: This script is not supported on native Windows shells."
    echo "Please run it using Windows Subsystem for Linux (WSL) or a compatible Unix-like environment."
    exit 1
    ;;
esac


# Check all dependencies are installed
REQUIRED_TOOLS=("docker" "git" "yq")
MISSING_TOOLS=()

for tool in "${REQUIRED_TOOLS[@]}"; do
  if ! command -v "$tool" &> /dev/null; then
    MISSING_TOOLS+=("$tool")
  fi
done

if [ ${#MISSING_TOOLS[@]} -gt 0 ]; then
  echo "ERROR: The following required tools are not installed: ${MISSING_TOOLS[*]}"
  echo "Please install them and try again."
  exit 1
fi


IMAGE_LINE=$(yq -r ".services | to_entries[] | select(.key == \"${SERVICE}\") | .value.image" "$FILE" 2>/dev/null)
# echo "Checking $FILE: $IMAGE_LINE"
IMAGE_TAG=$(echo "$IMAGE_LINE" | grep -oE '[^:]+$')
if [ "$IMAGE_TAG" = "$TAG_DST" ]; then
  FOUND_TAG=true
  # break
fi


####
# part 1 - prompt user input
####

SERVICES=$(yq  -r '.services // {} | keys | .[]' docker-compose-*.yml 2>/dev/null | sort -u | xargs)
read -p "Enter SERVICE ($SERVICES): " SERVICE
SERVICE=${SERVICE}
# validate service:
if [ -z "$SERVICE" ]; then
  echo "ERROR: SERVICE must not be empty."
  exit 1
fi
# validate service exists in docker-compose files:
if ! yq -r '.services // {} | to_entries[] | .key' docker-compose-*.yml 2>/dev/null | grep -q "^${SERVICE}$"; then
  echo "ERROR: SERVICE '$SERVICE' not found in any docker-compose-*.yml files. Please ensure it exists and is spelled correctly."
  exit 1
fi


docker info > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "ERROR: 'docker info' failed. Please ensure Docker is running and you have permission to access it."
  exit 1
fi


read -p "Enter TAG_SRC ***ensure your build pipeline has completed successfully*** (default: latest): " TAG_SRC
TAG_SRC=${TAG_SRC:-latest}




# Find latest tag in the relevant docker-compose file
HIGHEST_VER=$(
  yq -r '.services // {} | to_entries[] | .value.image // empty' docker-compose-*.yml 2>/dev/null \
    | grep "/${SERVICE}:" \
    | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' \
    | sort -t. -k1,1n -k2,2n -k3,3n \
    | tail -1
)
# validate this is a semver:
if ! [[ "$HIGHEST_VER" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "ERROR: Could not determine the highest version from docker-compose files. Please ensure they contain valid semver tags."
  exit 1
fi

# Increment patch version
NEXT_VER=$(echo "$HIGHEST_VER" | awk -F. '{print $1"."$2"."$3+1}' 2>/dev/null)

# validate this is a semver:
if ! [[ "$NEXT_VER" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "ERROR: Could not determine the highest version from docker-compose files. Please ensure they contain valid semver tags."
  exit 1
fi

echo "Incrementing: $HIGHEST_VER -> $NEXT_VER"

read -p "Enter TAG_DST (default: ${NEXT_VER}): " TAG_DST
TAG_DST=${TAG_DST:-$NEXT_VER}



IMAGE_SRC_DEFAULT="ghcr.io/$GITHUB_ORG/${SERVICE}"
read -p "Enter IMAGE_SRC (default: ${IMAGE_SRC_DEFAULT}): " IMAGE_SRC
IMAGE_SRC=${IMAGE_SRC:-$IMAGE_SRC_DEFAULT}



read -p "Has the pipeline successfully built + pushed the image, and have you verified the version of the tag? (y/N): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo "Aborting. Please verify the version of the tags before proceeding."
  exit 1
fi


sleep 1






####
# part 2 - tag and push
####
VER_SRC=$TAG_SRC
VER_DST=$TAG_DST

echo "Tagging and pushing image..."
IMAGE_DST=$IMAGE_SRC # for now, same image

docker pull $IMAGE_SRC:$VER_SRC
if [ $? -ne 0 ]; then
  echo "ERROR: Failed to pull image $IMAGE_SRC:$VER_SRC"
  exit 1
fi

# never add a tag to derived namespaces such as web.eng!
docker tag $IMAGE_SRC:$VER_SRC $IMAGE_DST:$VER_DST
if [ $? -ne 0 ]; then
  echo "ERROR: Failed to tag image $IMAGE_SRC:$VER_SRC as $IMAGE_DST:$VER_DST"
  exit 1
fi

docker images | grep $IMAGE_DST
if [ $? -ne 0 ]; then
  echo "ERROR: Tagged image $IMAGE_DST not found in local images."
  exit 1
fi

# now do:
docker push $IMAGE_DST:$VER_DST
if [ $? -ne 0 ]; then
  echo "ERROR: Failed to push image $IMAGE_DST:$VER_DST"
  exit 1
fi

echo "Pushed $IMAGE_DST:$VER_DST"
echo "Done."


#####
# part 3 - update docker-compose files
#####
echo "Updating docker-compose files..."
UPDATED=false
for FILE in docker-compose-*.yml; do
  # Only match files like docker-compose-X.yml, not docker-compose-X.dev.yml, etc.
  if [[ ! "$FILE" =~ ^docker-compose-[^.]+\.yml$ ]]; then
    continue
  fi
  [ -f "$FILE" ] || continue
  IMAGE_LINE=$(yq -r ".services.\"${SERVICE}\".image // empty" "$FILE" 2>/dev/null)
  [ -z "$IMAGE_LINE" ] && continue
  IMAGE_NAME=$(echo "$IMAGE_LINE" | cut -d: -f1)
  echo "Updating $FILE: ${IMAGE_NAME}:${TAG_DST}"
  yq -Yi ".services.\"${SERVICE}\".image = \"${IMAGE_NAME}:${TAG_DST}\"" "$FILE"
  UPDATED=true
done

if [ "$UPDATED" = false ]; then
  echo "WARNING: Service '${SERVICE}' not found in any docker-compose-*.yml files. No files updated."
fi

### finally, push the changes to the docker-compose file to git:
read -p "Do you want to commit and push the updated docker-compose files to git? (y/N): " PUSH_GIT
if [[ "$PUSH_GIT" =~ ^[Yy]$ ]]; then
  git add docker-compose-*.yml
  git commit -m "tag: ${SERVICE}:${TAG_DST}"
  git push
  echo "Changes pushed to git."
else
  echo "Please remember to commit and push the updated docker-compose files to git."
fi
