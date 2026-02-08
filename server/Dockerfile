FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx tsc --outDir ./dist
EXPOSE 3001

# --- שורת הדיבוג החדשה ---
# היא בודקת אם הסוד קיים ומדפיסה את הסטטוס שלו
CMD ["sh", "-c", "echo '--- DEBUG CHECK ---'; if [ -z \"$FIREBASE_SERVICE_ACCOUNT\" ]; then echo 'RESULT: Secret is MISSING inside the container'; else echo 'RESULT: Secret is PRESENT inside the container'; fi; echo '--- STARTING APP ---'; node dist/index.js"]