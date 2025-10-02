import { applyTrackerFilters } from "../utils/filters.js";

export class WsTracker extends TrackerStrategy {
  constructor(trackerServer) {
    super();
    this.trackerServer = trackerServer;
  }

  start(httpServer) {
    this.trackerServer.on("start", async (params, cb) => {
      const infoHash = params.info_hash?.toString("hex");
      const ip = params.ip || params.peer?.ip;

      await applyTrackerFilters(
        infoHash,
        {
          passkey: params.passkey, // en ws announce deberías mandar esto como parte de query o payload
          ip,
          ipv6: params.ipv6,
        },
        (err) => {
          if (err) return cb(err);
          cb(null);
        }
      );
    });

    this.trackerServer.listen({ server: httpServer, ws: true });
    console.log("Tracker WS habilitado");
  }

  handleRequest(req, res) {
    this.trackerServer.onHttpRequest(req, res);
  }
}
