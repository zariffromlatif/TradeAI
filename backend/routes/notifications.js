const express = require("express");
const Notification = require("../models/Notification");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/mine", requireAuth, async (req, res) => {
  try {
    const rows = await Notification.find({ userId: req.auth.sub })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/:id/read", requireAuth, async (req, res) => {
  try {
    const row = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.auth.sub },
      { read: true },
      { new: true },
    );
    if (!row) return res.status(404).json({ message: "Notification not found" });
    res.json(row);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
