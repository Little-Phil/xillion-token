//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/presets/ERC20PresetMinterPauserUpgradeable.sol";

contract token is ERC20PresetMinterPauserUpgradeable {
    string private _updateableName;
    string private _updateableSymbol;

    struct TransferData {
        address recipient;
        uint256 amount;
    }

    function tokenInit(
        string memory _name,
        string memory _symbol,
        uint256 totalSupply
    ) public virtual initializer {
        __ERC20PresetMinterPauser_init("", "");
        _updateableName = _name;
        _updateableSymbol = _symbol;
        _mint(msg.sender, totalSupply);
    }

    /**
     * @dev loops though an array "data" of TransferData
     * and makes "data.length" transactions
     */
    function batchTransfer(TransferData[] calldata data) external {
        for (uint256 i = 0; i < data.length; i++) {
            _transfer(msg.sender, data[i].recipient, data[i].amount);
        }
    }

    function name() public override view returns (string memory) {
        return _updateableName;
    }

    function symbol() public override view returns (string memory) {
        return _updateableSymbol;
    }

    function updateName(string memory _newName)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _updateableName = _newName;
    }

    function updateSymbol(string memory _newSymbol)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _updateableSymbol = _newSymbol;
    }
}

contract BEP20 is token {
    /**
     * @dev Returns the bep token owner.
     */
    function getOwner() external view returns (address) {
        return getRoleMember(DEFAULT_ADMIN_ROLE, 0);
    }
}

contract ERC20 is token {}
