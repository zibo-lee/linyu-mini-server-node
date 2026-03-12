FROM node:18-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY package*.json ./
COPY prisma ./prisma/

# 安装依赖
RUN npm ci --omit=dev && npm cache clean --force

# 生成 Prisma 客户端
RUN npx prisma generate

# 复制源码并构建
COPY . .
RUN npm run build

# --- 生产阶段 ---
FROM node:18-alpine

WORKDIR /app

# 从构建阶段复制必要文件
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma

# 创建上传目录和数据目录
RUN mkdir -p uploads logs

EXPOSE 9200 9100

CMD ["node", "dist/main"]
