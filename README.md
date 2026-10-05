# ParallelBook

> **Don't just run faster. Trade in parallel.**

ParallelBook is a Monad-native, execution-aware central limit order book (CLOB) prototype designed around **parallel execution**.

Instead of putting all order-placement state behind one global counter and storage path, ParallelBook partitions order state into **price-based shards**. Transactions targeting different price ranges can therefore operate on independent storage state.

The project demonstrates this design on Monad testnet with a baseline orderbook, a sharded ParallelBook, concurrent transaction workloads, and storage-trace analysis.

---

## The idea

Traditional onchain orderbooks often use shared global state.

A simplified placement flow looks like:

```text
place order
    |
    v
global nextOrderId
    |
    v
global order storage