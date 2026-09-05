FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/package.json
COPY apps/playground/package.json apps/playground/package.json
COPY examples/01-react-mount/package.json examples/01-react-mount/package.json
COPY examples/02-custom-storage/package.json examples/02-custom-storage/package.json
COPY examples/03-capture-record/package.json examples/03-capture-record/package.json
RUN npm ci
COPY . .
RUN npm run build -w @director-stage/playground

FROM nginx:1.27-alpine
COPY --from=build /app/apps/playground/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
ENV PORT=8080
EXPOSE 8080
