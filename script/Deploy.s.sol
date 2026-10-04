// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/BaselineBook.sol";
import "../src/ParallelBook.sol";

contract Deploy is Script {
    function run() external returns (BaselineBook baseline, ParallelBook parallel) {
        vm.startBroadcast();
        baseline = new BaselineBook();
        parallel = new ParallelBook();
        vm.stopBroadcast();
    }
}
