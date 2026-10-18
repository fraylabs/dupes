FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
COPY packages/cli/package.json packages/cli/package.json
COPY packages/platform/package.json packages/platform/package.json
COPY dupes/feedback/package.json dupes/feedback/package.json
COPY dupes/forms/package.json dupes/forms/package.json
RUN npm ci --omit=dev
COPY . .
RUN mkdir /data && chown node:node /data
USER node
ENV DATA_DIR=/data HOST=0.0.0.0 PORT=3000
VOLUME /data
EXPOSE 3000
CMD ["node","--import","tsx","dupes/feedback/src/node.ts"]
