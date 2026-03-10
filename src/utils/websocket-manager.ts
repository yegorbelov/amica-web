import {
  onAccessTokenChange,
  getAccessToken,
  setAccessToken,
} from './authStore';
import type { Session } from '@/types';
import { startTransition } from 'react';

export interface WebSocketMessageData {
  id?: number | string;
  user_id?: number;
  type?: string;
  chat_id?: number;
  message_id?: number;
  message?: string;
  token?: string;
  userId?: number;
  days?: number;
  value?: string;
  /** Server-set edit timestamp (ISO string) in message_updated payload */
  edit_date?: string | null;
  media?: File;
  reaction?: { reaction_type: string };
  object_id?: number;
  first_message?: string;
  session?: Session;
  url?: string;
}

export interface WebSocketMessage {
  type: string;
  chat_id?: number;
  data?: WebSocketMessageData;
  temp_chat_id?: number;
  chat?: unknown;
  message_id?: number;
  message?: string;
  token?: string;
  userId?: number;
  days?: number;
  id?: number;
  session?: Session;
}

interface WebSocketEventMap {
  connected: (data: null) => void;
  disconnected: (data: { code: number; reason: string }) => void;
  error: (error: Error) => void;
  message: (data: WebSocketMessage) => void;
  chat_created: (
    data: WebSocketMessage & { temp_chat_id?: number; chat?: unknown },
  ) => void;
  chat_deleted: (data: WebSocketMessage) => void;
  chat_message: (data: WebSocketMessage) => void;
  message_updated: (data: WebSocketMessage) => void;
  message_deleted: (data: WebSocketMessage) => void;
  message_reaction: (data: WebSocketMessage) => void;
  message_viewed: (data: WebSocketMessage) => void;
  connection_established: (data: WebSocketMessage) => void;
  connection_open: (
    data: WebSocketMessage & { authenticated?: boolean },
  ) => void;
  login_response: (
    data: WebSocketMessage & {
      access?: string;
      refresh?: string;
      user?: unknown;
      error?: string;
    },
  ) => void;
  signup_response: (
    data: WebSocketMessage & {
      access?: string;
      refresh?: string;
      user?: unknown;
      error?: string;
    },
  ) => void;
  chats: (data: WebSocketMessage & { chats?: unknown[] }) => void;
  general_info: (
    data: WebSocketMessage & {
      success?: boolean;
      user?: unknown;
      active_wallpaper?: unknown;
      error?: string;
    },
  ) => void;
  refresh_token_response: (
    data: WebSocketMessage & { access?: string },
  ) => void;
  contacts: (data: WebSocketMessage & { contacts?: unknown[] }) => void;
  chat: (
    data: WebSocketMessage & {
      chat_id?: number;
      media?: unknown;
      members?: unknown;
      messages?: unknown[];
    },
  ) => void;
}

class WebSocketManager {
  private static instance: WebSocketManager;
  private socket: WebSocket | null = null;
  private connectPromise: Promise<void> | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly reconnectDelay = 1000;
  private pingInterval: number | null = null;
  private reconnectTimeout: number | null = null;
  private isManualDisconnect = false;
  private eventHandlers: Map<
    keyof WebSocketEventMap,
    ((data: unknown) => void)[]
  > = new Map();

  private unsubscribeTokenListener: (() => void) | null = null;

  constructor() {
    this.unsubscribeTokenListener = onAccessTokenChange((token) => {
      if (!token) {
        this.disconnect();
        return;
      }
      if (this.isConnected()) {
        this.sendMessage({ type: 'auth', token });
      }
    });
  }

  public shutdown() {
    this.disconnect();
    if (this.unsubscribeTokenListener) {
      this.unsubscribeTokenListener();
      this.unsubscribeTokenListener = null;
    }
    this.eventHandlers.clear();
  }

  public static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  public on<K extends keyof WebSocketEventMap>(
    event: K,
    handler: WebSocketEventMap[K],
  ): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  public off<K extends keyof WebSocketEventMap>(
    event: K,
    handler: WebSocketEventMap[K],
  ): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) handlers.splice(index, 1);
    }
  }

  private emit<K extends keyof WebSocketEventMap>(
    event: K,
    data: unknown,
  ): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in WebSocket handler for ${event}:`, error);
        }
      });
    }
  }

  public async connect(): Promise<void> {
    if (
      this.socket?.readyState === WebSocket.CONNECTING ||
      this.socket?.readyState === WebSocket.OPEN
    ) {
      return;
    }
    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = (async () => {
      try {
        this.cleanupPing();
        this.cleanupReconnect();
        this.isManualDisconnect = false;

        if (this.socket) {
          this.socket.close();
          this.socket = null;
        }

        const token: string | null = getAccessToken();

        const ws_protocol =
          window.location.protocol === 'https:' ? 'wss://' : 'ws://';
        const ws_host = window.location.hostname;
        let ws_port: number | null = null;

        if (
          ws_host === 'localhost' ||
          ws_host === '127.0.0.1' ||
          ws_host === '192.168.1.68'
        ) {
          ws_port = 8000;
        }

        let url: string;
        if (ws_port) {
          url = token
            ? `${ws_protocol}${ws_host}:${ws_port}/ws/socket-server/?token=${token}`
            : `${ws_protocol}${ws_host}:${ws_port}/ws/socket-server/`;
        } else {
          url = token
            ? `${ws_protocol}${ws_host}/ws/socket-server/?token=${token}`
            : `${ws_protocol}${ws_host}/ws/socket-server/`;
        }

        try {
          this.socket = new WebSocket(url);

          this.socket.onopen = () => {
            this.reconnectAttempts = 0;
            this.emit('connected', null);

            const t = getAccessToken();
            if (t) {
              this.sendMessage({ type: 'auth', token: t });
            }
          };

          this.socket.onmessage = (e: MessageEvent) => this.handleMessage(e);

          this.socket.onclose = (e: CloseEvent) => {
            console.log(
              `WebSocket closed. Code: ${e.code}, Reason: ${e.reason}`,
            );
            this.emit('disconnected', { code: e.code, reason: e.reason });

            if (this.isManualDisconnect) return;
            if (e.code === 1000 || e.code === 1001) return;

            this.attemptReconnection();
          };

          this.socket.onerror = (err: Event) => {
            console.error('WebSocket error:', err);
            this.emit('error', err);
          };
        } catch (err) {
          console.error('Failed to create WebSocket connection:', err);
          this.emit('error', err);
        }
      } finally {
        this.connectPromise = null;
      }
    })();

    return this.connectPromise;
  }

  private cleanupPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private cleanupReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private handleMessage(e: MessageEvent) {
    let data: WebSocketMessage;
    try {
      data = JSON.parse(e.data);
    } catch (err) {
      console.error('Error parsing WS message:', err);
      this.emit('error', err);
      return;
    }
    queueMicrotask(() => {
      this.emit('message', data);
      if (
        data.type === 'connection_established' &&
        (data as { access?: string }).access
      ) {
        setAccessToken((data as unknown as { access: string }).access);
      }
      const runSwitch = () => {
        switch (data.type) {
          case 'connection_established':
            this.emit('connection_established', data);
            break;
          case 'connection_open':
            this.emit('connection_open', data);
            break;
          case 'login_response':
            this.emit('login_response', data);
            break;
          case 'signup_response':
            this.emit('signup_response', data);
            break;
          case 'pong':
            break;
          case 'error':
            console.error('WS error:', data.message);
            this.emit('error', data);
            break;
          case 'chat_created':
            if (data.chat) this.emit('chat_created', data);
            break;
          case 'chat_deleted':
            if (data.chat_id !== undefined) this.emit('chat_deleted', data);
            break;
          case 'chat_message':
            if (data.data && data.chat_id !== undefined)
              this.emit('chat_message', data);
            break;
          case 'message_updated':
            if (data.data && data.chat_id !== undefined)
              this.emit('message_updated', data);
            break;
          case 'message_deleted': {
            const raw = data as {
              chat_id?: number;
              message_id?: number;
              data?: { chat_id?: number; message_id?: number };
            };
            const chatId = raw.chat_id ?? raw.data?.chat_id;
            const messageId = raw.message_id ?? raw.data?.message_id;
            if (
              chatId !== undefined &&
              chatId !== null &&
              messageId !== undefined &&
              messageId !== null
            ) {
              this.emit('message_deleted', {
                ...data,
                chat_id: Number(chatId),
                message_id: Number(messageId),
              });
            }
            break;
          }
          case 'message_reaction':
            if (data.message_id) this.emit('message_reaction', data);
            break;
          case 'message_viewed':
            if (data.message_id) this.emit('message_viewed', data);
            break;
          case 'chats':
            this.emit('chats', data);
            break;
          case 'general_info':
            this.emit('general_info', data);
            break;
          case 'refresh_token_response':
            this.emit('refresh_token_response', data);
            break;
          case 'contacts':
            this.emit('contacts', data);
            break;
          case 'chat':
            this.emit('chat', data);
            break;
        }
      };
      if (
        data.type === 'chat_created' ||
        data.type === 'chat_message' ||
        data.type === 'chat_deleted'
      ) {
        runSwitch();
      } else {
        startTransition(runSwitch);
      }
    });
  }

  private attemptReconnection(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;

      const delay =
        this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

      console.log(
        `Reconnecting in ${delay}ms (Attempt ${this.reconnectAttempts})`,
      );

      this.reconnectTimeout = window.setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
      this.emit('error', new Error('Max reconnection attempts reached'));
    }
  }

  // private startPingInterval() {
  //   this.cleanupPing();
  //   this.sendPing();
  //   this.pingInterval = window.setInterval(() => this.sendPing(), 30_000);
  // }

  // private sendPing() {
  //   if (this.socket && this.socket.readyState === WebSocket.OPEN) {
  //     this.socket.send(JSON.stringify({ type: 'ping' }));
  //   }
  // }

  public sendMessage(message: WebSocketMessage): boolean {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
      return true;
    }
    if (this.socket?.readyState !== WebSocket.CONNECTING) {
      console.error('WebSocket not open', this.socket?.readyState);
    }
    return false;
  }

  sendCreateChat(payload: { user_id: number; first_message: string }) {
    this.sendMessage({
      type: 'create_chat',
      data: payload,
    });
  }

  public sendChatMessage(chatId: number, message: string) {
    return this.sendMessage({
      type: 'chat_message',
      chat_id: chatId,
      data: { value: message },
    });
  }

  public sendDeleteChat(chatId: number) {
    return this.sendMessage({
      type: 'delete_chat',
      chat_id: chatId,
    });
  }

  public sendMessageReaction(messageId: number, reaction: unknown) {
    return this.sendMessage({
      type: 'message_reaction',
      message_id: messageId,
      data: reaction,
    });
  }

  public sendMessageViewed(messageId: number) {
    return this.sendMessage({ type: 'message_viewed', message_id: messageId });
  }

  public requestRefreshToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }
      const timeoutId = window.setTimeout(() => {
        this.off('refresh_token_response', handleResponse);
        this.off('message', handleError);
        reject(new Error('Refresh token timeout'));
      }, 10000);

      const handleResponse = (data: WebSocketMessage & { access?: string }) => {
        if (data.type !== 'refresh_token_response' || !data.access) return;
        window.clearTimeout(timeoutId);
        this.off('refresh_token_response', handleResponse);
        this.off('message', handleError);
        resolve(data.access);
      };

      const handleError = (data: WebSocketMessage) => {
        if (data.type !== 'error') return;
        window.clearTimeout(timeoutId);
        this.off('refresh_token_response', handleResponse);
        this.off('message', handleError);
        reject(
          new Error((data as { message?: string }).message ?? 'Refresh failed'),
        );
      };

      this.on('refresh_token_response', handleResponse);
      this.on('message', handleError);
      this.sendMessage({ type: 'refresh_token' });
    });
  }

  public disconnect() {
    this.isManualDisconnect = true;
    this.connectPromise = null;
    this.reconnectAttempts = 0;
    this.cleanupPing();
    this.cleanupReconnect();
    if (this.socket) this.socket.close(1000, 'Manual disconnect');
  }

  public isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  /**
   * Returns a promise that resolves when the connection is established (authenticated or anonymous).
   * If already connected, resolves immediately. Otherwise calls connect() and waits for connection_established or connection_open.
   * Rejects immediately if the connection is closed (e.g. 4001 Unauthorized when logged out).
   */
  public waitForConnection(timeoutMs = 15000): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        window.clearTimeout(timeoutId);
        this.off('connection_established', onEstablished);
        this.off('connection_open', onOpen);
        this.off('disconnected', onDisconnected);
      };

      const timeoutId = window.setTimeout(() => {
        cleanup();
        reject(new Error('Connection timeout'));
      }, timeoutMs);

      const onEstablished = () => {
        cleanup();
        resolve();
      };

      const onOpen = () => {
        cleanup();
        resolve();
      };

      const onDisconnected = (data: { code: number; reason: string }) => {
        cleanup();
        reject(new Error(`Connection closed: ${data.code} ${data.reason}`));
      };

      this.on('connection_established', onEstablished);
      this.on('connection_open', onOpen);
      this.on('disconnected', onDisconnected);
      this.connect();
    });
  }

  public async requestLogin(
    username: string,
    password: string,
  ): Promise<{ access: string; refresh: string; user: unknown }> {
    await this.waitForConnection();
    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        this.off('login_response', handleResponse);
        this.off('message', handleError);
        reject(new Error('Login timeout'));
      }, 15000);

      const handleResponse = (
        data: WebSocketMessage & {
          access?: string;
          refresh?: string;
          user?: unknown;
          error?: string;
        },
      ) => {
        if (data.type !== 'login_response') return;
        window.clearTimeout(timeoutId);
        this.off('login_response', handleResponse);
        this.off('message', handleError);
        if (data.error) {
          reject(new Error(data.error));
          return;
        }
        if (data.access && data.user) {
          resolve({
            access: data.access,
            refresh: data.refresh ?? '',
            user: data.user,
          });
        } else {
          reject(new Error('Invalid login response'));
        }
      };

      const handleError = (msg: WebSocketMessage) => {
        if (msg.type !== 'error') return;
        window.clearTimeout(timeoutId);
        this.off('login_response', handleResponse);
        this.off('message', handleError);
        reject(
          new Error((msg as { message?: string }).message ?? 'Login failed'),
        );
      };

      this.on('login_response', handleResponse);
      this.on('message', handleError);
      const sent = this.sendMessage({
        type: 'login',
        username,
        password,
      } as WebSocketMessage);
      if (!sent) {
        window.clearTimeout(timeoutId);
        this.off('login_response', handleResponse);
        this.off('message', handleError);
        reject(new Error('WebSocket not connected'));
      }
    });
  }

  public requestSignup(
    username: string,
    email: string,
    password: string,
  ): Promise<{ access: string; refresh: string; user: unknown }> {
    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        this.off('signup_response', handleResponse);
        this.off('message', handleError);
        reject(new Error('Signup timeout'));
      }, 15000);

      const handleResponse = (
        data: WebSocketMessage & {
          access?: string;
          refresh?: string;
          user?: unknown;
          error?: string;
        },
      ) => {
        if (data.type !== 'signup_response') return;
        window.clearTimeout(timeoutId);
        this.off('signup_response', handleResponse);
        this.off('message', handleError);
        if (data.error) {
          reject(new Error(data.error));
          return;
        }
        if (data.access && data.refresh && data.user) {
          resolve({
            access: data.access,
            refresh: data.refresh,
            user: data.user,
          });
        } else {
          reject(new Error('Invalid signup response'));
        }
      };

      const handleError = (msg: WebSocketMessage) => {
        if (msg.type !== 'error') return;
        window.clearTimeout(timeoutId);
        this.off('signup_response', handleResponse);
        this.off('message', handleError);
        reject(
          new Error((msg as { message?: string }).message ?? 'Signup failed'),
        );
      };

      this.on('signup_response', handleResponse);
      this.on('message', handleError);
      this.sendMessage({
        type: 'signup',
        username,
        email,
        password,
      } as WebSocketMessage);
    });
  }
}

export const websocketManager = WebSocketManager.getInstance();
