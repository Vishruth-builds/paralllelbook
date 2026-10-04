# ParallelBook

Monad-native execution-aware CLOB prototype.

## Thesis
ParallelBook partitions limit-order state into independent price shards. The first MVP intentionally focuses on **limit-order placement/cancellation workloads** where independent orders touch independent storage. Cross-shard market matching is a later milestone.

The benchmark compares:
1. BaselineBook: one shared order counter/state path.
2. ParallelBook: per-shard counters/state.

The goal is to measure state contention/re-execution behavior on Monad under identical workloads, not to claim a generic TPS improvement.

## Network
Monad Testnet:
- Chain ID: 10143
- RPC: https://testnet-rpc.monad.xyz
- Explorer: https://testnet.monadexplorer.com

## MVP milestones
- [x] Contract skeleton
- [x] Baseline shared-state book
- [x] Sharded book
- [x] Foundry tests
- [ ] Deploy to Monad testnet
- [ ] Concurrent transaction generator
- [ ] Receipt/block benchmark collector
- [ ] Frontend benchmark dashboard
- [ ] Cross-shard matching

## Commands

```bash
forge build
forge test -vv
```
