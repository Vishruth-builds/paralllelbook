import json
import subprocess
from collections import defaultdict

RPC = "https://testnet-rpc.monad.xyz"

def rpc(method, params):
    result = subprocess.run(
        ["cast", "rpc", method, *params, "--rpc-url", RPC],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr)
    return json.loads(result.stdout)

def get_block(tx_hash):
    tx = rpc("eth_getTransactionByHash", [tx_hash])
    return tx["blockHash"], tx["blockNumber"]

def get_block_txs(block_hash):
    block = rpc("eth_getBlockByHash", [block_hash, "true"])
    return [tx["hash"].lower() for tx in block["transactions"]]

def get_traces(block_number):
    return rpc(
        "debug_traceBlockByNumber",
        [block_number, '{"tracer":"prestateTracer"}']
    )

def extract_storage(trace):
    if isinstance(trace, dict) and "result" in trace:
        trace = trace["result"]

    slots = set()

    if not isinstance(trace, dict):
        return slots

    for address, account in trace.items():
        if not isinstance(account, dict):
            continue

        storage = account.get("storage", {})

        if isinstance(storage, dict):
            for slot in storage:
                slots.add((address.lower(), slot.lower()))

    return slots

def analyze_workload(name, submissions):
    tx_hashes = {
        s["hash"].lower()
        for s in submissions
        if s.get("success") and s.get("hash")
    }

    print("\n" + "=" * 70)
    print(name)
    print("=" * 70)
    print(f"Benchmark transactions: {len(tx_hashes)}")

    by_block = defaultdict(set)

    for tx_hash in tx_hashes:
        block_hash, block_number = get_block(tx_hash)
        by_block[(block_hash, block_number)].add(tx_hash)

    tx_slots = {}

    for (block_hash, block_number), wanted_hashes in by_block.items():
        block_txs = get_block_txs(block_hash)
        traces = get_traces(block_number)

        if len(block_txs) != len(traces):
            print(
                f"WARNING: {block_number}: "
                f"{len(block_txs)} block txs vs {len(traces)} traces"
            )

        for index, tx_hash in enumerate(block_txs):
            if tx_hash not in wanted_hashes:
                continue

            if index >= len(traces):
                print(f"WARNING: missing trace for {tx_hash}")
                continue

            tx_slots[tx_hash] = extract_storage(traces[index])

    slot_users = defaultdict(set)

    for tx_hash, slots in tx_slots.items():
        for slot in slots:
            slot_users[slot].add(tx_hash)

    shared_slots = {
        slot: users
        for slot, users in slot_users.items()
        if len(users) > 1
    }

    conflicts = set()

    for users in shared_slots.values():
        users = sorted(users)

        for i in range(len(users)):
            for j in range(i + 1, len(users)):
                conflicts.add((users[i], users[j]))

    print(f"Traces matched: {len(tx_slots)}")
    print(f"Unique storage slots: {len(slot_users)}")
    print(f"Shared storage slots: {len(shared_slots)}")
    print(f"Potential conflict pairs: {len(conflicts)}")

    if shared_slots:
        print("\nShared slots:")
        for slot, users in shared_slots.items():
            print(
                f"  {slot[0]} / {slot[1]}"
                f" -> {len(users)} benchmark transactions"
            )

    return {
        "transactions": len(tx_hashes),
        "traces_matched": len(tx_slots),
        "unique_slots": len(slot_users),
        "shared_slots": len(shared_slots),
        "potential_conflict_pairs": len(conflicts),
    }

def main():
    with open("benchmark/results_batched.json") as f:
        data = json.load(f)

    results = {}

    for workload in data:
        results[workload["name"]] = analyze_workload(
            workload["name"],
            workload["submissions"]
        )

    print("\n" + "=" * 70)
    print("FINAL COMPARISON")
    print("=" * 70)

    for name, r in results.items():
        print(
            f"{name}\n"
            f"  transactions:       {r['transactions']}\n"
            f"  traces matched:     {r['traces_matched']}\n"
            f"  unique slots:       {r['unique_slots']}\n"
            f"  shared slots:       {r['shared_slots']}\n"
            f"  conflict pairs:     {r['potential_conflict_pairs']}\n"
        )

    with open("benchmark/conflict_analysis_filtered.json", "w") as f:
        json.dump(results, f, indent=2)

    print("Saved: benchmark/conflict_analysis_filtered.json")

if __name__ == "__main__":
    main()
