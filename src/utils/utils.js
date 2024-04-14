import { db } from "./db.server.js";

async function checkTorrent(infoHash, callback) {
  try {
    const torrent = await db.torrent.findUnique({
      where: { infoHash },
    });
    if (!torrent) {
      throw new Error("Torrent not found");
    }
    callback(null)
  } catch (error) {
    callback(error);
  } finally {
    await db.$disconnect();
  }
}

async function bannedIPs(params, callback) {
  try {
    const bannedIPs = await db.iPBan.findMany();
    const ip = params.ipv6 || params.ip;
    const isBanned = bannedIPs.some(ipBan => ip >= ipBan.fromIP && ip <= ipBan.toIP);
    if (isBanned) {
      callback(new Error('IP Banned'));
    } else {
      callback(null);
    }
  } catch (error) {
    callback(error);
  } finally {
    await db.$disconnect();
  }
}

export { checkTorrent, bannedIPs };
