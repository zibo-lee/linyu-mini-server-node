# 林语Mini聊天室 - Node.js 版本

基于 NestJS + Prisma + SQLite + Socket.IO 重构的聊天室服务

## 🚀 快速开始

### 安装依赖
```bash
npm install
```

### 初始化数据库
```bash
npx prisma generate
npx prisma db push
```

### 启动开发服务
```bash
npm run start:dev
```

### 启动生产服务
```bash
npm run build
npm run start:prod
```

## 📡 服务端口

- HTTP API: `http://localhost:9200`
- WebSocket: `ws://localhost:9100`

## 🔗 API 接口

### 认证相关 (无需 Token)
| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/verify` | POST | 验证群密码 |
| `/api/v1/login` | POST | 用户登录 |

### 需要认证的接口 (Header: Authorization: Bearer <token>)
| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/current` | GET | 获取当前用户 |
| `/api/v1/logout` | POST | 退出登录 |
| `/api/v1/user/list` | GET | 用户列表 |
| `/api/v1/user/online/web` | GET | 在线用户 |
| `/api/v1/message/send` | POST | 发送消息 |
| `/api/v1/message/record` | POST | 消息记录 |
| `/api/v1/message/recall` | POST | 撤回消息 |
| `/api/v1/chat-list/group` | GET | 群聊信息 |
| `/api/v1/chat-list/list/private` | GET | 私聊列表 |
| `/api/v1/video/*` | POST | 视频通话信令 |
| `/api/v1/file/upload` | POST | 文件上传 |
| `/api/v1/notify/list` | GET | 通知列表 |

## 🔧 环境变量 (.env)

```env
PORT=9200                    # HTTP 端口
WS_PORT=9100                 # WebSocket 端口
DATABASE_URL="file:./linyu-mini.db"
JWT_SECRET=your-secret-key
LINYU_PASSWORD=sun55@kong    # 群密码
LINYU_NAME=Linyu在线聊天室    # 群名称
LINYU_LIMIT=100              # 在线人数限制

# AI 配置
DOUBAO_API_KEY=your-key
DEEPSEEK_API_KEY=your-key
```

## 📁 项目结构

```
src/
├── main.ts                    # 入口文件
├── app.module.ts              # 根模块
├── common/                    # 公共模块
│   ├── decorators/            # 自定义装饰器
│   ├── filters/               # 异常过滤器
│   ├── guards/                # 认证守卫
│   ├── interceptors/          # 响应拦截器
│   └── utils/                 # 工具类
├── modules/                   # 业务模块
│   ├── auth/                  # 认证模块
│   ├── user/                  # 用户模块
│   ├── message/               # 消息模块
│   ├── chat-list/             # 聊天列表
│   ├── notify/                # 通知模块
│   ├── video/                 # 视频通话
│   ├── file/                  # 文件上传
│   └── ai/                    # AI 模块
└── websocket/                 # WebSocket 网关
```

## 📋 与 Java 版本对照

| Java | Node.js |
|------|---------|
| Spring Boot | NestJS |
| MyBatis-Plus | Prisma |
| SQLite + H2 | SQLite |
| Netty WebSocket | Socket.IO |
| Caffeine Cache | node-cache |
| Logback | Winston |

## 🎯 已实现功能

- ✅ 用户认证 (JWT)
- ✅ 群聊消息
- ✅ 私聊消息
- ✅ 消息撤回
- ✅ WebSocket 实时推送
- ✅ 视频通话信令
- ✅ 文件上传
- ✅ 系统通知
- ✅ AI 对话 (豆包/DeepSeek)
- ✅ 敏感词过滤 (待完善)

## License

MIT
