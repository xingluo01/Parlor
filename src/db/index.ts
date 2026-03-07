/**
 * Parlor Database Layer
 * Re-exports API client for server-first storage
 *
 * This file provides a unified interface for data operations.
 * Currently uses REST API (apiClient) for server-first storage.
 */

// Re-export everything from the API client
export {
  initializeDatabase,
  characterOps,
  chatOps,
  personaOps,
  connectionOps,
  presetOps,
  regexOps,
  lorebookOps,
  worldInfoOps,
  settingsOps,
  backupOps,
  groupChatOps,
  dataBankOps,
} from '../services/apiClient';
