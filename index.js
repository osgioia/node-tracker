import { Server } from "bittorrent-tracker";
import express from "express";
import dotenv from "dotenv";
import morgan from "morgan";
import { checkTorrent } from "./src/utils/utils.js";
import { torrentRouter } from "./src/torrent/torrent.router.js";

dotenv.config();

const app = express();
app.use(express.json());


// create a write stream (in append mode) for production logging
let accessLogStream
if (process.env.NODE_ENV === 'production') {
  accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' })
}

// setup the logger
app.use(morgan('combined', { stream: accessLogStream }))
app.use("/api/torrent", torrentRouter);

const expressPort = process.env.PORT || 3000;

const server = new Server({
  udp: true,
  http: true,
  ws: true,
  stats: true,
  filter: async (infoHash, params, callback) => {
    await checkTorrent(infoHash, callback);
  },
});

const onHttpRequest = server.onHttpRequest.bind(server);
app.get("/announce", onHttpRequest);
app.get("/scrape", onHttpRequest);

process.on('SIGINT', () => {
  console.log(`\nBye bye!`);
  process.exit(0);
})


app.listen(expressPort, () => {
  // Ejecutar tu función personalizada antes de levantar el servidor
  console.log(`Torrent Tracker running at ${expressPort}`);
});
