import {
  checkPassKey,
  bannedIPs,
  checkTorrent,
  logMessage
} from '../utils/utils.js';

export async function applyTrackerFilters(infoHash, params, callback) {
  try {
    // Valida passkey
    await checkPassKey(params, callback);

    // IPs bloqueadas
    await bannedIPs(params, callback);

    // Torrent permitido
    await checkTorrent(infoHash, callback);
  } catch (error) {
    logMessage('error', `Tracker filter error: ${error.message}`);
    callback(error);
  }
}
