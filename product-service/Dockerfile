FROM node:22-alpine

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install production dependencies
RUN npm install --production

# Copy application source code
COPY . .

# Expose Product Service port
EXPOSE 3002

# Start the service
CMD ["node", "server.js"]
