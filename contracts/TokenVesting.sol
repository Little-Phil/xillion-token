//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TokenVesting is Ownable {
    using SafeERC20 for IERC20;

    /*                                               GENERAL VARIABLES                                                */
    /* ============================================================================================================== */

    uint256 private constant ONE_DAY = 1 days;
    uint256 private constant ONE_WEEK = 7 days;
    uint256 private constant ONE_MONTH = 30 days;

    struct Beneficiary {
        uint256 amount;         // Total amount vested for beneficiary
        uint256 released;       // Amount already released
        bool revoked;
    }

    // beneficiaries of tokens after they are released
    mapping(address => Beneficiary) public beneficiaries;

    IERC20 public token;

    uint256 public cliff;
    uint256 public start;
    uint256 public duration;

    bool public revocable;

    enum ReleaseMode { MONTHLY, WEEKLY }
    ReleaseMode public releaseMode;

    uint256 public totalOriginalAmount;
    uint256 public totalReleased;

    /*                                               CONSTRUCTOR                                                      */
    /* ============================================================================================================== */

    constructor(
        address[] memory _beneficiaries,
        uint256[] memory _amounts,
        IERC20 _erc20Token,
        uint256 _start,
        uint256 _cliff,
        uint256 _duration,
        bool _revocable,
        ReleaseMode _mode
    ) {
        require(_cliff <= _duration, "Cliff is longer than duration");
        // add beneficiaries
        addBeneficiaries(_beneficiaries, _amounts);

        // set the address of the vested token 
        setERC20Token(_erc20Token);

        // set release mode as monthly or weekly
        setReleaseMode(_mode);

        duration = _duration;
        cliff = _start + _cliff;
        start = _start;
        revocable = _revocable;        
    }

    /*                                                      EVENTS                                                    */
    /* ============================================================================================================== */

    event Released(address indexed beneficiary_, uint256 amount_, uint256 releaseTime_);
    event Revoke(address indexed beneficiary_, uint256 refund_, uint256 revokeTime_);

    /*                                                 TOKEN VESTING FUNCTIONS                                        */
    /* ============================================================================================================== */

    function claim() external {
        claim(_msgSender());
    }

    function claim(address beneficiary) public {
        uint256 _unreleased = releasableAmount(beneficiary);
        if (_unreleased > 0) {
            _release(beneficiary, _unreleased);
        }
    }

    /*                                                 SETTER FUNCTIONS                                               */
    /* ============================================================================================================== */

    // Allows the owner to revoke the vestings for beneficiaries
    function revokeBeneficiaries(address[] calldata _beneficiaries) external onlyOwner {
        for (uint256 i = 0; i < _beneficiaries.length; i++) {
            revokeBeneficiary(_beneficiaries[i]);
        }
    }

    function addBeneficiaries(address[] memory _beneficiaries, uint256[] memory _amounts)
        public onlyOwner
    {
        require(_beneficiaries.length == _amounts.length, "The number of beneficiaries should equal the number of amounts");
        for (uint256 i = 0; i < _beneficiaries.length; i++) {
            addBeneficiary(_beneficiaries[i], _amounts[i]);
        }
    }

    /**
     * @dev Set ERC20Token contract
     * @dev This function can only be carreid out by the owner of this contract.
     */
    function setERC20Token(IERC20 _erc20Token) public onlyOwner {
        token = _erc20Token; 
    }

    function setReleaseMode(ReleaseMode _mode) public onlyOwner {
        releaseMode = _mode;
    }

    /*                                                 GETTER FUNCTIONS                                               */
    /* ============================================================================================================== */

    function releasableAmount(address _beneficiary) public view returns (uint256) {
        return vestedAmount(_beneficiary) - beneficiaries[_beneficiary].released;
    }

    function getVestingInfo(address _beneficiary)
        external view
        returns (uint256 balance_, uint256 released_, bool revoked_) 
    {

        balance_ = beneficiaries[_beneficiary].amount;
        released_ = beneficiaries[_beneficiary].released;
        revoked_ = beneficiaries[_beneficiary].revoked;
    }

    /**
     * @dev Calculates the amount that has already vested for a beneficiary.
     */
    function vestedAmount(address _beneficiary) public view returns (uint256) {
        Beneficiary storage bf = beneficiaries[_beneficiary];

        if(bf.revoked) return 0;

        uint256 totalBalance = bf.amount + bf.released;

        if (block.timestamp < cliff) {  // cliff is not over
            return 0;
        } else if (block.timestamp >= start + duration) {
            // vesting period is over, so return all tokens
            return totalBalance;
        } else { // during the vesting period, so return the amount of tokens relative to the passed time
            uint256 secondsInPassedPeriods = getSecondsFromStartToLastPeriodEnd();
            return totalBalance * secondsInPassedPeriods / duration;
        }
    }

    function getReleaseMode() external view returns (ReleaseMode) {
        return releaseMode;
    }

    /*                                                 INTERNAL FUNCTIONS                                             */
    /* ============================================================================================================== */

    /**
     * @notice Calculates how many seconds passed from start to a last release day
     */
    function getSecondsFromStartToLastPeriodEnd() internal view returns(uint256) {
        uint256 relasePeriod = getReleasePeriod();
        uint256 timeFromStart = block.timestamp - start;
        return relasePeriod * (timeFromStart / relasePeriod); // timeFromStart / relasePeriod is truncated to floor amount of periods since start
    }

    /**
     * @return Seconds in release period
     */
    function getReleasePeriod() internal view returns(uint256) {
         if (releaseMode == ReleaseMode.MONTHLY) {
             return ONE_DAY * 30;
         } else if(releaseMode ==  ReleaseMode.WEEKLY) {
             return ONE_DAY * 7;
         } else {
             revert("unknown period");
         }
    }


    function addBeneficiary(address _beneficiary, uint256 _amount) internal {
        require(_amount > 0, "0 token amount");
        require(beneficiaries[_beneficiary].amount == 0, "beneficiary already added");
        beneficiaries[_beneficiary] = Beneficiary({
            amount: _amount,
            released: 0,
            revoked: false
        });
        totalOriginalAmount = totalOriginalAmount + _amount;
    }

    // revoke the vesting for an individual beneficiary
    function revokeBeneficiary(address _beneficiary) internal {
        require(revocable);
        Beneficiary storage bf = beneficiaries[_beneficiary];
        require(!bf.revoked, "already revoked");

        uint256 ownerRefund = bf.amount - bf.released;

        bf.revoked = true;
        bf.amount = 0;

        if (ownerRefund > 0) {
            token.safeTransfer(owner(), ownerRefund);
        }

        totalOriginalAmount = totalOriginalAmount - ownerRefund;

        emit Revoke(_beneficiary, ownerRefund, block.timestamp);
    }

    function _release(address _beneficiary, uint256 _unreleased) internal {
        totalReleased = totalReleased + _unreleased;

        Beneficiary storage bf = beneficiaries[_beneficiary];

        bf.amount = bf.amount - _unreleased;
        bf.released = bf.released + _unreleased;

        token.safeTransfer(_beneficiary, _unreleased);

        emit Released(_beneficiary, _unreleased, block.timestamp);
    }
}