import * as forge from 'node-forge';
import * as crypto from 'crypto';

/**
 * 安全工具类 - 对应原 Java 项目的 SecurityUtil
 * 使用 node-forge 实现 RSA 加密/解密（兼容 jsencrypt）
 */
class SecurityUtilClass {
  private keyPair: { publicKey: forge.pki.rsa.PublicKey; privateKey: forge.pki.rsa.PrivateKey };
  private publicKeyPem: string;
  private readonly AES_KEY = 'linyuMiniLinyuServer2025';

  constructor() {
    // 生成 RSA 密钥对 (1024 位，与 Java 项目保持一致)
    const keys = forge.pki.rsa.generateKeyPair({ bits: 1024 });
    this.keyPair = keys;
    // 转换为 PEM 格式
    this.publicKeyPem = forge.pki.publicKeyToPem(keys.publicKey);
  }

  /**
   * 获取 RSA 公钥 (PEM 格式)
   * 对应 Java 的 getPublicKey()
   */
  getPublicKey(): string {
    return this.publicKeyPem;
  }

  /**
   * 使用私钥解密密码
   * 对应 Java 的 decryptPassword()
   * 兼容前端 jsencrypt 库的加密格式
   */
  decryptPassword(encryptedPassword: string): string {
    try {
      // Base64 解码
      const encrypted = forge.util.decode64(encryptedPassword);
      // 使用 PKCS#1 v1.5 填充方式解密（与 jsencrypt 兼容）
      const decrypted = this.keyPair.privateKey.decrypt(encrypted, 'RSAES-PKCS1-V1_5');
      return decrypted;
    } catch (error) {
      console.error('RSA解密失败:', error);
      throw new Error('密码解析失败~');
    }
  }

  /**
   * 使用公钥加密密码 (用于测试)
   * 对应 Java 的 encryptPassword()
   */
  encryptPassword(password: string): string {
    try {
      const encrypted = this.keyPair.publicKey.encrypt(password, 'RSAES-PKCS1-V1_5');
      return forge.util.encode64(encrypted);
    } catch (error) {
      throw new Error('密码加密失败~');
    }
  }

  /**
   * AES 加密
   * 对应 Java 的 aesEncrypt()
   */
  aesEncrypt(data: string): string {
    try {
      // 使用 AES-ECB 模式 (与 Java 默认行为一致)
      const key = Buffer.from(this.AES_KEY.slice(0, 16), 'utf8'); // AES-128 需要 16 字节密钥
      const cipher = crypto.createCipheriv('aes-128-ecb', key, null);
      let encrypted = cipher.update(data, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      return encrypted;
    } catch (error) {
      throw new Error('AES加密失败~');
    }
  }

  /**
   * AES 解密
   * 对应 Java 的 aesDecrypt()
   */
  aesDecrypt(encryptedData: string): string {
    try {
      const key = Buffer.from(this.AES_KEY.slice(0, 16), 'utf8');
      const decipher = crypto.createDecipheriv('aes-128-ecb', key, null);
      let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      throw new Error('AES解密失败~');
    }
  }
}

// 导出单例
export const SecurityUtil = new SecurityUtilClass();
