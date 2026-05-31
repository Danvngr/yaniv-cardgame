FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx tsc --outDir ./dist
EXPOSE 3001

CMD ["node", "dist/index.js"]