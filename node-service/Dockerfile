FROM node:20-alpine AS builder

WORKDIR /build

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies) for building
RUN npm install --prefer-offline --no-audit

# Final stage
FROM node:20-alpine

WORKDIR /app

# Install dumb-init for proper signal handling (Microsoft best practice)
RUN apk add --no-cache dumb-init

# Copy node_modules from builder
COPY --from=builder /build/node_modules ./node_modules

# Copy application code
COPY . .

# Create uploads directory if needed
RUN mkdir -p uploads

# Non-root user for security (Microsoft best practice)
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3001

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"]
