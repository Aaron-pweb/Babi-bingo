import type { BingoCard, GameState, Player, RoomInfo, WinPattern } from './types';

// ─────────────────────────────────────────────
//  Client → Server Events
// ─────────────────────────────────────────────

export interface ClientToServerEvents {
  /** Player joins a game room */
  join_room: (payload: { roomCode: string; token: string }) => void;

  /** TV display joins a room (read-only) */
  join_display: (payload: { roomCode: string }) => void;

  /** Player claims they have Bingo */
  claim_bingo: (payload: { roomCode: string }) => void;

  /** Operator: start the game */
  start_game: (payload: { roomCode: string }) => void;

  /** Operator: pause auto-calling */
  pause_game: (payload: { roomCode: string }) => void;

  /** Operator: resume auto-calling */
  resume_game: (payload: { roomCode: string }) => void;

  /** Operator: kick a player */
  kick_player: (payload: { roomCode: string; targetUuid: string }) => void;

  /** Request full room state (used for reconnect sync) */
  request_sync: (payload: { roomCode: string }) => void;

  /** Operator: change win pattern before game starts — H4 */
  set_pattern: (payload: { roomCode: string; pattern: WinPattern }) => void;
}

// ─────────────────────────────────────────────
//  Server → Client Events
// ─────────────────────────────────────────────

export interface ServerToClientEvents {
  /** Sent to a player after they join — confirms connection */
  room_joined: (payload: { room: RoomInfo; players: Player[] }) => void;

  /** Broadcast to room when a player connects */
  player_joined: (payload: { player: Player; playerCount: number }) => void;

  /** Broadcast to room when a player disconnects */
  player_left: (payload: { uuid: string; nickname: string; playerCount: number }) => void;

  /** Sent to each player when game begins — contains their unique card */
  game_starting: (payload: { card?: BingoCard; pattern: WinPattern; intervalSeconds: number }) => void;

  /** Broadcast to ALL clients (players + display) when a number is drawn */
  number_called: (payload: {
    number: number;
    column: 'B' | 'I' | 'N' | 'G' | 'O';
    calledNumbers: number[];
    remaining: number;
  }) => void;

  /** Game paused by operator */
  game_paused: (payload: { reason?: string }) => void;

  /** Game resumed by operator */
  game_resumed: () => void;

  /** A player won! Broadcast to everyone */
  game_won: (payload: {
    winner: { uuid: string; nickname: string };
    pattern: WinPattern;
    calledNumbers: number[];
  }) => void;

  /** Bingo claim was invalid */
  false_alarm: (payload: { uuid: string; nickname: string; cooldownSeconds: number }) => void;

  /** A player was kicked */
  player_kicked: (payload: { uuid: string }) => void;

  /** Full state sync after reconnect */
  sync_state: (payload: {
    room: RoomInfo;
    card?: BingoCard;
    players: Player[];
  }) => void;

  /** Server-side error */
  game_error: (payload: { code: string; message: string }) => void;
}

export type GameState_Payload = GameState;
