//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract XILToken is ERC20 {
    constructor() ERC20("XIL", "XIL") {
        _mint(msg.sender, 250000000 * 10**18);
    }
}
