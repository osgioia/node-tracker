export class TrackerStrategy {
  constructor(trackerConfig) {
    this.trackerConfig = trackerConfig;
  }

  start() {
    throw new Error('start() debe implementarse en la subclase');
  }

  handleRequest(req, res) {
    throw new Error('handleRequest() debe implementarse en la subclase');
  }
}
