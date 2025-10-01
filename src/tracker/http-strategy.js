import { TrackerStrategy } from './tracker-strategy.js';

export class HttpTracker extends TrackerStrategy {
  constructor(trackerServer, rateLimiter) {
    super();
    this.trackerServer = trackerServer;
    this.rateLimiter = rateLimiter;
  }

  start(app) {
    // Rutas HTTP
    app.use('/announce', this.rateLimiter, (req, res) => this.handleRequest(req, res));
    app.use('/scrape', this.rateLimiter, (req, res) => this.handleRequest(req, res));
  }

  handleRequest(req, res) {
    this.trackerServer.onHttpRequest(req, res);
  }
}
