import { db } from "../utils/db.server.js";

async function addTorrent(infoHash, name, category, tags) {
  try {
    await db.torrent.create({
      data: {
        infoHash: infoHash,
        name: name,
        category: { create: { name: category } },
        tags: { create: tags.split(",").map((tag) => ({ name: tag })) },
      },
    });
    console.log("Torrent agregado correctamente");
  } catch (error) {
    console.error("Error al agregar el torrent:", error);
  } finally {
    await db.$disconnect();
  }
}

async function searchTorrent(name, category) {
  try {
    const torrents = await db.torrent.findMany({
      where: {
        name: { contains: name || "" },
        category: { name: category || undefined },
      },
      include: {
        category: true,
        tags: true,
      },
    });

    return torrents;
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en la búsqueda de torrents" });
  } finally {
    await db.$disconnect();
  }
}

async function updateTorrent(id, data) {
  try {
    const updatedTorrent = await db.torrent.update({
      where: { id },
      data,
    });
    console.log("Torrent actualizado correctamente:", updatedTorrent);
  } catch (error) {
    console.error("Error al actualizar el torrent:", error);
  } finally {
    await db.$disconnect();
  }
}

async function deleteTorrent(id) {
  try {
    await db.torrent.delete({
      where: { id },
    });
    console.log("Torrent eliminado correctamente");
  } catch (error) {
    console.error("Error al eliminar el torrent:", error);
  } finally {
    await db.$disconnect();
  }
}

export { addTorrent, deleteTorrent, searchTorrent, updateTorrent };
