import json
from collections import defaultdict

FILES = {
    "BASELINE": ["benchmark/baseline_trace.json"],
    "PARALLELBOOK": ["benchmark/parallel_trace.json"],
    "HOT_SHARD": [
        "benchmark/hot_trace_1.json",
        "benchmark/hot_trace_2.json",
    ],
}


def load_traces(files):
    traces = []

    for filename in files:
        with open(filename, "r") as f:
            data = json.load(f)

        if isinstance(data, list):
            traces.extend(data)
        else:
            traces.append(data)

    return traces


def extract_storage(trace):
    """
    Extract storage slots from a prestateTracer result.
    Returns {address: set(storage_slots)}
    """
    result = defaultdict(set)

    # Handle possible result wrappers.
    if isinstance(trace, dict) and "result" in trace:
        trace = trace["result"]

    if not isinstance(trace, dict):
        return result

    for address, account in trace.items():
        if not isinstance(account, dict):
            continue

        storage = account.get("storage", {})

        if isinstance(storage, dict):
            for slot in storage:
                result[address.lower()].add(slot.lower())

    return result


def analyze(name, files):
    traces = load_traces(files)

    tx_slots = []

    for trace in traces:
        storage = extract_storage(trace)

        slots = set()

        for address, address_slots in storage.items():
            for slot in address_slots:
                slots.add((address, slot))

        tx_slots.append(slots)

    # Count how many transactions touched every slot.
    slot_users = defaultdict(set)

    for tx_index, slots in enumerate(tx_slots):
        for slot in slots:
            slot_users[slot].add(tx_index)

    shared_slots = {
        slot: users
        for slot, users in slot_users.items()
        if len(users) > 1
    }

    # Count transaction pairs that share at least one slot.
    conflicts = set()

    for users in shared_slots.values():
        users = sorted(users)

        for i in range(len(users)):
            for j in range(i + 1, len(users)):
                conflicts.add((users[i], users[j]))

    total_slots = len(slot_users)
    shared_slot_count = len(shared_slots)

    print("\n" + "=" * 60)
    print(name)
    print("=" * 60)

    print(f"Transactions analysed: {len(tx_slots)}")
    print(f"Unique storage slots touched: {total_slots}")
    print(f"Shared storage slots: {shared_slot_count}")
    print(f"Transaction-pair conflicts: {len(conflicts)}")

    if shared_slots:
        print("\nShared slots:")

        for slot, users in sorted(shared_slots.items()):
            print(
                f"  {slot[0]} / {slot[1]}"
                f"  -> transactions {', '.join(str(x + 1) for x in sorted(users))}"
            )

    return {
        "transactions": len(tx_slots),
        "unique_slots": total_slots,
        "shared_slots": shared_slot_count,
        "conflicts": len(conflicts),
    }


def main():
    results = {}

    for name, files in FILES.items():
        results[name] = analyze(name, files)

    with open("benchmark/conflict_analysis.json", "w") as f:
        json.dump(results, f, indent=2)

    print("\n" + "=" * 60)
    print("COMPARISON")
    print("=" * 60)

    for name, result in results.items():
        print(
            f"{name:15} "
            f"shared slots={result['shared_slots']:3} "
            f"conflicts={result['conflicts']:3}"
        )

    print("\nSaved: benchmark/conflict_analysis.json")


if __name__ == "__main__":
    main()