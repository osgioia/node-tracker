import express from "express";
import {
  listAllIPBan,
  createIPBan,
  updateIPBan,
  deleteIPBan,
  bulkCreateIPBan
} from "./ipban.service.js";

import { Counter } from "prom-client";

export const iPBanRouter = express.Router();

const getRequestCounter = new Counter({
  name: "get_ipban_requests",
  help: "Count get IPBans"
});

const postRequestCounter = new Counter({
  name: "create_ipban_requests",
  help: "Count create IPBan"
});

const putRequestCounter = new Counter({
  name: "update_ipban_requests",
  help: "Count update IPBan"
});

const deleteRequestCounter = new Counter({
  name: "deleted_ipban_requests",
  help: "Count deleted IPBan"
});

iPBanRouter.get("/", async (req, res) => {
  try {
    const bans = await listAllIPBan();
    getRequestCounter.inc();
    res.json(bans);
  } catch (error) {
    res.status(500).json({ error: "Error to get ips" });
  }
});

iPBanRouter.post("/", async (req, res) => {
  try {
    const { fromIP, toIP, reason } = req.body;
    const newBan = await createIPBan({ fromIP, toIP, reason });
    postRequestCounter.inc();
    res.status(201).json(newBan);
  } catch (error) {
    res.status(400).json({ error: "Error to create ip to ban." });
  }
});

iPBanRouter.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { fromIP, toIP, reason } = req.body;
    const updatedBan = await updateIPBan(parseInt(id), {
      fromIP,
      toIP,
      reason
    });
    putRequestCounter.inc();
    res.json(updatedBan);
  } catch (error) {
    res.status(400).json({ error: "Error al update ip to ban." });
  }
});

iPBanRouter.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await deleteIPBan(parseInt(id));
    deleteRequestCounter.inc();
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: "Error to delete ip." });
  }
});

iPBanRouter.post("/bulk", async (req, res) => {
  try {
    const dataArray = req.body;
    const result = await bulkCreateIPBan(dataArray);
    postRequestCounter.inc();
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: "Error to create bulk ip to ban." });
  }
});
