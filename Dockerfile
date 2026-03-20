FROM node:22-bookworm-slim AS web-builder
WORKDIR /app

COPY package.json bun.lock ./
COPY tsconfig.json tsconfig.node.json vite.config.ts index.html ./
COPY src ./src

RUN npm install
RUN npm run build

FROM golang:1.25-bookworm AS go-builder
WORKDIR /app

COPY go.mod go.sum ./
RUN go mod edit -dropreplace github.com/jabberwocky238/luna-edge || true
RUN go mod download

COPY main.go ./
COPY --from=web-builder /app/web/dist ./web/dist

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/luna-edge-panel .

FROM debian:bookworm-slim
WORKDIR /app

RUN useradd --create-home --shell /usr/sbin/nologin appuser

COPY --from=go-builder /out/luna-edge-panel /usr/local/bin/luna-edge-panel

USER appuser

ENV LUNA_EDGE_PANEL_ADDR=0.0.0.0:18090
EXPOSE 18090

ENTRYPOINT ["/usr/local/bin/luna-edge-panel"]
