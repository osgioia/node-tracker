import { TrackerStrategy } from './tracker-strategy.js';

export class UdpTracker extends TrackerStrategy {
  constructor(trackerServer, port) {
    super();
    this.trackerServer = trackerServer;
    this.port = port;
  }

  start() {
    this.trackerServer.listen(this.port, '0.0.0.0', () => {
      console.log(`Tracker UDP escuchando en udp://0.0.0.0:${this.port}`);
    });
  }

  handleRequest() {
    // UDP no usa request de Express
  }
}
