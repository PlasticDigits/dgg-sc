// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.4;
import "@openzeppelin/contracts/access/Ownable.sol";
import "./DGOD.sol";

contract DgodWheel is Ownable {
    address public wheelAddr =
        address(0xe165738efB5124AbB1F274B09d3E157958AE29d9);
    DGOD public dgod = DGOD(0x99F4cc2BAE97F82A823CA80DcAe52EF972B7F270);

    uint256[] public rollWads;
    address[] public rollUsers;
    uint256 public totalRolls;

    constructor() Ownable() {}

    function roll(uint256 _wad) external {
        dgod.transferFrom(msg.sender, wheelAddr, _wad);
        rollWads.push(_wad);
        rollUsers.push(msg.sender);
        totalRolls++;
    }

    function getRoll(uint256 _id)
        external
        view
        returns (address user_, uint256 wad_)
    {
        return (rollUsers[_id], rollWads[_id]);
    }

    function setWheelAddr(address _to) external onlyOwner {
        wheelAddr = _to;
    }
}
