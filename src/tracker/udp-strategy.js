import { applyTrackerFilters } from "../utils/filters.js";

export class UdpTracker extends TrackerStrategy {
  constructor(trackerServer, port) {
    super();
    this.trackerServer = trackerServer;
    this.port = port;
  }

  start() {
    this.trackerServer.on("start", async (params, cb) => {
      const infoHash = params.info_hash?.toString("hex"); // viene como Buffer
      const ip = params.ip || params.peer?.ip;

      await applyTrackerFilters(
        infoHash,
        {
          passkey: params.passkey, // ojo: hay que parsear el announce URL con passkey
          ip,
          ipv6: params.ipv6,
        },
        (err) => {
          if (err) return cb(err);
          cb(null); // sigue normal
        }
      );
    });

    this.trackerServer.listen(this.port, "0.0.0.0", () => {
      console.log(`Tracker UDP escuchando en udp://0.0.0.0:${this.port}`);
    });
  }

  handleRequest() {
    // UDP no usa request de Express
  }
}
