import { Server } from "bittorrent-tracker";
import express from "express";
import dotenv from "dotenv";
import morgan from "morgan";
import { register } from 'prom-client';
import { checkTorrent, bannedIPs } from "./src/utils/utils.js";
import { torrentRouter } from "./src/torrent/torrent.router.js";

dotenv.config();

const app = express();
app.use(express.json());

let accessLogStream
if (process.env.NODE_ENV === 'production') {
  accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' })
}

app.use(morgan('combined', { stream: accessLogStream }))
app.use("/api/torrent", torrentRouter);
app.get("/metrics", async (req,res) => {
  res.set("Content-Type", register.contentType)
  res.end(await register.metrics())
})

const expressPort = process.env.PORT || 3000;

const server = new Server({
  udp: process.env.UDP,
  http: process.env.HTTP,
  interval: process.env.ANNOUNCE_INTERVAL,
  ws: process.env.WS,
  stats: process.env.STATS,
  trustProxy: process.env.TRUST_PROXY,
  filter: async (infoHash, params, callback) => {
    await checkTorrent(infoHash, callback);
    await bannedIPs(params, callback)
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
  console.log(`Torrent Tracker running at ${expressPort}`);
});
