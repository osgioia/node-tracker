import { db } from "../utils/db.server.js";
import { logMessage } from "../utils/utils.js";
import magnet from "magnet-uri";

async function addTorrent(infoHash, name, category, tags, uploadedById) {
  try {
    const torrentData = {
      infoHash: infoHash,
      name: name,
      uploadedById: uploadedById
    };

    // Add category if provided
    if (category) {
      torrentData.category = {
        connectOrCreate: {
          where: { name: category },
          create: { name: category }
        }
      };
    }

    // Add tags if provided
    if (tags && tags.trim()) {
      torrentData.tags = {
        connectOrCreate: tags.split(",").map((tag) => ({
          where: { name: tag.trim() },
          create: { name: tag.trim() }
        }))
      };
    }

    const newTorrent = await db.torrent.create({
      data: torrentData,
      include: {
        category: true,
        tags: true,
        uploadedBy: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });

    logMessage("info", `Torrent added: ${name} by user ${uploadedById}`);
    return newTorrent;
  } catch (error) {
    logMessage("error", `Error adding torrent: ${error.message}`);
    throw error;
  }
}

function generateMagnetURI(infoHash, name, hostname) {
  try {
    return magnet.encode({
      xt: `urn:btih:${infoHash}`,
      dn: name,
      tr: `${hostname}:${process.env.PORT}/announce`,
    });
  } catch (err) {
    throw new Error("Error generating magnet URI");
  }
}

async function getTorrent(infoHash, hostname) {
  try {
    const torrent = await db.torrent.findFirst({
      where: {
        infoHash: infoHash
      },
      include: {
        category: true,
        tags: true,
        uploadedBy: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });

    if (!torrent) {
      throw new Error("Torrent not found");
    }

    const uri = generateMagnetURI(infoHash, torrent.name, hostname);
    return uri;
  } catch (error) {
    logMessage("error", `Error getting torrents: ${error.message}`);
    throw error;
  }
}

async function updateTorrent(id, data) {
  try {
    const updatedTorrent = await db.torrent.update({
      where: { id },
      data,
      include: {
        category: true,
        tags: true,
        uploadedBy: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });
    logMessage("info", `Torrent updated: ${updatedTorrent.name}`);
    return updatedTorrent;
  } catch (error) {
    logMessage("error", `Error updating torrent: ${error.message}`);
    throw error;
  }
}

async function deleteTorrent(id) {
  try {
    await db.torrent.delete({
      where: { id }
    });
    logMessage("info", "Torrent deleted");
  } catch (error) {
    logMessage("error", `Error deleting torrent: ${error.message}`);
  }
}

export {
  addTorrent,
  deleteTorrent,
  getTorrent as searchTorrent,
  updateTorrent
};
