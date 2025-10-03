export class TrackerStrategy {
  constructor(trackerConfig) {
    this.trackerConfig = trackerConfig;
  }

  start() {
    throw new Error('start() debe implementarse en la subclase');
  }

  handleRequest() {
    throw new Error('handleRequest() debe implementarse en la subclase');
  }
}
