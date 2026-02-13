# Use Bun oven image
FROM oven/bun:1

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install

# Copy source code
COPY . .

# Expose port if needed
EXPOSE 3000

# Run the bot
CMD ["bun", "run", "src/index.ts"]
