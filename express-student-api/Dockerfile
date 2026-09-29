# Base image
FROM node:20-alpine

# Set working directory inside the container
WORKDIR /app

# Copy package files first for caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application source code
COPY . .

# Expose API port
EXPOSE 3000

# Start command
CMD ["npm", "start"]
