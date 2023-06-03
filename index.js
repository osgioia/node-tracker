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

const onHttpRequest = server.onHttpRequest.bind(server)
app.get('/announce', onHttpRequest)
app.get('/scrape', onHttpRequest)
app.get('/stats', onHttpRequest)

app.listen(3000,  () => {
    console.log(`Servidor Express.js en ejecución en el puerto 8080`);
  })