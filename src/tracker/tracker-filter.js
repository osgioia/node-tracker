import { checkPasskey, bannedIPs, checkTorrent } from '../utils/utils.js';
import { logMessage } from '../utils/utils.js';

export async function applyTrackerFilters(infoHash, params, callback) {
  try {
    // Valida passkey
    await checkPasskey(params, callback);

    // IPs bloqueadas
    await bannedIPs(params, callback);

    // Torrent permitido
    await checkTorrent(infoHash, callback);

  } catch (error) {
    logMessage('error', `Error en filtros del tracker: ${error.message}`);
    callback(error);
  }
}
