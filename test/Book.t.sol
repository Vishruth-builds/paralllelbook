// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/BaselineBook.sol";
import "../src/ParallelBook.sol";

contract BookTest is Test {
    BaselineBook baseline;
    ParallelBook parallel;

    address traderA = address(0xA11CE);
    address traderB = address(0xB0B);

    function setUp() public {
        baseline = new BaselineBook();
        parallel = new ParallelBook();

        vm.deal(traderA, 10 ether);
        vm.deal(traderB, 10 ether);
    }

    function testBaselinePlacement() public {
        uint256 id = baseline.place(10000, 5);

        assertEq(id, 0);

        (
            uint256 storedId,
            address trader,
            uint256 price,
            uint256 amount,
            bool active
        ) = baseline.orders(id);

        assertEq(storedId, 0);
        assertEq(trader, address(this));
        assertEq(price, 10000);
        assertEq(amount, 5);
        assertTrue(active);
    }

    function testBenchmarkWorkloads() public {
        // Baseline workload.
        for (uint256 i = 0; i < 10; i++) {
            baseline.place(10000 + i * 100, 1);
        }

        assertEq(baseline.nextOrderId(), 10);

        // ParallelBook workload.
        for (uint256 i = 0; i < 10; i++) {
            parallel.place(
                10000 + i * 100,
                1,
                i % 2 == 0
                    ? ParallelBook.Side.BUY
                    : ParallelBook.Side.SELL
            );
        }

        for (uint256 i = 0; i < 10; i++) {
            uint256 shardId = parallel.shardFor(10000 + i * 100);

            (, uint256 orderCount) = parallel.shards(shardId);

            assertEq(orderCount, 1);
        }
    }

    function testParallelSeparatesShards() public {
        (uint256 shardA, uint256 idA) = parallel.place(
            10001,
            5,
            ParallelBook.Side.BUY
        );

        (uint256 shardB, uint256 idB) = parallel.place(
            10201,
            7,
            ParallelBook.Side.SELL
        );

        assertEq(shardA, 100);
        assertEq(shardB, 102);
        assertEq(idA, 0);
        assertEq(idB, 0);

        (, uint256 orderCountA) = parallel.shards(shardA);
        (, uint256 orderCountB) = parallel.shards(shardB);

        assertEq(orderCountA, 1);
        assertEq(orderCountB, 1);
    }

    function testParallelSameShardSharesOnlyShardState() public {
        uint256 priceA = 10001;
        uint256 priceB = 10099;

        uint256 expectedShard = parallel.shardFor(priceA);

        assertEq(expectedShard, parallel.shardFor(priceB));

        (uint256 shardA, uint256 idA) = parallel.place(
            priceA,
            5,
            ParallelBook.Side.BUY
        );

        (uint256 shardB, uint256 idB) = parallel.place(
            priceB,
            7,
            ParallelBook.Side.SELL
        );

        assertEq(shardA, expectedShard);
        assertEq(shardB, expectedShard);

        // Same shard => local order IDs are independent of other shards
        // but advance within this shard.
        assertEq(idA, 0);
        assertEq(idB, 1);

        (, uint256 orderCount) = parallel.shards(expectedShard);
        assertEq(orderCount, 2);

        // Verify first order using a small helper.
        _assertOrder(
            shardA,
            idA,
            priceA,
            5,
            ParallelBook.Side.BUY
        );

        // Verify second order using a small helper.
        _assertOrder(
            shardB,
            idB,
            priceB,
            7,
            ParallelBook.Side.SELL
        );
    }

    function _assertOrder(
        uint256 shardId,
        uint256 id,
        uint256 expectedPrice,
        uint256 expectedAmount,
        ParallelBook.Side expectedSide
    ) internal view {
        (
            uint256 storedId,
            address trader,
            uint256 storedPrice,
            uint256 storedAmount,
            ParallelBook.Side storedSide,
            bool active
        ) = parallel.orders(shardId, id);

        assertEq(storedId, id);
        assertEq(trader, address(this));
        assertEq(storedPrice, expectedPrice);
        assertEq(storedAmount, expectedAmount);
        assertEq(uint256(storedSide), uint256(expectedSide));
        assertTrue(active);
    }

    function testCancel() public {
        (uint256 shardId, uint256 id) = parallel.place(
            10000,
            5,
            ParallelBook.Side.BUY
        );

        (
            ,
            ,
            ,
            ,
            ParallelBook.Side storedSide,
            bool activeBefore
        ) = parallel.orders(shardId, id);

        assertEq(
            uint256(storedSide),
            uint256(ParallelBook.Side.BUY)
        );

        assertTrue(activeBefore);

        parallel.cancel(shardId, id);

        (
            ,
            ,
            ,
            ,
            ,
            bool activeAfter
        ) = parallel.orders(shardId, id);

        assertFalse(activeAfter);
    }

    function testCancelOnlyOwner() public {
        (uint256 shardId, uint256 id) = parallel.place(
            10000,
            5,
            ParallelBook.Side.BUY
        );

        vm.prank(traderA);

        vm.expectRevert("NOT_OWNER");

        parallel.cancel(shardId, id);
    }

    function testCannotCancelInactiveOrder() public {
        (uint256 shardId, uint256 id) = parallel.place(
            10000,
            5,
            ParallelBook.Side.SELL
        );

        parallel.cancel(shardId, id);

        vm.expectRevert("INACTIVE");

        parallel.cancel(shardId, id);
    }
}