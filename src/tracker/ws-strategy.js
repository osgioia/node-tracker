import { TrackerStrategy } from './tracker-strategy.js';

export class WsTracker extends TrackerStrategy {
  constructor(trackerServer) {
    super();
    this.trackerServer = trackerServer;
  }

  start(httpServer) {
    // WebSocket tracker sobre el mismo HTTP server
    this.trackerServer.listen({ server: httpServer, ws: true });
    console.log('Tracker WS habilitado');
  }

  handleRequest(req, res) {
    this.trackerServer.onHttpRequest(req, res);
  }
}
