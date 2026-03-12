import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import * as jwt from 'jsonwebtoken';
import * as url from 'url';
import { LoggerService } from '../common/utils/logger.service';
import { CacheService } from '../common/utils/cache.service';
import { WsContentType } from '../common/constants';

/**
 * WebSocket 网关 - 对应原 Java 项目的 NettyWebSocketServer
 * 使用原生 ws 库实现，与前端原生 WebSocket 兼容
 */
@Injectable()
export class WebsocketGateway implements OnModuleInit, OnModuleDestroy {
  private wss: WebSocketServer;

  // 在线用户映射表: userId -> WebSocket
  private onlineUsers: Map<string, WebSocket> = new Map();
  // WebSocket -> userId 反向映射
  private socketToUser: Map<WebSocket, string> = new Map();

  // UserService 引用（通过 setUserService 设置，避免循环依赖）
  private userService: any;

  // 心跳检测间隔（30秒）
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(
    private logger: LoggerService,
    private cache: CacheService,
  ) {}

  /**
   * 设置 UserService 引用
   */
  setUserService(userService: any) {
    this.userService = userService;
    // 同时设置反向引用
    if (userService && userService.setWebsocketGateway) {
      userService.setWebsocketGateway(this);
    }
  }

  /**
   * 模块初始化时启动 WebSocket 服务器
   */
  onModuleInit() {
    const port = parseInt(process.env.WS_PORT || '9100', 10);

    this.wss = new WebSocketServer({
      port,
      path: '/ws', // 与 Java 后端保持一致的路径
    });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      this.handleConnection(ws, req);
    });

    this.wss.on('error', (error) => {
      this.logger.error(`WebSocket 服务器错误: ${error.message}`, error.stack, 'WebSocket');
    });

    // 启动心跳检测
    this.startHeartbeat();

    this.logger.log(`🔌 WebSocket 服务已启动: ws://localhost:${port}/ws`, 'WebSocket');
  }

  /**
   * 模块销毁时关闭 WebSocket 服务器
   */
  onModuleDestroy() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.wss) {
      this.wss.close();
      this.logger.log('WebSocket 服务已关闭', 'WebSocket');
    }
  }

  /**
   * 处理新连接
   */
  private async handleConnection(ws: WebSocket, req: IncomingMessage) {
    try {
      // 从 URL 查询参数获取 Token
      const parsedUrl = url.parse(req.url || '', true);
      const token = (parsedUrl.query['x-token'] as string) || (parsedUrl.query.token as string);

      if (!token) {
        this.logger.warn(`连接被拒绝: 未提供 Token`, 'WebSocket');
        this.sendError(ws, '未提供认证令牌');
        ws.close();
        return;
      }

      // 验证 Token
      let payload: any;
      try {
        payload = jwt.verify(token, process.env.JWT_SECRET || 'zibolt-chat-secret-key-2025');
      } catch (e) {
        this.logger.warn(`连接被拒绝: Token 无效`, 'WebSocket');
        this.sendError(ws, 'Token 无效');
        ws.close();
        return;
      }

      // 检查 Token 是否在缓存中有效
      const cachedToken = this.cache.get<string>(`token:${payload.userId}`);
      if (!cachedToken) {
        // 缓存中没有 Token（可能是服务重启后缓存被清空），自动将有效 Token 存入缓存
        this.logger.log(`用户 ${payload.userName || payload.userId} 缓存中无 Token，自动存入缓存`, 'WebSocket');
        this.cache.set(`token:${payload.userId}`, token);
      } else if (cachedToken !== token) {
        // 缓存中有 Token 但不匹配，说明已在其他地方登录
        this.logger.warn(`连接被拒绝: 用户 ${payload.userName || payload.userId} Token 已失效或已在其他地方登录`, 'WebSocket');
        this.sendError(ws, '已在其他地方登录');
        ws.close();
        return;
      }

      const userId = payload.userId;
      const userName = payload.userName || payload.name;

      // 如果用户已在线，断开旧连接
      const existingWs = this.onlineUsers.get(userId);
      if (existingWs && existingWs.readyState === WebSocket.OPEN) {
        this.sendError(existingWs, '已在其他地方登录');
        existingWs.close();
      }

      // 添加到在线用户映射
      this.onlineUsers.set(userId, ws);
      this.socketToUser.set(ws, userId);

      // 存储用户信息到 WebSocket
      (ws as any).userId = userId;
      (ws as any).userName = userName;
      (ws as any).isAlive = true;

      this.logger.log(
        `用户 ${userName}(${userId}) 已连接, 当前在线: ${this.onlineUsers.size}`,
        'WebSocket',
      );

      // 调用 UserService 的 online 方法广播上线通知
      if (this.userService) {
        await this.userService.online(userId);
      }

      // 设置消息处理
      ws.on('message', (data) => {
        this.handleMessage(ws, data);
      });

      // 设置关闭处理
      ws.on('close', () => {
        this.handleClose(ws);
      });

      // 设置错误处理
      ws.on('error', (error) => {
        this.logger.error(`WebSocket 错误: ${error.message}`, error.stack, 'WebSocket');
        this.handleClose(ws);
      });

      // 设置 pong 响应（心跳检测）
      ws.on('pong', () => {
        (ws as any).isAlive = true;
      });

    } catch (error) {
      this.logger.error(`连接处理失败: ${error.message}`, error.stack, 'WebSocket');
      ws.close();
    }
  }

  /**
   * 处理消息
   */
  private handleMessage(ws: WebSocket, data: any) {
    const message = data.toString();
    
    // 心跳消息
    if (message === 'heart' || message === 'ping') {
      (ws as any).isAlive = true;
      return;
    }

    // 其他消息暂不处理（Java 后端也不接收消息）
  }

  /**
   * 处理连接关闭
   */
  private async handleClose(ws: WebSocket) {
    const userId = this.socketToUser.get(ws);

    if (userId) {
      const userName = (ws as any).userName;
      this.onlineUsers.delete(userId);
      this.socketToUser.delete(ws);

      this.logger.log(
        `用户 ${userName}(${userId}) 已断开, 当前在线: ${this.onlineUsers.size}`,
        'WebSocket',
      );

      // 调用 UserService 的 offline 方法广播下线通知
      if (this.userService) {
        await this.userService.offline(userId);
      }
    }
  }

  /**
   * 启动心跳检测
   */
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.onlineUsers.forEach((ws, userId) => {
        if ((ws as any).isAlive === false) {
          this.logger.log(`用户 ${userId} 心跳超时，断开连接`, 'WebSocket');
          ws.terminate();
          return;
        }
        (ws as any).isAlive = false;
        ws.ping();
      });
    }, 30000); // 30秒检测一次
  }

  /**
   * 发送错误消息
   */
  private sendError(ws: WebSocket, message: string) {
    this.sendMessage(ws, WsContentType.Msg, { code: -1, msg: message });
  }

  /**
   * 发送消息给指定 WebSocket
   */
  private sendMessage(ws: WebSocket, type: string, data: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, content: data }));
    }
  }

  /**
   * 发送消息给指定用户（私聊）
   */
  sendToUser(userId: string, type: string, data: any) {
    const ws = this.onlineUsers.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      this.sendMessage(ws, type, data);
    }
  }

  /**
   * 发送消息给所有用户（群聊/广播）
   */
  sendToAll(type: string, data: any) {
    const message = JSON.stringify({ type, content: data });
    let sentCount = 0;
    const recipients: string[] = [];
    this.onlineUsers.forEach((ws, userId) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
        sentCount++;
        recipients.push((ws as any).userName || userId);
      }
    });
    this.logger.log(`[广播] 类型: ${type}, 已发送给 ${sentCount} 个在线用户: [${recipients.join(', ')}]`, 'WebSocket');
  }

  /**
   * 发送消息给用户和目标用户 - 对应 Java sendMsgToUser
   */
  sendMsgToUser(msg: any, userId: string, targetId: string) {
    this.sendToUser(userId, WsContentType.Msg, msg);
    if (targetId !== userId) {
      this.sendToUser(targetId, WsContentType.Msg, msg);
    }
  }

  /**
   * 发送消息给群组 - 对应 Java sendMsgToGroup
   */
  sendMsgToGroup(message: any) {
    this.logger.log(`[群聊广播] 消息ID: ${message?.id}, 发送者: ${message?.fromInfo?.name}`, 'WebSocket');
    this.sendToAll(WsContentType.Msg, message);
  }

  /**
   * 发送通知给群组 - 对应 Java sendNotifyToGroup
   */
  sendNotifyToGroup(notify: any) {
    this.sendToAll(WsContentType.Notify, notify);
  }

  /**
   * 发送视频信令给用户 - 对应 Java sendVideoToUser
   */
  sendVideoToUser(msg: any, userId: string) {
    this.sendToUser(userId, WsContentType.Video, msg);
  }

  /**
   * 发送文件信令给用户 - 对应 Java sendFileToUser
   */
  sendFileToUser(msg: any, userId: string) {
    this.sendToUser(userId, WsContentType.File, msg);
  }

  /**
   * 发送系统通知
   */
  sendNotify(userId: string | null, notify: any) {
    if (userId) {
      this.sendToUser(userId, WsContentType.Notify, notify);
    } else {
      this.sendToAll(WsContentType.Notify, notify);
    }
  }

  /**
   * 获取在线用户数量
   */
  getOnlineCount(): number {
    return this.onlineUsers.size;
  }

  /**
   * 获取在线用户 ID 列表 - 对应 Java getOnlineUser
   */
  getOnlineUserIds(): string[] {
    return Array.from(this.onlineUsers.keys());
  }

  /**
   * 检查用户是否在线
   */
  isUserOnline(userId: string): boolean {
    const ws = this.onlineUsers.get(userId);
    return ws !== undefined && ws.readyState === WebSocket.OPEN;
  }
}
