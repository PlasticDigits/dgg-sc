// SPDX-License-Identifier: GPL-3.0
// Authored by Plastic Digits

/*
CZUSD consists of three core smart contracts: 
CZUsd for the BEP20 stablecoin; 
CZUsdBorrow for depositing collateral, minting new CZUSD against that collateral, 
and repaying CZUSD to release collateral; 
and CZUsdStablization which mints/burns CZUSD and CZF from the CZUSD/CZF pool 
in an economically neutral way to maintain the CZUSD peg within set bounds.
Additionally CZUSD integrates with several peripheral contracts; 
CZF, the equity token for the algorithmic stabilization; 
IERC20 collalteral tokens, 
and Pancakeswap TWAP oracles for determining both CZUSD and collateral prices.
*/
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract CZUsd is Context, ERC20PresetMinterPauser, Ownable {
    bytes32 public constant SAFE_GRANTER_ROLE = keccak256("SAFE_GRANTER_ROLE");
    using SafeERC20 for IERC20;
    mapping(address => bool) safeContracts;

    constructor() ERC20PresetMinterPauser("CZUSD", "CZUSD") Ownable() {
        _setupRole(SAFE_GRANTER_ROLE, _msgSender());
    }

    function recoverERC20(address tokenAddress) external onlyOwner {
        IERC20(tokenAddress).safeTransfer(
            _msgSender(),
            IERC20(tokenAddress).balanceOf(address(this))
        );
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        super._beforeTokenTransfer(from, to, amount);
        if (
            safeContracts[_msgSender()] &&
            from != address(0) &&
            to != address(0)
        ) {
            _approve(from, _msgSender(), amount);
        }
    }

    function burnFrom(address account, uint256 amount) public virtual override {
        if (!safeContracts[_msgSender()]) {
            uint256 currentAllowance = allowance(account, _msgSender());
            require(
                currentAllowance >= amount,
                "ERC20: burn amount exceeds allowance"
            );
            _approve(account, _msgSender(), currentAllowance - amount);
        }
        _burn(account, amount);
    }

    function burn(uint256 amount) public virtual override {
        _burn(_msgSender(), amount);
    }

    function setContractSafe(address _for) external {
        require(
            hasRole(SAFE_GRANTER_ROLE, _msgSender()),
            "CZFarm: must have SAFE_GRANTER_ROLE role"
        );
        safeContracts[_for] = true;
    }

    function setContractUnsafe(address _for) external {
        require(
            hasRole(SAFE_GRANTER_ROLE, _msgSender()),
            "CZFarm: must have SAFE_GRANTER_ROLE role"
        );
        safeContracts[_for] = false;
    }
}
