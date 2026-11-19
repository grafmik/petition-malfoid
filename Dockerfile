FROM node:24-alpine
WORKDIR /app
COPY server.mjs ./
COPY public ./public
ENV PORT=3000 DATA_DIR=/data NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.mjs"]
