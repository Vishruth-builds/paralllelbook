// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Deliberately contention-heavy baseline used only for benchmarking.
/// Each order placement mutates the same global counter.
contract BaselineBook {
    struct Order {
        uint256 id;
        address trader;
        uint256 price;
        uint256 amount;
        bool active;
    }

    uint256 public nextOrderId;
    mapping(uint256 => Order) public orders;

    event OrderPlaced(uint256 indexed id, address indexed trader, uint256 price, uint256 amount);

    function place(uint256 price, uint256 amount) external returns (uint256 id) {
        id = nextOrderId++;
        orders[id] = Order(id, msg.sender, price, amount, true);
        emit OrderPlaced(id, msg.sender, price, amount);
    }

    function cancel(uint256 id) external {
        Order storage order = orders[id];
        require(order.trader == msg.sender, "NOT_OWNER");
        require(order.active, "INACTIVE");
        order.active = false;
    }
}
