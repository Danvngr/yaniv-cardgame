import { GameRoom } from './Room';
import { RoomSettings } from '../types';

const ROOM_CLEANUP_INTERVAL_MS = 60000; // Check every minute
const ROOM_INACTIVE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const ROOM_EMPTY_GRACE_MS = 3 * 60 * 1000; // Don't delete empty room for 3 min (guest may join)

export class RoomManager {
  private rooms: Map<string, GameRoom> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

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
      // 2. Room is empty AND past grace period (so guest has time to join after host creates)
      const emptyGraceExpired = room.playerCount === 0 && (now - room.createdAt > ROOM_EMPTY_GRACE_MS);
      if (
        now - room.lastActivity > ROOM_INACTIVE_TIMEOUT_MS ||
        emptyGraceExpired
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
