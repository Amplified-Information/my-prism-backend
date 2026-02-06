# cd prism/mw # yes, need access to protos in other dirs

# cat ../docker-compose-monolith.yml | grep image:
# export VERSION=latest

# docker build -f Dockerfile -t ghcr.io/prismmarketlabs/mw:$VERSION .
# docker push ghcr.io/prismmarketlabs/mw:$VERSION
# docker run -p 5173:80 -e IS_PASSWORD_PROTECTED=${IS_PASSWORD_PROTECTED} -e HTUSER=${HTUSER} -e HTPASSWD=${HTPASSWD} ghcr.io/prismmarketlabs/mw:$VERSION



# Use official Node.js LTS image as the base
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build TypeScript files
RUN npm run build

# Expose port (change if your app uses a different port)
EXPOSE 5173

# Start the application
CMD ["node", "dist/index.js"]
