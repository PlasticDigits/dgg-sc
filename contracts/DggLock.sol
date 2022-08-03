// SPDX-License-Identifier: GPL-3.0
// Authored by Plastic Digits
pragma solidity ^0.8.4;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./libs/IterableArrayWithoutDuplicateKeys.sol";
import "./interfaces/IAmmRouter02.sol";
import "./AutoRewardPool.sol";

contract DggLock is Ownable {
    using SafeERC20 for IERC20;

    uint256 public firstUnlockEpoch;
    uint256 public secondUnlockEpoch;
    IERC20 public DGG;
    AutoRewardPool public autoRewardPool;

    uint256 public preUnlockClaimBasis = 2000;
    uint256 public postUnlockClaimBasis = 4000;

    mapping(address => uint256) public accountDggInitial;
    mapping(address => uint256) public accountDggClaimed;

    constructor(IERC20 _dgg, AutoRewardPool _autoRewardPool) {
        DGG = _dgg;
        autoRewardPool = _autoRewardPool;
    }

    function setVestSchedule(
        uint256 _firstUnlockEpoch,
        uint256 _secondUnlockEpoch
    ) external onlyOwner {
        firstUnlockEpoch = _firstUnlockEpoch;
        secondUnlockEpoch = _secondUnlockEpoch;
    }

    function vestBalanceOf(address _account) public view returns (uint256) {
        return accountDggInitial[_account] - accountDggClaimed[_account];
    }

    function addVestings(address[] calldata _accounts, uint256[] calldata _wads)
        external
        onlyOwner
    {
        uint256 dggToVest;
        require(
            _accounts.length == _wads.length,
            "DggLock: Must have wad for each account"
        );
        for (uint256 i; i < _accounts.length; i++) {
            accountDggInitial[_accounts[i]] += _wads[i];
            autoRewardPool.depositViaLock(_accounts[i], _wads[i]);
            dggToVest += _wads[i];
        }
        DGG.transferFrom(msg.sender, address(this), dggToVest);
    }

    function claimDgg() external {
        uint256 dggWad = accountDggClaimable(msg.sender);
        accountDggClaimed[msg.sender] += dggWad;
        autoRewardPool.withdrawViaLock(msg.sender, dggWad);
        DGG.transfer(msg.sender, dggWad);
    }

    function accountDggClaimable(address _for)
        public
        view
        returns (uint256 _wad)
    {
        if (firstUnlockEpoch == 0 || secondUnlockEpoch == 0) return 0;
        if (secondUnlockEpoch <= block.timestamp) {
            return accountDggInitial[_for] - accountDggClaimed[_for];
        }
        if (firstUnlockEpoch <= block.timestamp) {
            return
                ((accountDggInitial[_for] *
                    (postUnlockClaimBasis + preUnlockClaimBasis)) / 10000) -
                accountDggClaimed[_for];
        }
        return
            ((accountDggInitial[_for] * preUnlockClaimBasis) / 10000) -
            accountDggClaimed[_for];
    }

    function withdrawToken(IERC20 _token, address _to) external onlyOwner {
        _token.transfer(_to, _token.balanceOf(address(this)));
    }
}
