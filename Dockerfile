# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# Production stage
FROM node:18-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S bidmaster -u 1001

# Copy built application from builder stage
COPY --from=builder --chown=bidmaster:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=bidmaster:nodejs /app/dist ./dist
COPY --from=builder --chown=bidmaster:nodejs /app/package.json ./package.json

# Create uploads directory
RUN mkdir -p uploads logs
RUN chown -R bidmaster:nodejs uploads logs

# Switch to non-root user
USER bidmaster

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {if (r.statusCode === 200) process.exit(0); process.exit(1)}).on('error', () => process.exit(1))"

# Expose port
EXPOSE 5000

# Start application
CMD ["npm", "start"]