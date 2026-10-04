import json
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

RPC = "https://testnet-rpc.monad.xyz"

# Fresh contracts deployed after adding BUY/SELL support.
BASELINE = "0x969BB97b155cc49Cb331Ad23fC5d984BCA36f0f2"
PARALLEL = "0x3AE4Cd180c23305a6f195915195899a7553a5126"

# ParallelBook enum encoding:
# BUY  = 0
# SELL = 1
BUY = 0
SELL = 1

ORDER_AMOUNT = "1000000000000000"

wallet_data = json.load(open("benchmark/wallets.json"))["data"]

WALLETS = [
    {
        "address": w["address"],
        "private_key": w["private_key"],
    }
    for w in wallet_data
]


def submit_baseline_tx(private_key, price):
    """
    Submit a transaction to the original-style BaselineBook.

    BaselineBook:
        place(uint256 price, uint256 amount)
    """

    result = subprocess.run(
        [
            "cast",
            "send",
            BASELINE,
            "place(uint256,uint256)",
            str(price),
            ORDER_AMOUNT,
            "--rpc-url",
            RPC,
            "--private-key",
            private_key,
            "--async",
        ],
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        return {
            "success": False,
            "error": result.stderr.strip(),
        }

    return {
        "success": True,
        "hash": result.stdout.strip(),
    }


def submit_parallel_tx(private_key, price, side):
    """
    Submit a transaction to ParallelBook.

    ParallelBook:
        place(uint256 price, uint256 amount, Side side)

    Solidity enum Side is ABI-encoded as uint8:
        BUY  = 0
        SELL = 1
    """

    result = subprocess.run(
        [
            "cast",
            "send",
            PARALLEL,
            "place(uint256,uint256,uint8)",
            str(price),
            ORDER_AMOUNT,
            str(side),
            "--rpc-url",
            RPC,
            "--private-key",
            private_key,
            "--async",
        ],
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        return {
            "success": False,
            "error": result.stderr.strip(),
        }

    return {
        "success": True,
        "hash": result.stdout.strip(),
    }


def get_receipt(tx_hash):
    """
    Poll Monad until the transaction receipt is available.
    """

    for _ in range(30):
        result = subprocess.run(
            [
                "cast",
                "receipt",
                tx_hash,
                "--rpc-url",
                RPC,
                "--json",
            ],
            capture_output=True,
            text=True,
        )

        if result.returncode == 0 and result.stdout.strip():
            try:
                return json.loads(result.stdout)
            except Exception:
                pass

        time.sleep(1)

    return {
        "error": "receipt timeout",
        "hash": tx_hash,
    }


def run_workload(name, submitter, prices, sides=None):
    """
    Broadcast all eight transactions concurrently, then wait for receipts.

    The benchmark intentionally separates:
      1. concurrent submission
      2. receipt collection

    This avoids serially waiting for one transaction before submitting
    the next one.
    """

    print(f"\n{'=' * 60}")
    print(f"WORKLOAD: {name}")
    print(f"{'=' * 60}")

    # ------------------------------------------------------------
    # Phase 1: broadcast ALL transactions concurrently
    # ------------------------------------------------------------

    start = time.time()

    submissions = []

    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = []

        for i in range(8):
            if sides is None:
                future = executor.submit(
                    submitter,
                    WALLETS[i]["private_key"],
                    prices[i],
                )
            else:
                future = executor.submit(
                    submitter,
                    WALLETS[i]["private_key"],
                    prices[i],
                    sides[i],
                )

            futures.append(future)

        for future in as_completed(futures):
            submissions.append(future.result())

    broadcast_time = time.time() - start

    successful = [
        submission
        for submission in submissions
        if submission["success"]
    ]

    print(f"Broadcast: {len(successful)}/8")
    print(f"Broadcast time: {broadcast_time:.3f}s")

    # Print failed submissions explicitly.
    failed = [
        submission
        for submission in submissions
        if not submission["success"]
    ]

    if failed:
        print("\nFailed submissions:")

        for failure in failed:
            print(f"  {failure.get('error', 'unknown error')}")

    # ------------------------------------------------------------
    # Phase 2: wait for receipts concurrently
    # ------------------------------------------------------------

    results = []

    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = [
            executor.submit(
                get_receipt,
                submission["hash"],
            )
            for submission in successful
        ]

        for future in as_completed(futures):
            results.append(future.result())

    # ------------------------------------------------------------
    # Extract block distribution
    # ------------------------------------------------------------

    blocks = {}

    for receipt in results:
        block = receipt.get("blockNumber", "unknown")

        blocks.setdefault(block, 0)
        blocks[block] += 1

    print("\nBlock distribution:")

    for block, count in blocks.items():
        print(f"  {block}: {count} tx")

    return {
        "name": name,
        "broadcast_time": broadcast_time,
        "submissions": submissions,
        "receipts": results,
        "blocks": blocks,
    }


def main():
    print("ParallelBook Batched Monad Benchmark")
    print("====================================")
    print(f"RPC: {RPC}")
    print(f"BaselineBook: {BASELINE}")
    print(f"ParallelBook: {PARALLEL}")

    results = []

    # ============================================================
    # WORKLOAD 1
    # Baseline / Global Contention
    #
    # Every order uses the same global nextOrderId counter.
    # Therefore all transactions touch the same global storage state.
    # ============================================================

    results.append(
        run_workload(
            "Baseline / Global Contention",
            submit_baseline_tx,
            [
                10000 + i
                for i in range(8)
            ],
        )
    )

    # ============================================================
    # WORKLOAD 2
    # ParallelBook / Independent Shards
    #
    # SHARD_WIDTH = 100.
    #
    # Prices:
    #   10000 -> shard 100
    #   10100 -> shard 101
    #   10200 -> shard 102
    #   ...
    #
    # Each transaction therefore targets a different shard.
    # ============================================================

    results.append(
        run_workload(
            "ParallelBook / Independent Shards",
            submit_parallel_tx,
            [
                10000 + (i * 100)
                for i in range(8)
            ],
            [
                BUY,
                SELL,
                BUY,
                SELL,
                BUY,
                SELL,
                BUY,
                SELL,
            ],
        )
    )

    # ============================================================
    # WORKLOAD 3
    # ParallelBook / Hot Shard
    #
    # All prices remain inside shard 100:
    #
    #   10000 / 100 = 100
    #   10001 / 100 = 100
    #   ...
    #   10007 / 100 = 100
    #
    # This deliberately recreates contention inside one shard.
    #
    # This is our control experiment:
    #
    #   Independent shards -> contention disappears
    #   Same shard        -> contention returns
    # ============================================================

    results.append(
        run_workload(
            "ParallelBook / Hot Shard",
            submit_parallel_tx,
            [
                10000 + i
                for i in range(8)
            ],
            [
                BUY,
                SELL,
                BUY,
                SELL,
                BUY,
                SELL,
                BUY,
                SELL,
            ],
        )
    )

    # ============================================================
    # Save results
    # ============================================================

    with open(
        "benchmark/results_batched.json",
        "w",
    ) as f:
        json.dump(
            results,
            f,
            indent=2,
        )

    print(
        "\nResults saved to "
        "benchmark/results_batched.json"
    )


if __name__ == "__main__":
    main()