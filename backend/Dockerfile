FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=node:node . .

# A aplicação não roda como administrador dentro do contêiner.
USER node

EXPOSE 4444
CMD ["npm", "start"]
