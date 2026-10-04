// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/BaselineBook.sol";
import "../src/ParallelBook.sol";

contract BookTest is Test {
    BaselineBook baseline;
    ParallelBook parallel;

    function setUp() public {
        baseline = new BaselineBook();
        parallel = new ParallelBook();
    }

    function testBaselinePlacement() public {
        uint256 id = baseline.place(10000, 5);
        assertEq(id, 0);
        assertEq(baseline.nextOrderId(), 1);
    }

    function testParallelSeparatesShards() public {
        (uint256 shardA,) = parallel.place(10000, 5);
        (uint256 shardB,) = parallel.place(10200, 5);

        assertEq(shardA, 100);
        assertEq(shardB, 102);
        (, uint256 orderCount) = parallel.shards(100);
        assertEq(orderCount, 1);
        (, uint256 orderCount2) = parallel.shards(102);
        assertEq(orderCount2, 1);
    }

    function testParallelSameShardSharesOnlyShardState() public {
        (uint256 shardA, uint256 idA) = parallel.place(10001, 5);
        (uint256 shardB, uint256 idB) = parallel.place(10099, 7);

        assertEq(shardA, shardB);
        assertEq(idA, 0);
        assertEq(idB, 1);
    }

    function testCancel() public {
        uint256 shardId;
        uint256 id;
        (shardId, id) = parallel.place(10000, 5);

        parallel.cancel(shardId, id);
        (, , , , bool active) = parallel.orders(shardId, id);
        assertFalse(active);
    }
}
