# luna-edge-panel

一个最小的 Luna Edge 控制面板：

- 前端：React + TypeScript + Vite
- 后端：Go
- 控制能力：通过 `github.com/jabberwocky238/luna-edge/lnctl` 查询 `master`，预览并提交简单的 L7 Plan

## 当前功能

- 查询 `DomainEntryProjection`
- 查询 DNS 记录
- 生成 L7 `Plan`
- 提交 L7 `Plan`

当前页面只覆盖最简单的控制面场景：

- `l7-http`
- `l7-https`
- `l7-http-both`
- 后端类型 `SVC` / `EXTERNAL`

## 运行

后端：

```bash
go run .
```

默认监听：

```bash
:8090
```

可通过环境变量覆盖：

```bash
LUNA_EDGE_PANEL_ADDR=:9000 go run .
```

前端开发：

```bash
npm install
npm run dev
```

Vite 开发服务会把 `/api` 代理到 `http://127.0.0.1:8090`。

## Docker

项目根目录提供了 `Dockerfile`，用于构建前后端一体镜像。

运行时可通过环境变量指定实际 master：

```bash
LUNA_EDGE_PANEL_MASTER_URL=http://luna-edge-master.default.svc.cluster.local:8080
```

## GHCR 发布

仓库包含 GitHub Actions 工作流：

- 文件：`.github/workflows/publish-ghcr.yml`
- 触发条件：push 到 `publish` 分支
- 发布地址：`ghcr.io/<owner>/<repo>:publish`

## Kubernetes 一键部署

部署文件：

```text
deploy/luna-edge-panel.yaml
```

直接应用：

```bash
kubectl apply -f deploy/luna-edge-panel.yaml
```

使用前至少改这两个值：

- `image: ghcr.io/OWNER/REPO:publish`
- `LUNA_EDGE_PANEL_MASTER_URL`

## 依赖说明

当前项目通过 `go.mod` 里的本地替换直接复用相邻目录：

```go
replace github.com/jabberwocky238/luna-edge => ../luna-edge
```

所以要求当前目录结构形如：

```text
../luna-edge
../luna-edge-panel
```
