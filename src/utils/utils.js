import { db } from "./db.server.js";

async function checkTorrent(infoHash, params, callback) {
  try {
    const torrent = await db.torrent.findUnique({
      where: { infoHash },
    });

    if (torrent) {
      await db.peer.create({
        data: {
          torrent: { connect: { id: torrent.id } }, // Conectar al torrent existente por su ID
          ip: params.ip,
          port: params.port,
          uploaded: params.uploaded,
          downloaded: params.downloaded,
          left: params.left,
          event: params.event,
        },
      });
      callback(null);
    } else {
      throw new Error("Torrent no encontrado");
    }
  } catch (error) {
    callback(error);
  } finally {
    await db.$disconnect();
  }
}

export { checkTorrent };
