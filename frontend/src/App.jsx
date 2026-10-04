import { useState } from "react";
import { motion } from "framer-motion";
import { createWalletClient, createPublicClient, custom, http, parseEventLogs } from "viem";
import { defineChain } from "viem";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Blocks,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Layers3,
  Network,
  Radio,
  ShieldCheck,
  Wallet,
  Zap,
} from "lucide-react";

const MONAD_EXPLORER = "https://testnet.monadexplorer.com";

const PARALLEL_BOOK =
  import.meta.env.VITE_PARALLEL_BOOK_ADDRESS || "";

const MONAD_CHAIN_ID = 10143;

const MONAD_CHAIN_HEX = "0x279f";

const monadTestnet = defineChain({
  id: MONAD_CHAIN_ID,
  name: "Monad Testnet",
  nativeCurrency: {
    name: "MON",
    symbol: "MON",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://testnet-rpc.monad.xyz"],
    },
  },
  blockExplorers: {
    default: {
      name: "Monad Explorer",
      url: MONAD_EXPLORER,
    },
  },
});

const monadPublicClient = createPublicClient({
  chain: monadTestnet,
  transport: http("https://testnet-rpc.monad.xyz"),
});

const PARALLEL_BOOK_ABI = [
  {
    type: "event",
    name: "OrderPlaced",
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: "shardId",
        type: "uint256",
      },
      {
        indexed: true,
        name: "id",
        type: "uint256",
      },
      {
        indexed: true,
        name: "trader",
        type: "address",
      },
      {
        indexed: false,
        name: "price",
        type: "uint256",
      },
      {
        indexed: false,
        name: "amount",
        type: "uint256",
      },
      {
        indexed: false,
        name: "side",
        type: "uint8",
      },
    ],
  },
  {
    type: "function",
    name: "shardFor",
    stateMutability: "pure",
    inputs: [
      {
        name: "price",
        type: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
      },
    ],
  },
  {
    type: "function",
    name: "place",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "price",
        type: "uint256",
      },
      {
        name: "amount",
        type: "uint256",
      },
      {
        name: "side",
        type: "uint8",
      },
    ],
    outputs: [
      {
        name: "shardId",
        type: "uint256",
      },
      {
        name: "id",
        type: "uint256",
      },
    ],
  },
];

const shards = [
  {
    id: "S-00",
    range: "0 — 99",
    orders: 18,
    load: 24,
  },
  {
    id: "S-01",
    range: "100 — 199",
    orders: 31,
    load: 41,
  },
  {
    id: "S-02",
    range: "200 — 299",
    orders: 24,
    load: 32,
  },
  {
    id: "S-03",
    range: "300 — 399",
    orders: 42,
    load: 57,
  },
  {
    id: "S-04",
    range: "400 — 499",
    orders: 16,
    load: 21,
  },
  {
    id: "S-05",
    range: "500 — 599",
    orders: 28,
    load: 37,
  },
];

const mockOrders = [
  ["#08421", "0x7A…91F", "BUY", "318.40", "12.00", "S-03"],
  ["#08420", "0xB2…C8A", "SELL", "319.10", "8.50", "S-03"],
  ["#08419", "0x41…E22", "BUY", "317.90", "21.00", "S-03"],
  ["#08418", "0x93…2BC", "SELL", "320.20", "6.00", "S-03"],
  ["#08417", "0x18…A71", "BUY", "316.80", "15.25", "S-03"],
];

function getMetaMaskProvider() {
  if (typeof window === "undefined") {
    return null;
  }

  if (!window.ethereum) {
    return null;
  }

  /*
   * Some browsers expose multiple injected wallets.
   * Prefer MetaMask specifically when possible.
   */
  if (window.ethereum.providers?.length) {
    const metaMask = window.ethereum.providers.find(
      (provider) => provider.isMetaMask
    );

    if (metaMask) {
      return metaMask;
    }
  }

  if (window.ethereum.isMetaMask) {
    return window.ethereum;
  }

  return window.ethereum;
}

async function switchToMonad(provider) {
  const currentChainId = await provider.request({
    method: "eth_chainId",
  });

  if (currentChainId === MONAD_CHAIN_HEX) {
    return;
  }

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [
        {
          chainId: MONAD_CHAIN_HEX,
        },
      ],
    });
  } catch (error) {
    /*
     * 4902 means the chain isn't currently configured
     * in the wallet, so we add it.
     */
    if (error?.code !== 4902) {
      throw error;
    }

    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: MONAD_CHAIN_HEX,
          chainName: "Monad Testnet",
          nativeCurrency: {
            name: "Monad",
            symbol: "MON",
            decimals: 18,
          },
          rpcUrls: ["https://testnet-rpc.monad.xyz"],
          blockExplorerUrls: [
            "https://testnet.monadexplorer.com",
          ],
        },
      ],
    });
  }
}

function Stat({ icon: Icon, label, value, detail }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
          <Icon size={18} />
        </div>

        <span className="text-xs text-white/35">
          {detail}
        </span>
      </div>

      <div className="text-2xl font-semibold tracking-tight">
        {value}
      </div>

      <div className="mt-1 text-sm text-white/45">
        {label}
      </div>
    </div>
  );
}

function SectionTitle({ eyebrow, title, text }) {
  return (
    <div className="max-w-2xl">
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-lime-300">
        {eyebrow}
      </div>

      <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h2>

      <p className="mt-4 text-sm leading-7 text-white/45">
        {text}
      </p>
    </div>
  );
}

export default function App() {
  const [side, setSide] = useState("BUY");

  const [price, setPrice] = useState("318.40");

  const [amount, setAmount] = useState("1.00");

  const [submitted, setSubmitted] = useState(false);

  const [wallet, setWallet] = useState("");

  const [txHash, setTxHash] = useState("");

  const [txError, setTxError] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isConnecting, setIsConnecting] = useState(false);

  // Keep the demo rows, but append orders confirmed on Monad in real time.
  const [liveOrders, setLiveOrders] = useState([]);

  function formatAddress(address) {
    if (!address) {
      return "";
    }

    return `${address.slice(0, 6)}…${address.slice(-4)}`;
  }

  function calculateShard() {
    const numericPrice = Number(price);

    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      return "--";
    }

    return `S-${String(
      Math.floor(numericPrice / 100)
    ).padStart(2, "0")}`;
  }

  async function connectWallet() {
    setTxError("");
    setIsConnecting(true);

    try {
      const provider = getMetaMaskProvider();

      if (!provider) {
        throw new Error(
          "MetaMask was not detected. Please install the MetaMask browser extension and refresh this page."
        );
      }

      /*
       * Explicitly ask MetaMask for permission.
       */
      const accounts = await provider.request({
        method: "eth_requestAccounts",
      });

      if (!accounts || accounts.length === 0) {
        throw new Error(
          "No wallet account was returned by MetaMask."
        );
      }

      /*
       * Automatically move the wallet to Monad Testnet.
       */
      await switchToMonad(provider);

      /*
       * Re-read the account after the network switch.
       */
      const activeAccounts = await provider.request({
        method: "eth_accounts",
      });

      const account =
        activeAccounts?.[0] || accounts[0];

      setWallet(account);

      setTxError("");
    } catch (error) {
      console.error("Wallet connection error:", error);

      if (error?.code === 4001) {
        setTxError(
          "Connection rejected in MetaMask."
        );
      } else {
        setTxError(
          error?.shortMessage ||
            error?.message ||
            "Unable to connect MetaMask."
        );
      }
    } finally {
      setIsConnecting(false);
    }
  }

  async function placeOrder() {
    setTxError("");
    setTxHash("");

    if (typeof window === "undefined") {
      setTxError("Wallet access is unavailable.");
      return;
    }

    const provider = getMetaMaskProvider();

    if (!provider) {
      setTxError(
        "MetaMask was not detected. Please install MetaMask and refresh the page."
      );
      return;
    }

    if (!PARALLEL_BOOK) {
      setTxError(
        "ParallelBook contract address is not configured. Set VITE_PARALLEL_BOOK_ADDRESS in frontend/.env.local."
      );
      return;
    }

    const numericPrice = Number(price);

    const numericAmount = Number(amount);

    if (
      !Number.isFinite(numericPrice) ||
      numericPrice <= 0
    ) {
      setTxError("Enter a valid price.");
      return;
    }

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      setTxError("Enter a valid amount.");
      return;
    }

    try {
      setIsSubmitting(true);

      /*
       * Make sure the wallet is on Monad.
       */
      await switchToMonad(provider);

      const client = createWalletClient({
        chain: monadTestnet,
        transport: custom(provider),
      });

      const accounts = await provider.request({
        method: "eth_accounts",
      });

      if (!accounts || accounts.length === 0) {
        await connectWallet();

        throw new Error(
          "Please connect your wallet first, then try again."
        );
      }

      const account = accounts[0];

      setWallet(account);

      /*
       * Solidity contract uses integers.
       *
       * Example:
       *
       * 318.40 → 31840
       * 1.00   → 100
       */
      const priceValue = BigInt(
        Math.round(numericPrice * 100)
      );

      const amountValue = BigInt(
        Math.round(numericAmount * 100)
      );

      const hash = await client.writeContract({
        account,
        address: PARALLEL_BOOK,
        abi: PARALLEL_BOOK_ABI,
        functionName: "place",
        args: [
          priceValue,
          amountValue,
          side === "BUY" ? 0 : 1,
        ],
      });

      setTxHash(hash);

      /*
       * Wait until Monad has mined the transaction. The old UI stopped
       * after writeContract(), which only gives us the submitted hash.
       * The receipt lets us read the actual OrderPlaced event emitted
       * by ParallelBook.
       */
      const receipt = await monadPublicClient.waitForTransactionReceipt({
        hash,
      });

      if (receipt.status !== "success") {
        throw new Error("Monad mined the transaction, but it failed.");
      }

      const decodedLogs = parseEventLogs({
        abi: PARALLEL_BOOK_ABI,
        logs: receipt.logs,
        eventName: "OrderPlaced",
        strict: false,
      });

      const placedEvent = decodedLogs.find(
        (log) =>
          log.address?.toLowerCase() === PARALLEL_BOOK.toLowerCase()
      );

      if (!placedEvent) {
        throw new Error(
          "Transaction succeeded, but the ParallelBook OrderPlaced event was not found."
        );
      }

      const {
        shardId,
        id,
        trader,
        price: eventPrice,
        amount: eventAmount,
        side: eventSide,
      } = placedEvent.args;

      const displayPrice = Number(eventPrice) / 100;
      const displayAmount = Number(eventAmount) / 100;
      const displayShardNumber = Number(shardId);
      const displaySide = Number(eventSide) === 0 ? "BUY" : "SELL";

      const newOrder = [
        `#${String(Number(id)).padStart(5, "0")}`,
        formatAddress(trader),
        displaySide,
        displayPrice.toFixed(2),
        displayAmount.toFixed(2),
        `S-${String(displayShardNumber).padStart(2, "0")}`,
      ];

      setLiveOrders((current) => [newOrder, ...current]);
      setSubmitted(true);

      setTimeout(() => {
        setSubmitted(false);
      }, 3500);
    } catch (error) {
      console.error("Transaction error:", error);

      if (error?.code === 4001) {
        setTxError(
          "Transaction rejected in MetaMask."
        );
      } else {
        setTxError(
          error?.shortMessage ||
            error?.message ||
            "Transaction failed."
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#050505] text-white">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      <div className="pointer-events-none fixed left-1/2 top-[-300px] h-[650px] w-[650px] -translate-x-1/2 rounded-full bg-lime-300/[0.08] blur-[140px]" />

      <div className="relative mx-auto max-w-[1500px] px-5 sm:px-8">
        {/* NAV */}
        <nav className="flex h-20 items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-300 text-black">
              <Layers3 size={19} />
            </div>

            <div>
              <div className="font-semibold tracking-tight">
                ParallelBook
              </div>

              <div className="text-[10px] uppercase tracking-[0.2em] text-white/30">
                Monad-native orderbook
              </div>
            </div>
          </div>

          <div className="hidden items-center gap-7 text-sm text-white/45 md:flex">
            <a
              href="#market"
              className="transition hover:text-white"
            >
              Market
            </a>

            <a
              href="#architecture"
              className="transition hover:text-white"
            >
              Architecture
            </a>

            <a
              href="#benchmark"
              className="transition hover:text-white"
            >
              Benchmark
            </a>
          </div>

          <div className="flex items-center gap-2">
            {wallet ? (
              <button
                onClick={connectWallet}
                className="flex items-center gap-2 rounded-full border border-lime-300/20 bg-lime-300/[0.06] px-4 py-2 text-xs text-lime-200 transition hover:bg-lime-300/[0.1]"
              >
                <Wallet size={13} />

                {formatAddress(wallet)}
              </button>
            ) : (
              <button
                onClick={connectWallet}
                disabled={isConnecting}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-white/65 transition hover:border-lime-300/40 hover:text-white disabled:cursor-wait disabled:opacity-60"
              >
                {isConnecting ? (
                  <Activity
                    size={13}
                    className="animate-pulse"
                  />
                ) : (
                  <Wallet size={13} />
                )}

                {isConnecting
                  ? "Connecting..."
                  : "Connect wallet"}
              </button>
            )}

            <a
              href={PARALLEL_BOOK ? `${MONAD_EXPLORER}/address/${PARALLEL_BOOK}` : "#"}
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-white/65 transition hover:border-lime-300/40 hover:text-white sm:flex"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-lime-300 shadow-[0_0_10px_#bef264]" />

              Monad Testnet

              <ArrowUpRight size={13} />
            </a>
          </div>
        </nav>

        {/* HERO */}
        <section className="relative py-24 sm:py-32">
          <div className="max-w-5xl">
            <motion.div
              initial={{
                opacity: 0,
                y: 15,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              className="mb-7 inline-flex items-center gap-2 rounded-full border border-lime-300/20 bg-lime-300/[0.06] px-3 py-1.5 text-xs text-lime-200"
            >
              <Radio size={13} />

              LIVE ON MONAD TESTNET
            </motion.div>

            <motion.h1
              initial={{
                opacity: 0,
                y: 20,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                delay: 0.08,
              }}
              className="max-w-5xl text-5xl font-semibold leading-[0.95] tracking-[-0.05em] sm:text-7xl lg:text-[88px]"
            >
              Don't just run
              <br />
              faster.{" "}
              <span className="text-lime-300">
                Trade in parallel.
              </span>
            </motion.h1>

            <motion.p
              initial={{
                opacity: 0,
              }}
              animate={{
                opacity: 1,
              }}
              transition={{
                delay: 0.2,
              }}
              className="mt-8 max-w-2xl text-base leading-8 text-white/45 sm:text-lg"
            >
              ParallelBook is a Monad-native orderbook designed
              around parallel execution — sharding market state so
              independent orders don't serialize each other.
            </motion.p>

            <div className="mt-9 flex flex-wrap gap-3">
              <a
                href="#market"
                className="group flex items-center gap-2 rounded-xl bg-lime-300 px-5 py-3 text-sm font-semibold text-black transition hover:bg-lime-200"
              >
                Open market

                <ChevronRight
                  size={16}
                  className="transition group-hover:translate-x-0.5"
                />
              </a>

              <a
                href="#architecture"
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white/70 transition hover:bg-white/[0.07] hover:text-white"
              >
                Explore architecture
              </a>
            </div>
          </div>

          <div className="mt-20 grid gap-3 sm:grid-cols-3">
            <Stat
              icon={Zap}
              value="0"
              label="conflict pairs across independent shards"
              detail="BENCHMARK"
            />

            <Stat
              icon={Network}
              value="6"
              label="independent price shards"
              detail="LIVE MODEL"
            />

            <Stat
              icon={Blocks}
              value="10143"
              label="Monad testnet chain ID"
              detail="MONAD"
            />
          </div>
        </section>

        {/* MARKET */}
        <section
          id="market"
          className="border-t border-white/10 py-24"
        >
          <SectionTitle
            eyebrow="Live market"
            title="Market state, split by price."
            text="Each price range maps to an independent state shard. Orders routed to different shards touch different storage, creating room for Monad's parallel execution model to work."
          />

          <div className="mt-12 grid gap-5 lg:grid-cols-[1.5fr_.8fr]">
            <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-7">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <div className="font-medium">
                    Shard topology
                  </div>

                  <div className="mt-1 text-xs text-white/35">
                    Price → independent storage domain
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-white/35">
                  <span className="h-2 w-2 rounded-full bg-lime-300" />
                  active
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {shards.map((shard, index) => (
                  <motion.div
                    key={shard.id}
                    initial={{
                      opacity: 0,
                      y: 10,
                    }}
                    whileInView={{
                      opacity: 1,
                      y: 0,
                    }}
                    viewport={{
                      once: true,
                    }}
                    transition={{
                      delay: index * 0.05,
                    }}
                    className="group rounded-2xl border border-white/10 bg-black/30 p-4 transition hover:border-lime-300/30"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-white/40">
                        {shard.id}
                      </span>

                      <span className="text-xs text-lime-300">
                        {shard.load}%
                      </span>
                    </div>

                    <div className="mt-5 font-mono text-sm">
                      ${shard.range}
                    </div>

                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        initial={{
                          width: 0,
                        }}
                        whileInView={{
                          width: `${shard.load}%`,
                        }}
                        viewport={{
                          once: true,
                        }}
                        transition={{
                          duration: 0.8,
                          delay: index * 0.08,
                        }}
                        className="h-full rounded-full bg-lime-300"
                      />
                    </div>

                    <div className="mt-3 text-xs text-white/30">
                      {shard.orders} active orders
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* ORDER ENTRY */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-7">
              <div className="flex items-center gap-2">
                <CircleDollarSign size={18} />

                <span className="font-medium">
                  Place order
                </span>
              </div>

              <div className={`mt-3 text-[10px] uppercase tracking-widest ${
                PARALLEL_BOOK ? "text-lime-300/60" : "text-orange-300/70"
              }`}>
                {PARALLEL_BOOK
                  ? "ParallelBook contract connected"
                  : "Contract address required"}
              </div>

              <div className="mt-6 grid grid-cols-2 rounded-xl border border-white/10 p-1">
                {["BUY", "SELL"].map((item) => (
                  <button
                    key={item}
                    onClick={() => setSide(item)}
                    className={`rounded-lg py-2.5 text-xs font-semibold transition ${
                      side === item
                        ? "bg-white text-black"
                        : "text-white/35 hover:text-white"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <label className="mt-6 block text-xs text-white/35">
                PRICE

                <input
                  value={price}
                  onChange={(event) =>
                    setPrice(event.target.value)
                  }
                  inputMode="decimal"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 font-mono text-sm outline-none transition focus:border-lime-300/50"
                />
              </label>

              <label className="mt-4 block text-xs text-white/35">
                AMOUNT

                <input
                  value={amount}
                  onChange={(event) =>
                    setAmount(event.target.value)
                  }
                  inputMode="decimal"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 font-mono text-sm outline-none transition focus:border-lime-300/50"
                />
              </label>

              <div className="mt-5 rounded-xl border border-lime-300/10 bg-lime-300/[0.04] p-3 text-xs text-white/40">
                Routed automatically →{" "}
                <span className="font-mono text-lime-200">
                  {calculateShard()}
                </span>
              </div>

              <button
                onClick={placeOrder}
                disabled={isSubmitting}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-lime-300 py-3.5 text-sm font-semibold text-black transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Activity
                      size={17}
                      className="animate-pulse"
                    />

                    Confirm in wallet...
                  </>
                ) : submitted ? (
                  <>
                    <CheckCircle2 size={17} />

                    Order confirmed on Monad
                  </>
                ) : (
                  <>
                    <Zap size={17} />

                    Place {side} order
                  </>
                )}
              </button>

              {txHash && (
                <a
                  href={`${MONAD_EXPLORER}/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 block rounded-xl border border-lime-300/15 bg-lime-300/[0.04] p-3 text-center text-xs text-lime-300 transition hover:bg-lime-300/[0.08]"
                >
                  Transaction confirmed · View on Monad Explorer ↗
                </a>
              )}

              {txError && (
                <div className="mt-3 rounded-xl border border-red-400/15 bg-red-400/[0.04] p-3 text-xs leading-5 text-red-300">
                  {txError}
                </div>
              )}

              <div className="mt-4 text-center text-[10px] leading-5 text-white/20">
                Orders are written directly to the deployed
                ParallelBook contract on Monad Testnet.
              </div>
            </div>
          </div>

          {/* ORDERBOOK */}
          <div className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025]">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <div className="font-medium">
                  Orderbook
                </div>

                <div className="text-xs text-white/30">
                  Shard S-03 · $300 — $399
                </div>
              </div>

              <div className="font-mono text-xs text-lime-300">
                LIVE
              </div>
            </div>

            <div className="grid grid-cols-6 border-b border-white/10 px-5 py-3 text-[10px] uppercase tracking-widest text-white/25">
              <span>Order</span>
              <span>Trader</span>
              <span>Side</span>
              <span>Price</span>
              <span>Amount</span>
              <span>Shard</span>
            </div>

            {liveOrders.length > 0 && (
              <div className="border-b border-lime-300/10 bg-lime-300/[0.035] px-5 py-2 text-[10px] uppercase tracking-widest text-lime-300">
                ✓ Confirmed on Monad · {liveOrders.length} live order
                {liveOrders.length === 1 ? "" : "s"}
              </div>
            )}

            {[...liveOrders, ...mockOrders].map((order) => (
              <div
                key={order[0]}
                className="grid grid-cols-6 border-b border-white/[0.06] px-5 py-4 font-mono text-xs last:border-0 hover:bg-white/[0.025]"
              >
                <span className="text-white/35">
                  {order[0]}
                </span>

                <span className="text-white/45">
                  {order[1]}
                </span>

                <span
                  className={
                    order[2] === "BUY"
                      ? "text-lime-300"
                      : "text-orange-300"
                  }
                >
                  {order[2]}
                </span>

                <span>{order[3]}</span>

                <span>{order[4]}</span>

                <span className="text-white/35">
                  {order[5]}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* BENCHMARK */}
        <section
          id="benchmark"
          className="border-t border-white/10 py-24"
        >
          <SectionTitle
            eyebrow="Monad benchmark"
            title="The proof is in the storage graph."
            text="We compared an intentionally shared-state baseline against ParallelBook using Monad execution traces. The benchmark measures shared storage slots and potential conflict pairs across the same eight-transaction workload."
          />

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              [
                "Baseline",
                "28",
                "potential conflict pairs",
                "shared global state",
              ],
              [
                "ParallelBook",
                "0",
                "potential conflict pairs",
                "independent shards",
              ],
              [
                "Hot shard",
                "28",
                "potential conflict pairs",
                "same shard",
              ],
            ].map(
              ([name, number, label, sub], index) => (
                <motion.div
                  key={name}
                  whileHover={{
                    y: -4,
                  }}
                  className="rounded-3xl border border-white/10 bg-white/[0.025] p-7"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/50">
                      {name}
                    </span>

                    <BarChart3
                      size={17}
                      className="text-white/25"
                    />
                  </div>

                  <div className="mt-8 text-5xl font-semibold tracking-tight">
                    {number}
                  </div>

                  <div className="mt-2 text-sm text-white/45">
                    {label}
                  </div>

                  <div className="mt-5 border-t border-white/10 pt-4 text-xs text-white/25">
                    {sub}
                  </div>
                </motion.div>
              )
            )}
          </div>

          <div className="mt-5 rounded-3xl border border-lime-300/15 bg-lime-300/[0.035] p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
              <div className="flex gap-4">
                <div className="mt-1 rounded-xl bg-lime-300 p-2 text-black">
                  <ShieldCheck size={18} />
                </div>

                <div>
                  <div className="font-medium">
                    Independent state really is independent.
                  </div>

                  <p className="mt-1 max-w-2xl text-sm leading-6 text-white/40">
                    Eight transactions across different shards
                    touched zero shared storage slots in the
                    filtered trace analysis.
                  </p>
                </div>
              </div>

              <a
                href={PARALLEL_BOOK ? `${MONAD_EXPLORER}/address/${PARALLEL_BOOK}` : "#"}
                target="_blank"
                rel="noreferrer"
                className="flex shrink-0 items-center gap-2 text-sm text-lime-300 hover:text-lime-200"
              >
                View contract

                <ArrowUpRight size={15} />
              </a>
            </div>
          </div>
        </section>

        {/* ARCHITECTURE */}
        <section
          id="architecture"
          className="border-t border-white/10 py-24"
        >
          <SectionTitle
            eyebrow="Architecture"
            title="State is the scaling surface."
            text="ParallelBook changes the data layout rather than asking the runtime to magically make a shared orderbook independent."
          />

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: Layers3,
                title: "Price sharding",
                text: "Prices are mapped into fixed-width ranges. Each range owns its own order ID sequence and state.",
              },
              {
                icon: Network,
                title: "Independent writes",
                text: "Orders routed to different price ranges touch different shard storage, reducing cross-transaction contention.",
              },
              {
                icon: Zap,
                title: "Parallel execution",
                text: "Monad can exploit the independence because transactions reveal their actual storage dependencies.",
              },
            ].map(
              ({ icon: Icon, title, text }, index) => (
                <motion.div
                  key={title}
                  initial={{
                    opacity: 0,
                    y: 15,
                  }}
                  whileInView={{
                    opacity: 1,
                    y: 0,
                  }}
                  viewport={{
                    once: true,
                  }}
                  transition={{
                    delay: index * 0.08,
                  }}
                  className="rounded-3xl border border-white/10 bg-white/[0.025] p-7"
                >
                  <Icon
                    size={21}
                    className="text-lime-300"
                  />

                  <h3 className="mt-7 text-lg font-medium">
                    {title}
                  </h3>

                  <p className="mt-3 text-sm leading-7 text-white/40">
                    {text}
                  </p>
                </motion.div>
              )
            )}
          </div>
        </section>

        {/* FOOTER */}
        <footer className="flex flex-col justify-between gap-5 border-t border-white/10 py-10 text-xs text-white/30 sm:flex-row">
          <div>
            <span className="text-white/60">
              ParallelBook
            </span>{" "}
            · Monad-native parallel orderbook
          </div>

          <div className="flex items-center gap-5">
            <a
              href={PARALLEL_BOOK ? `${MONAD_EXPLORER}/address/${PARALLEL_BOOK}` : "#"}
              target="_blank"
              rel="noreferrer"
              className="transition hover:text-white"
            >
              Contract
            </a>

            <span>Built for Metropolis</span>
          </div>
        </footer>
      </div>
    </main>
  );
}