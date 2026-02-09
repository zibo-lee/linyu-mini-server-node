/**
 * 常量定义 - 对应 Java 项目的 constant 包
 */

/**
 * 徽章类型 - 对应 Java BadgeType
 */
export const BadgeType = {
  Crown: 'crown',     // 皇冠 - 第一个用户
  Clover: 'clover',   // 四叶草 - 7天内新用户
  Diamond: 'diamond', // 钻石 - 7天后用户
} as const;

/**
 * 用户类型 - 对应 Java UserType
 */
export const UserType = {
  User: 'user', // 普通用户
  Bot: 'bot',   // 机器人
} as const;

/**
 * 通知类型 - 对应 Java NotifyType
 */
export const NotifyType = {
  WebOnline: 'web-online',   // web用户上线
  WebOffline: 'web-offline', // web用户下线
} as const;

/**
 * WebSocket 内容类型 - 对应 Java WsContentType
 */
export const WsContentType = {
  Msg: 'msg',       // 聊天消息
  Notify: 'notify', // 系统通知
  Video: 'video',   // 视频信令
  File: 'file',     // 文件传输
} as const;
