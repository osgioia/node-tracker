import { Server } from 'bittorrent-tracker';
import express  from "express"

const app = express();
const trackerPort = 3030;
const expressPort = 3000;

app.all("/", (req, res) => {
  console.log("Just got a request!");
  res.send("Yo!");
});

const server = new Server({
  udp: true,
  http: true,
  ws: true,
  stats: true,
  filter: (infoHash, params, callback) => {},
});

app.listen(expressPort, () => {
    console.log(`Servidor Express.js en ejecución en el puerto ${expressPort}`);
  });

server.listen(trackerPort, () => {
  console.log('Tracker en ejecución en el puerto 8080');
});
