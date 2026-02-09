import { Injectable } from '@nestjs/common';
import * as NodeCache from 'node-cache';

/**
 * 缓存服务 - 对应原 Java 项目的 CacheUtil (Caffeine)
 * 使用 node-cache 实现本地缓存
 */
@Injectable()
export class CacheService {
  private cache: NodeCache;

  constructor() {
    this.cache = new NodeCache({
      stdTTL: 3600, // 默认过期时间 1 小时
      checkperiod: 120, // 每 2 分钟检查过期
    });
  }

  /**
   * 设置缓存
   * @param key 缓存键
   * @param value 缓存值
   * @param ttl 过期时间(秒)，默认 1 小时
   */
  set<T>(key: string, value: T, ttl?: number): boolean {
    if (ttl) {
      return this.cache.set(key, value, ttl);
    }
    return this.cache.set(key, value);
  }

  /**
   * 获取缓存
   * @param key 缓存键
   */
  get<T>(key: string): T | undefined {
    return this.cache.get<T>(key);
  }

  /**
   * 删除缓存
   * @param key 缓存键
   */
  del(key: string): number {
    return this.cache.del(key);
  }

  /**
   * 检查缓存是否存在
   * @param key 缓存键
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * 获取所有缓存键
   */
  keys(): string[] {
    return this.cache.keys();
  }

  /**
   * 清空所有缓存
   */
  flush(): void {
    this.cache.flushAll();
  }

  /**
   * 根据前缀获取所有匹配的键
   * @param prefix 键前缀
   */
  getKeysByPrefix(prefix: string): string[] {
    return this.cache.keys().filter((key) => key.startsWith(prefix));
  }

  /**
   * 根据前缀删除所有匹配的缓存
   * @param prefix 键前缀
   */
  delByPrefix(prefix: string): number {
    const keys = this.getKeysByPrefix(prefix);
    return this.cache.del(keys);
  }
}
