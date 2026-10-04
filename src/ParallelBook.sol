// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Execution-aware orderbook.
/// Price ranges map to independent shards. Each shard owns its own order ID
/// counter and order storage, reducing contention from a single global counter.
contract ParallelBook {
    uint256 public constant SHARD_WIDTH = 100;

    enum Side {
        BUY,
        SELL
    }

    struct Order {
        uint256 id;
        address trader;
        uint256 price;
        uint256 amount;
        Side side;
        bool active;
    }

    struct Shard {
        uint256 nextOrderId;
        uint256 orderCount;
    }

    mapping(uint256 => Shard) public shards;
    mapping(uint256 => mapping(uint256 => Order)) public orders;

    event OrderPlaced(
        uint256 indexed shardId,
        uint256 indexed id,
        address indexed trader,
        uint256 price,
        uint256 amount,
        Side side
    );

    event OrderCancelled(uint256 indexed shardId, uint256 indexed id);

    function shardFor(uint256 price) public pure returns (uint256) {
        return price / SHARD_WIDTH;
    }

    function place(uint256 price, uint256 amount, Side side)
        external
        returns (uint256 shardId, uint256 id)
    {
        shardId = shardFor(price);
        Shard storage shard = shards[shardId];

        id = shard.nextOrderId++;
        shard.orderCount++;

        orders[shardId][id] = Order({
            id: id,
            trader: msg.sender,
            price: price,
            amount: amount,
            side: side,
            active: true
        });

        emit OrderPlaced(
            shardId,
            id,
            msg.sender,
            price,
            amount,
            side
        );
    }

    function cancel(uint256 shardId, uint256 id) external {
        Order storage order = orders[shardId][id];
        require(order.trader == msg.sender, "NOT_OWNER");
        require(order.active, "INACTIVE");

        order.active = false;
        emit OrderCancelled(shardId, id);
    }
}
