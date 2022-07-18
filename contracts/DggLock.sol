// SPDX-License-Identifier: GPL-3.0
// Authored by Plastic Digits
pragma solidity ^0.8.4;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./libs/IterableArrayWithoutDuplicateKeys.sol";
import "./interfaces/IAmmRouter02.sol";

contract DggLock is Ownable {
    using IterableArrayWithoutDuplicateKeys for IterableArrayWithoutDuplicateKeys.Map;
    using SafeERC20 for IERC20;

    uint256 public dggVestInitial;
    uint256 public firstUnlockEpoch;
    uint256 public secondUnlockEpoch;
    uint256 public totalDogeRewards;
    uint256 public lastDogeCheckBal;

    IERC20 public DOGE;
    IERC20 public DGG;

    IterableArrayWithoutDuplicateKeys.Map trackedAddresses;
    mapping(address => uint256) public accountDggInitial;
    mapping(address => uint256) public accountDggClaimed;
    mapping(address => uint256) public accountDogeClaimed;

    constructor(IERC20 _doge, IERC20 _dgg) {
        DOGE = _doge;
        DGG = _dgg;
    }

    function setVestSchedule(
        uint256 _firstUnlockEpoch,
        uint256 _secondUnlockEpoch
    ) external onlyOwner {
        firstUnlockEpoch = _firstUnlockEpoch;
        secondUnlockEpoch = _secondUnlockEpoch;
    }

    function setAccountDgg(
        address[] calldata _accounts,
        uint256[] calldata _wads
    ) external onlyOwner {
        uint256 preDggVesting = dggVestInitial;
        require(
            _accounts.length == _wads.length,
            "DggLock: Must have wad for each account"
        );
        for (uint256 i; i < _accounts.length; i++) {
            uint256 _wad = _wads[i];
            accountDggInitial[_accounts[i]] = _wad;
            dggVestInitial += _wad;
        }
        DGG.transfer(address(this), dggVestInitial - preDggVesting);
    }

    function claimDggFor(address _for) external {
        uint256 dggWad = accountDggClaimable(_for);
        accountDggClaimed[_for] += dggWad;
        DGG.transfer(_for, dggWad);
    }

    function claimDogeFor(address _for) external {
        updateTotalDogeRewards();
        uint256 dogeWad = accountDogeClaimable(_for);
        accountDogeClaimed[_for] += dogeWad;
        DOGE.transfer(_for, dogeWad);
        lastDogeCheckBal = DOGE.balanceOf(address(this));
    }

    function updateTotalDogeRewards() public {
        uint256 dogeSinceLastCheckBal = DOGE.balanceOf(address(this)) -
            lastDogeCheckBal;
        totalDogeRewards += dogeSinceLastCheckBal;
        lastDogeCheckBal = DOGE.balanceOf(address(this));
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
            return (accountDggInitial[_for] / 2) - accountDggClaimed[_for];
        }
        return 0;
    }

    function accountDogeClaimable(address _for)
        public
        view
        returns (uint256 _wad)
    {
        uint256 dogeSinceLastCheckBal = DOGE.balanceOf(address(this)) -
            lastDogeCheckBal;
        uint256 currentTotalDogeRewards = totalDogeRewards +
            dogeSinceLastCheckBal;
        return
            ((currentTotalDogeRewards * accountDggInitial[_for]) /
                dggVestInitial) - accountDogeClaimed[_for];
    }

    function withdrawToken(IERC20 _token, address _to) external onlyOwner {
        _token.transfer(_to, _token.balanceOf(address(this)));
    }
}
