// SPDX-License-Identifier: GPL-3.0
// Authored by Plastic Digits
pragma solidity ^0.8.4;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./libs/IterableArrayWithoutDuplicateKeys.sol";
import "./interfaces/IAmmRouter02.sol";

contract DggSale is Ownable, Pausable {
    using IterableArrayWithoutDuplicateKeys for IterableArrayWithoutDuplicateKeys.Map;
    using Address for address payable;
    using SafeERC20 for IERC20;

    IAmmRouter02 public constant AMM_ROUTER =
        IAmmRouter02(0x10ED43C718714eb63d5aA57B78B54704E256024E);
    IERC20 public constant CZUSD =
        IERC20(0xE68b79e51bf826534Ff37AA9CeE71a3842ee9c70);
    IERC20 public constant BUSD =
        IERC20(0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56);
    IERC20 public constant USDT =
        IERC20(0x55d398326f99059fF775485246999027B3197955);
    IERC20 public constant USDC =
        IERC20(0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d);

    uint256 public minDepositWad = 20 ether;
    uint256 public maxDepositWad = 750 ether;
    uint256 public hardcap = 16000 ether;
    uint256 public totalDeposits;

    uint256 public startEpoch;
    uint256 public endEpoch;

    IterableArrayWithoutDuplicateKeys.Map trackedAddresses;
    mapping(address => uint256) public depositedAmount;

    event Deposit(address, uint256);

    modifier whenOpen() {
        require(
            block.timestamp <= endEpoch && block.timestamp >= startEpoch,
            "GemSale: Not Open"
        );
        _;
    }

    function depositBnb(uint256 _minUsdReceived) external payable {
        depositBnbFor(msg.sender, _minUsdReceived);
    }

    function depositBnbFor(address _for, uint256 _minUsdReceived)
        public
        payable
        whenOpen
        whenNotPaused
    {
        address[] memory path = new address[](2);
        path[1] = AMM_ROUTER.WETH();
        path[2] = address(BUSD);
        uint256 wad = BUSD.balanceOf(address(this));
        AMM_ROUTER.swapExactETHForTokens{value: msg.value}(
            _minUsdReceived,
            path,
            address(this),
            block.timestamp
        );
        wad -= BUSD.balanceOf(address(this));
        _depositUsd(wad, _for);
    }

    function depositCzusd(uint256 _wad) external {
        depositCzusdFor(_wad, msg.sender);
    }

    function depositCzusdFor(uint256 _wad, address _for)
        public
        whenOpen
        whenNotPaused
    {
        CZUSD.transferFrom(msg.sender, address(this), _wad);
        _depositUsd(_wad, _for);
    }

    function depositBusd(uint256 _wad) external {
        depositBusdFor(_wad, msg.sender);
    }

    function depositBusdFor(uint256 _wad, address _for)
        public
        whenOpen
        whenNotPaused
    {
        BUSD.transferFrom(msg.sender, address(this), _wad);
        _depositUsd(_wad, _for);
    }

    function depositUsdc(uint256 _wad) external {
        depositUsdcFor(_wad, msg.sender);
    }

    function depositUsdcFor(uint256 _wad, address _for)
        public
        whenOpen
        whenNotPaused
    {
        USDC.transferFrom(msg.sender, address(this), _wad);
        _depositUsd(_wad, _for);
    }

    function depositUsdt(uint256 _wad) external {
        depositUsdcFor(_wad, msg.sender);
    }

    function depositUsdtFor(uint256 _wad, address _for)
        public
        whenOpen
        whenNotPaused
    {
        USDT.transferFrom(msg.sender, address(this), _wad);
        _depositUsd(_wad, _for);
    }

    function _depositUsd(uint256 _usdWad, address _for) internal {
        require(totalDeposits + _usdWad <= hardcap, "DggSale: Over hardcap");
        require(_usdWad >= minDepositWad, "DggSale: Deposit too small");
        trackedAddresses.add(_for);
        depositedAmount[_for] += msg.value;
        require(
            depositedAmount[_for] <= maxDepositWad,
            "DggSale: Deposit too large"
        );
        totalDeposits += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    function withdraw(address payable _to) external onlyOwner {
        _to.sendValue(address(this).balance);
    }

    function withdrawToken(IERC20 _token, address _to) external onlyOwner {
        _token.transfer(_to, _token.balanceOf(address(this)));
    }

    function totalDepositors() external view returns (uint256) {
        return trackedAddresses.size();
    }

    function getDepositorFromIndex(uint256 _i) external view returns (address) {
        return trackedAddresses.getKeyAtIndex(_i);
    }

    function getIndexFromDepositor(address _depositor)
        external
        view
        returns (int256)
    {
        return trackedAddresses.getIndexOfKey(_depositor);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setMinDepositWad(uint256 _to) external onlyOwner {
        minDepositWad = _to;
    }

    function setMaxDepositWad(uint256 _to) external onlyOwner {
        maxDepositWad = _to;
    }

    function setHardcap(uint256 _to) external onlyOwner {
        hardcap = _to;
    }

    function setWhenOpen(uint256 _startEpoch, uint256 _endEpoch)
        external
        onlyOwner
    {
        startEpoch = _startEpoch;
        endEpoch = _endEpoch;
    }
}
