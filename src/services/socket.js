/**
 * WebSocket Service
 * Manages Socket.IO connection to the backend server
 */

import { io } from "socket.io-client";

// Use ONLY environment variable in production
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;

class SocketService {
  constructor() {
    this.socket = null;
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    if (!SOCKET_URL) {
      console.error("❌ VITE_SOCKET_URL is NOT defined!");
      return;
    }

    if (!this.socket) {
      this.socket = io(SOCKET_URL, {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        timeout: 10000
      });

      this.socket.on("connect", () => {
        console.log("✅ Connected to WebSocket server");
      });

      this.socket.on("disconnect", () => {
        console.log("❌ Disconnected from WebSocket server");
      });

      this.socket.on("connect_error", (error) => {
        console.error("🚨 WebSocket connection error:", error);
      });
    }
    return this.socket;
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Get socket instance
   */
  getSocket() {
    if (!this.socket) {
      this.connect();
    }
    return this.socket;
  }

  /**
   * Emit event
   */
  emit(event, data) {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }

  /**
   * Listen to event
   */
  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }
}

// Export singleton instance
export default new SocketService();
