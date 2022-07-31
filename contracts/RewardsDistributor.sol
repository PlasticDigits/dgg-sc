// SPDX-License-Identifier: GPL-3.0
// Authored by Plastic Digits
pragma solidity ^0.8.4;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Checkpoints.sol";
import "./libs/IterableArrayWithoutDuplicateKeys.sol";
import "./DGOD.sol";

contract RewardsDistributor is Ownable {
    using IterableArrayWithoutDuplicateKeys for IterableArrayWithoutDuplicateKeys.Map;
    using Checkpoints for Checkpoints.History;
    using SafeERC20 for IERC20;

    Checkpoints.History totalRewardsHistory;
    uint256 public totalRewardsClaimed;

    IERC20 public constant dogeCoin =
        IERC20(0xbA2aE424d960c26247Dd6c32edC70B295c744C43);
    DGOD public dgod;

    struct RewardsStats {
        bool isAutoClaim;
        Checkpoints.History totalRewardsHistory;
    }
    mapping(address => RewardsStats) public accountRewardsStats;
    IterableArrayWithoutDuplicateKeys.Map isAutoclaimAccounts;

    IterableArrayWithoutDuplicateKeys.Map exemptedAccounts;

    uint256 autoclaimFee = 1000;

    constructor(DGOD _dgod, address _pair) {
        dgod = _dgod;
        exemptedAccounts.add(_pair);
    }

    function claim() external {
        totalRewardsHistory.push(
            dogeCoin.balanceOf(address(this)) +
                totalRewardsClaimed -
                totalRewardsHistory.latest()
        );
    }

    function getTotalExemptedAt(uint256 _blockNumber)
        public
        view
        returns (uint256 _wad)
    {
        for (uint256 i; i < exemptedAccounts.size(); i++) {
            _wad += dgod.getBalanceOfAtBlock(
                exemptedAccounts.getKeyAtIndex(i),
                _blockNumber
            );
        }
    }

    function setAutoclaim(bool _to) external {
        if (accountRewardsStats[msg.sender].isAutoClaim == _to) return;
        accountRewardsStats[msg.sender].isAutoClaim = _to;
        if (_to) {
            isAutoclaimAccounts.add(msg.sender);
        } else {
            isAutoclaimAccounts.remove(msg.sender);
        }
    }

    function setAccountExemption(address _account, bool _to) public onlyOwner {
        if (_to) {
            exemptedAccounts.add(_account);
        } else {
            exemptedAccounts.remove(_account);
        }
    }

    function getTotalRewardsAtBlock(uint256 _blockNumber)
        external
        view
        returns (uint256 totalRewards_)
    {
        return totalRewardsHistory.getAtBlock(_blockNumber);
    }

    function getAccountTotalRewardsAtBlock(
        address _account,
        uint256 _blockNumber
    ) external view returns (uint256 totalRewardsClaimed_) {
        RewardsStats storage stats = accountRewardsStats[_account];
        totalRewardsClaimed_ = stats.totalRewardsHistory.getAtBlock(
            _blockNumber
        );
    }

    function getIsAccountAutoClaim(address _account)
        external
        view
        returns (bool)
    {
        return accountRewardsStats[_account].isAutoClaim;
    }
}
