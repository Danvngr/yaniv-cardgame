import { GameRoom } from './Room';
import { RoomSettings, ClientRoom } from '../types';

const ROOM_CLEANUP_INTERVAL_MS = 60000; // Check every minute
const ROOM_INACTIVE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export class RoomManager {
  private rooms: Map<string, GameRoom> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanupInterval();
  }

  // Generate unique room code
  private generateRoomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code: string;
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
    } while (this.rooms.has(code));
    return code;
  }

  // Check if room code exists
  roomExists(code: string): boolean {
    return this.rooms.has(code.toUpperCase());
  }

  // Create new room
  createRoom(
    hostId: string,
    hostName: string,
    hostAvatar: string,
    settings: RoomSettings,
    customCode?: string
  ): GameRoom | null {
    const code = customCode?.toUpperCase() || this.generateRoomCode();

    // Check if code is taken
    if (this.rooms.has(code)) {
      return null;
    }

    const room = new GameRoom(code, hostId, hostName, hostAvatar, settings);
    this.rooms.set(code, room);

    console.log(`[RoomManager] Room created: ${code} by ${hostName}`);
    return room;
  }

  // Get room by code
  getRoom(code: string): GameRoom | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  // Delete room
  deleteRoom(code: string): boolean {
    const room = this.rooms.get(code.toUpperCase());
    if (room) {
      room.destroy();
      this.rooms.delete(code.toUpperCase());
      console.log(`[RoomManager] Room deleted: ${code}`);
      return true;
    }
    return false;
  }

  // Get all active rooms (for debugging/admin)
  getAllRooms(): ClientRoom[] {
    return Array.from(this.rooms.values()).map(room => room.toClientRoom());
  }

  // Get room count
  getRoomCount(): number {
    return this.rooms.size;
  }

  // Cleanup inactive rooms
  private cleanupInactiveRooms(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [code, room] of this.rooms) {
      // Delete if:
      // 1. Room has been inactive for too long
      // 2. Room is empty (no players)
      // 3. Room is finished and has been so for a while
      if (
        now - room.lastActivity > ROOM_INACTIVE_TIMEOUT_MS ||
        room.playerCount === 0
      ) {
        toDelete.push(code);
      }
    }

    for (const code of toDelete) {
      this.deleteRoom(code);
    }

    if (toDelete.length > 0) {
      console.log(`[RoomManager] Cleaned up ${toDelete.length} inactive rooms`);
    }
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveRooms();
    }, ROOM_CLEANUP_INTERVAL_MS);
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    for (const room of this.rooms.values()) {
      room.destroy();
    }
    this.rooms.clear();
  }
}

// Singleton instance
export const roomManager = new RoomManager();
