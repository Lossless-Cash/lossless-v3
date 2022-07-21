// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "./NODERewardManagementV2.sol";
import "./interfaces/IRouter.sol";
import "./interfaces/IJoeRouter02.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract MINDv2 is Initializable, ERC20Upgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    NODERewardManagementV2 public nodeRewardManager;
    IJoeRouter02 public uniswapV2Router;
    address public uniswapV2Pair;

    address public treasury;
    uint256 public rewardsFee;          // 100 = 1.00%
    uint256 public liquidityPoolFee;    // 100 = 1.00%
    uint256 public rewardsPool;         // available balance for rewards

    uint256 public sellFee;             // 100 = 1.00%
    uint256 public buyFee;              // 100 = 1.00%
    uint256 public maxSellFee;
    uint256 public maxBuyFee;

    uint256 public rwSwap;              // 100 = 1.00%; percent of rewards to swap to AVAX
    bool private swapping;
    bool public swapAndLiquifyEnabled;
    uint256 public swapTokensAmount;
    mapping(address => bool) public proxyToApproved; // proxy allowance for interaction with future contract

    mapping(address => bool) public isBlacklisted;
    mapping(address => bool) public  automatedMarketMakerPairs;
    mapping (address => bool) private isExcludedFromFee;

    struct FeeRecipient {
        address recipient;
        uint256 basisPoints;
        bool sellToNative;
    }

    mapping(uint256 => FeeRecipient) public FeeRecipients;
    uint256 feeRecipientCount;
    uint256 totalFeeBasisPoints;
    uint256 totalFeeBasisPointsToSwap;
    bool isOpen;
    mapping(address => address) public Referrals;
    mapping(address => uint256) public ReferralIncome;
    uint256 public referralRateForBuySell;          // 100 = 1.00%
    uint256 public referralRateForNodeCreation;     // 100 = 1.00%
    uint256 public referralRateForNodeRewards;      // 100 = 1.00%
    uint256 public minTokensForReferral;
    uint256 public minNodesForReferral;

    uint256 public nodeCreateProcessFee;            // 100 = 1.00%
    address public nodeCreateProcessFeeRecipient;   // stabilator contract0
    uint256 public rewardProcessFee;                // 100 = 1.00%
    address public rewardProcessFeeRecipient;       // stabilator contract0
    uint256 public totalProcessFees;

    address public uniswapV2PairForSwap;
    address public uniswapV2RouterForSwap;
    bool public useSwapExactTokensForAVAXSupportingFeeOnTransferTokensForSwap;
    address public uniswapV2PairForLiquidity;
    address public uniswapV2RouterForLiquidity;
    bool public useSwapExactTokensForAVAXSupportingFeeOnTransferTokensForLiquidity;

    /// Lossless Compliance
    address public admin;
    address public recoveryAdmin;
    address private recoveryAdminCandidate;
    bytes32 private recoveryAdminKeyHash;
    uint256 public timelockPeriod;
    uint256 public losslessTurnOffTimestamp;
    bool public isLosslessOn = true;
    ILssController public lossless;

    function initialize(address _treasury, address[] memory addresses, 
        uint256[] memory basisPoints, bool[] memory sellToNative, uint256 swapAmount,
        uint256 _rewardsFee, uint256 _liquidityPoolFee, uint256 _sellFee, uint256 _buyFee,
        bool _swapAndLiquifyEnabled) public initializer 
    {
        require(_treasury != address(0), "TREASURY_IS_0");
        require(addresses.length == basisPoints.length && basisPoints.length == sellToNative.length, "ARRAY_LENGTH_MISTMATCH");        
        require(_sellFee < 2001, "SELLFEE_>2000");
        require(_buyFee < 2001, "BUYFEE_>2000");
        __ERC20_init("MIND+", "MIND+");
        OwnableUpgradeable.__Ownable_init();
        
        for(uint256 x; x < addresses.length; x++) {
            FeeRecipients[feeRecipientCount].recipient = addresses[x];
            FeeRecipients[feeRecipientCount].basisPoints = basisPoints[x];
            FeeRecipients[feeRecipientCount].sellToNative = sellToNative[x];
            feeRecipientCount++;
            totalFeeBasisPoints += basisPoints[x];
            totalFeeBasisPointsToSwap += sellToNative[x] ? basisPoints[x] : 0;
            isExcludedFromFee[addresses[x]] = true;
        }

        treasury = _treasury;

        rewardsFee = _rewardsFee; 
        liquidityPoolFee = _liquidityPoolFee; 
        sellFee = _sellFee; 
        buyFee = _buyFee;
        maxBuyFee = _buyFee;
        maxSellFee = _sellFee;

        _mint(treasury, 250000000 * (10 ** 18));

        require(swapAmount > 0, "SWAP_IS_ZERO");
        swapTokensAmount = swapAmount * (10**18);
        swapAndLiquifyEnabled = _swapAndLiquifyEnabled;
    }

    receive() external payable { }

    /***** ERC20 TRANSFERS *****/

    function transfer(address recipient, uint256 amount) public override lssTransfer(recipient, amount) returns (bool) {
        _transfer(_msgSender(), recipient, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) public override lssTransferFrom(sender, recipient, amount) returns (bool) {
        _spendAllowance(sender, _msgSender(), amount);
        _transfer(sender, recipient, amount);        
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal override {
        require(isOpen || from == owner() || to == owner() ||
            proxyToApproved[from] || proxyToApproved[to], "NOT_OPEN");        
        require(from != address(0), "FROM_IS_ZERO");
        require(to != address(0), "TO_IS_ZERO");
        require(from == owner() || to == owner() || (!isBlacklisted[from] && !isBlacklisted[to]), "BLACKLISTED");

        uint256 fee;
        address referral;
        bool isBuyOrSell;
        uint256 transferAmount = amount;

        //sell
        if (!isExcludedFromFee[from] &&  automatedMarketMakerPairs[to]) {
            fee = sellFee;
            referral = Referrals[from];
            isBuyOrSell = true;
        }

        //buy
        if (!isExcludedFromFee[to] &&  automatedMarketMakerPairs[from]) {
            fee = buyFee;
            referral = Referrals[to];
            isBuyOrSell = true;
        }

        if (fee > 0) {
            uint256 feeAmount = amount * fee / 10000;
            transferAmount -= feeAmount;
            super._transfer(from, address(this), feeAmount);
        }
        // referral
        if (isBuyOrSell) {
            transferAmount -= _processReferralFee(referral, amount, referralRateForBuySell);
        }

        super._transfer(from, to, transferAmount);
    }   

    /***** MUTATIVE *****/

    function setReferral(address referral) external {
        require(_msgSender() != referral, "SAME_ADDRESS");
        Referrals[_msgSender()] = referral;
    }

    /***** OWNER ONLY *****/

    function openTrading() external onlyOwner {
        require(isOpen != true, "ALREADY_OPEN");
        isOpen = true;
    }

    /*** referrals ***/

    function setMinTokensForReferral(uint256 amount) external onlyOwner {
        minTokensForReferral = amount;
    }

    function setMinNodesForReferral(uint256 amount) external onlyOwner {
        minNodesForReferral = amount;
    }

    function setReferralRateForBuySell(uint256 value) external onlyOwner {
        require(value < 1001, "VALUE>1000");
        maxBuyFee = maxBuyFee - referralRateForBuySell + value;
        maxSellFee = maxSellFee - referralRateForBuySell + value;
        referralRateForBuySell = value;
    }

    function setReferralRateForNodeCreation(uint256 value) external onlyOwner {
        require(value < 1001, "VALUE>1000");
        referralRateForNodeCreation = value;
    }

    function setReferralRateForNodeRewards(uint256 value) external onlyOwner {
        require(value < 1001, "VALUE>1000");
        referralRateForNodeRewards = value;
    }

    /*** process fee (stabilators) ***/
    // 100 = 1.00%
    function setProcessFeeConfig(uint256 _nodeCreateProcessFee, uint256 _rewardProcessFee) external onlyOwner {
        require(_nodeCreateProcessFee < 1001, "VALUE>1000");
        require(_rewardProcessFee < 1001, "VALUE>1000");
        nodeCreateProcessFee = _nodeCreateProcessFee; 
        rewardProcessFee = _rewardProcessFee;        
    }

    function addFeeRecipient(address recipient, uint256 basisPoints, bool sellToNative) external onlyOwner {
        FeeRecipients[feeRecipientCount].recipient = recipient;
        FeeRecipients[feeRecipientCount].basisPoints = basisPoints;
        FeeRecipients[feeRecipientCount].sellToNative = sellToNative;
        feeRecipientCount++;
        totalFeeBasisPoints += basisPoints;
        totalFeeBasisPointsToSwap += sellToNative ? basisPoints : 0;
    }

    function editFeeRecipient(uint256 id, address recipient, uint256 basisPoints, bool sellToNative) external onlyOwner {
        require(id < feeRecipientCount, "INVALID_ID");
        totalFeeBasisPoints = totalFeeBasisPoints - FeeRecipients[id].basisPoints + basisPoints;
        totalFeeBasisPointsToSwap -= FeeRecipients[id].sellToNative ? FeeRecipients[id].basisPoints : 0;
        totalFeeBasisPointsToSwap += sellToNative ? basisPoints : 0;
        FeeRecipients[id].recipient = recipient;
        FeeRecipients[id].basisPoints = basisPoints;
        FeeRecipients[id].sellToNative = sellToNative;
    }

    function setNodeManagement(address nodeManagement) external onlyOwner {
        nodeRewardManager = NODERewardManagementV2(nodeManagement);
    }

    function updateSwapTokensAmount(uint256 value) external onlyOwner {
        swapTokensAmount = value;
    }

    function updateTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "ADDRESS_IS_0");
        treasury = _treasury;
    }

    // 1000 = 10.00%
    function updateRewardsFee(uint256 value) external onlyOwner {
        require(value < 101, "VALUE>100");
        rewardsFee = value;
    }

    // 1000 = 10.00%
    function updateLiquidityPoolFee(uint256 value) external onlyOwner {
        require(value < 2001, "VALUE>2000");
        liquidityPoolFee = value;
    }

    // 1000 = 10.00%
    function updateSellFee(uint256 value) external onlyOwner {
        require(value < 2001, "VALUE>2000");
        maxSellFee = maxSellFee - sellFee + value;
        sellFee = value;
    }

    // 1000 = 10.00%
    function updateBuyFee(uint256 value) external onlyOwner {
        require(value < 2001, "VALUE>2000");
        maxBuyFee = maxBuyFee - buyFee + value;
        buyFee = value;
    }

    // 1000 = 10.00%
    function updateRwSwapFee(uint256 value) external onlyOwner {
        rwSwap = value;
    }

    function blacklistMalicious(address account, bool value) external onlyOwner {
        isBlacklisted[account] = value;
    }

    function excludedFromFee(address _address) external view returns(bool) {
        return isExcludedFromFee[_address];
    }

    function setExcludedFromFee(address account, bool value) external onlyOwner {
        isExcludedFromFee[account] = value;
    }

    function setSwapAndLiquifyEnabled(bool newVal) external onlyOwner {
        swapAndLiquifyEnabled = newVal;
    }

    function setProxyState(address proxyAddress, bool value) external onlyOwner {
        proxyToApproved[proxyAddress] = value;
    }

    function setAutomatedMarketMakerPair(address pair, bool value) external onlyOwner {
        require(automatedMarketMakerPairs[pair] != value, "AMM_ALREADY_SET");
        automatedMarketMakerPairs[pair] = value;  
        isExcludedFromFee[pair] = value;      
        emit SetAutomatedMarketMakerPair(pair, value);
    }

    function setSwapPairAndRouter(address pair, address router, bool _useSwapExactTokensForAVAXSupportingFeeOnTransferTokens) external onlyOwner {
        require(pair != address(0), "PAIR_IS_ZERO");
        require(router != address(0), "ROUTER_IS_ZERO");
        uniswapV2PairForSwap = pair;
        uniswapV2RouterForSwap = router;
        isExcludedFromFee[router] = true;
        useSwapExactTokensForAVAXSupportingFeeOnTransferTokensForSwap = _useSwapExactTokensForAVAXSupportingFeeOnTransferTokens;
    }

    function setLiquidityPairAndRouter(address pair, address router, bool _useSwapExactTokensForAVAXSupportingFeeOnTransferTokens) external onlyOwner {
        require(pair != address(0), "PAIR_IS_ZERO");
        require(router != address(0), "ROUTER_IS_ZERO");
        uniswapV2PairForLiquidity = pair;
        uniswapV2RouterForLiquidity = router;
        isExcludedFromFee[router] = true;
        useSwapExactTokensForAVAXSupportingFeeOnTransferTokensForLiquidity = _useSwapExactTokensForAVAXSupportingFeeOnTransferTokens;
    }

    function manualSwapAndLiquify() external onlyOwner {
        _manualSwapAndLiquify();
    }

    function _manualSwapAndLiquify() private {
        uint256 contractTokenBalance = balanceOf(address(this)) >  rewardsPool 
            ?  balanceOf(address(this)) -  rewardsPool : 0;

        // amount for rewards
        uint256 rewardAmount = contractTokenBalance * rewardsFee / 10000;
        uint256 rewardAmountToSwap = rewardAmount * rwSwap / 10000;
        uint256 liquidityAmount = contractTokenBalance * liquidityPoolFee / 10000;
        uint256 liquidityAmountToSwap = liquidityAmount / 2;
        uint256 remainder = contractTokenBalance - rewardAmount - liquidityAmount;
        uint256 remainderToSwap = totalFeeBasisPoints > 0
            ? remainder * totalFeeBasisPointsToSwap / totalFeeBasisPoints
            : 0;
        uint256 totalAmountToSwap = rewardAmountToSwap + liquidityAmountToSwap + remainderToSwap;
        uint256 receivedAVAX = _swap(totalAmountToSwap);
        // add liquidity
        if (totalAmountToSwap > 0) {
            _addLiquidity(liquidityAmountToSwap, receivedAVAX * liquidityAmountToSwap / totalAmountToSwap);
        }

        // send to fee recipients
        uint256 remainderAVAX = totalAmountToSwap > 0
            ? receivedAVAX * remainderToSwap / totalAmountToSwap
            : 0;
        uint256 remainderAVAXBalance = remainderAVAX;
        remainder -= remainderToSwap;
        uint256 totalFeeBasisPointsNotToSwap = totalFeeBasisPoints - totalFeeBasisPointsToSwap;
        uint256 remainderBalance = remainder;
        for(uint256 x; x < feeRecipientCount; x++) {
            if (FeeRecipients[x].sellToNative) {
                uint256 amount = totalFeeBasisPointsToSwap > 0
                    ? remainderAVAX * FeeRecipients[x].basisPoints / totalFeeBasisPointsToSwap
                    : 0;
                amount = amount > remainderAVAXBalance ? remainderAVAXBalance : amount;
                (bool sent, bytes memory data) = FeeRecipients[x].recipient.call{value: amount}("");
                require(sent, "FAILED_TO_SEND");
                remainderAVAXBalance -= amount;
            } else {
                uint256 amount = totalFeeBasisPointsNotToSwap > 0
                    ? remainder * FeeRecipients[x].basisPoints / totalFeeBasisPointsNotToSwap
                    : 0;
                amount = amount > remainderBalance ? remainderBalance : amount;
                super._transfer(address(this),FeeRecipients[x].recipient, amount);
                remainderBalance -= amount;
            }
        }
        rewardsPool = balanceOf(address(this));
        emit ManualSwapAndLiquify(_msgSender(), contractTokenBalance);
    }   

    function withdrawAVAX() external nonReentrant onlyApproved {
        require(treasury != address(0), "TREASURY_NOT_SET");
        uint256 bal = address(this).balance;
        (bool sent, ) = treasury.call{value: bal}("");
        require(sent, "FAILED_SENDING_FUNDS");
        emit WithdrawAVAX(_msgSender(), bal);
    }

    function withdrawTokens(address _token) external nonReentrant onlyApproved {
        require(treasury != address(0), "TREASURY_NOT_SET");
        IERC20Upgradeable(_token).safeTransfer(
            treasury,
            IERC20Upgradeable(_token).balanceOf(address(this))
        );
    }

    /***** PRIVATE *****/

    function _swap(uint256 tokens) private returns(uint256) {
        uint256 initialETHBalance = address(this).balance;
        _swapTokensForEth(tokens);
        return (address(this).balance) - (initialETHBalance);
    }

    function _swapTokensForEth(uint256 tokenAmount) private {
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = useSwapExactTokensForAVAXSupportingFeeOnTransferTokensForSwap
            ? IRouter(uniswapV2RouterForSwap).WAVAX()
            : IRouter(uniswapV2RouterForSwap).WETH();

        _approve(address(this), address(uniswapV2RouterForSwap), tokenAmount);

        if (useSwapExactTokensForAVAXSupportingFeeOnTransferTokensForSwap) {
            IRouter(uniswapV2RouterForSwap).swapExactTokensForAVAXSupportingFeeOnTransferTokens(
                tokenAmount,
                0, // accept any amount of ETH
                path,
                address(this),
                block.timestamp
            );
        } else {
            IRouter(uniswapV2RouterForSwap).swapExactTokensForETHSupportingFeeOnTransferTokens(
                tokenAmount,
                0, // accept any amount of ETH
                path,
                address(this),
                block.timestamp
            );
        }
    }

    function _addLiquidity(uint256 tokenAmount, uint256 ethAmount) private {
        if (tokenAmount == 0 || ethAmount == 0) return;
        // approve token transfer to cover all possible scenarios
        _approve(address(this), uniswapV2RouterForLiquidity, tokenAmount);

        // add the liquidity
        if (useSwapExactTokensForAVAXSupportingFeeOnTransferTokensForLiquidity) {
            IRouter(uniswapV2RouterForLiquidity).addLiquidityAVAX{value: ethAmount}(
                address(this),
                tokenAmount,
                0, // slippage is unavoidable
                0, // slippage is unavoidable
                treasury,
                block.timestamp
            );
        } else {
            IRouter(uniswapV2RouterForLiquidity).addLiquidityETH{value: ethAmount}(
                address(this),
                tokenAmount,
                0, // slippage is unavoidable
                0, // slippage is unavoidable
                treasury,
                block.timestamp
            );        
        }
    }

    function _toString(uint256 value) internal pure returns (bytes memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return buffer;
    }

    /***** MUTATIVE (NODE) *****/

    function createNodeWithTokens(string memory name) public {
        require(bytes(name).length > 3 && bytes(name).length < 32, "NAME_SIZE_INVALID");
        require(!isBlacklisted[_msgSender()], "BLACKLISTED");
        require(balanceOf(_msgSender()) >= nodeRewardManager.nodePrice(), "INSUFFICIENT_BALANCE");

        IERC20Upgradeable(address(this)).safeTransferFrom(_msgSender(), address(this), nodeRewardManager.nodePrice());

        _processReferralFee(_msgSender(), nodeRewardManager.nodePrice(), referralRateForNodeCreation);
        // validator
        uint256 processFee;
        if (nodeCreateProcessFee > 0 && nodeCreateProcessFeeRecipient != address(0)) {
            processFee = nodeRewardManager.nodePrice() * nodeCreateProcessFee / 10000;
            if (processFee > 0) {
                totalProcessFees += processFee;
                IERC20Upgradeable(address(this)).safeTransferFrom(_msgSender(), nodeCreateProcessFeeRecipient, processFee);
            }
        }

        nodeRewardManager.createNode(_msgSender(), name);

        uint256 contractTokenBalance = balanceOf(address(this)) >  rewardsPool 
            ?  balanceOf(address(this)) -  rewardsPool : 0;
        bool swapAmountOk = contractTokenBalance >= swapTokensAmount;
        if (
            swapAmountOk &&
            swapAndLiquifyEnabled &&
            !swapping &&
            _msgSender() != owner() &&
            !automatedMarketMakerPairs[_msgSender()]
        ) {
            swapping = true;

            _manualSwapAndLiquify();
            swapping = false;
        }
        emit CreateNodeWithTokens(_msgSender(), name);
    }

    function setNodeCreateProcessFeeRecipient(address value) external onlyOwner {
        nodeCreateProcessFeeRecipient = value;
        emit SetNodeCreateProcessFeeRecipient(_msgSender(), value);
    }

    function setRewardProcessFeeRecipient(address value) external onlyOwner {
        rewardProcessFeeRecipient = value;
        emit SetRewardProcessFeeRecipient(_msgSender(), value);
    }

    function addToRewardsPool(uint256 amount) external onlyApproved {
        transfer(address(this), amount);
        rewardsPool += amount;
        emit AddRewardsToPool(_msgSender(), amount);
    }

    function removeFromRewardsPool(uint256 amount) external onlyApproved {
        require(rewardsPool > 0 && rewardsPool >= amount, "INSUFFICIENT_REWARDS");
        rewardsPool -= amount;    
        _transfer(address(this), treasury, amount);
        emit RemoveFromRewardsPool(address(this), amount);
    } 

    function cashoutReward(uint256 blocktime) external {
        require(!isBlacklisted[_msgSender()], "BLACKLISTED");
        require(_msgSender() != treasury, "TREASURY_CANNOT_CASHOUT");
        uint256 rewardAmount = nodeRewardManager._getRewardAmountOf(_msgSender(), blocktime);
        require(rewardAmount > 0, "NO_REWARDS");
        nodeRewardManager._cashoutNodeReward(_msgSender(), blocktime);

        uint256 referralAmount = _processReferralFee(_msgSender(), rewardAmount, referralRateForNodeRewards);
        //validator
        uint256 processFee = _processRewardProcessFee(rewardAmount);
        IERC20Upgradeable(address(this)).safeTransfer(_msgSender(), rewardAmount - referralAmount - processFee);
        rewardsPool -= rewardAmount;
        emit CashoutReward(_msgSender(), rewardAmount);
    }  

    function cashoutAll() public {
        require(!isBlacklisted[_msgSender()], "BLACKLISTED");
        require(_msgSender() != treasury, "TREASURY_NOT_ALLOWED");
        uint256 rewardAmount = nodeRewardManager._getRewardAmountOf(_msgSender());
        require(rewardAmount > 0, "NO_REWARDS");
        nodeRewardManager._cashoutAllNodesReward(_msgSender());

        uint256 referralAmount = _processReferralFee(_msgSender(), rewardAmount, referralRateForNodeRewards);
        //validator
        uint256 processFee = _processRewardProcessFee(rewardAmount);
        IERC20Upgradeable(address(this)).safeTransfer(_msgSender(), rewardAmount - referralAmount - processFee);
        rewardsPool -= rewardAmount;
        emit CashoutAll(_msgSender(), rewardAmount);
    }

    function compound(uint256 amount) external {
        require(amount > 0, "AMOUNT_IS_ZERO");
        uint256 nodePrice = nodeRewardManager.nodePrice();
        require(amount % nodePrice == 0, "AMOUNT_NOT_MULTIPLIER");

        cashoutAll();
        require(balanceOf(_msgSender()) >= amount, "BALANCE_INSUFFICIENT");
        bytes memory basic = bytes.concat("BRAIN-", _toString(block.timestamp), _toString(nodeRewardManager._getNodeNumberOf(_msgSender())));
        for (uint256 i = 1; i <= amount / nodePrice; i++) {
          string memory name = string(bytes.concat(basic, _toString(i)));
          createNodeWithTokens(name);
        }
        emit Compound(_msgSender(), amount);
    }

    function renameNode(string memory oldName, string memory newName) external {
        require(nodeRewardManager._isNodeOwner(_msgSender()), "NO_NODE_OWNER");
        require(bytes(newName).length > 3 && bytes(newName).length < 32, "NAME_SIZE_INVALID");
        nodeRewardManager._renameNode(_msgSender(), oldName, newName);
        emit RenameNode(_msgSender(), oldName, newName);
    }

    function transferNode(address to, string calldata nodeName) external {
        nodeRewardManager._transferNode(_msgSender(), to, nodeName);
        emit TransferNode(_msgSender(), to, nodeName);
    }

    function _getReferral(address user) private view returns(address referral) {
        referral = Referrals[user];
        referral = referral == address(0)  || balanceOf(referral) < minTokensForReferral
            || nodeRewardManager._getNodeNumberOf(referral) < minNodesForReferral
            ? address(this) 
            : referral;
    } 
    
    function _processReferralFee(address user, uint256 amount, uint256 rate) private returns(uint256 referralAmount) {
        if (rate == 0) return 0;
        address referral = _getReferral(user);
        referralAmount = amount * rate / 10000;
        if (referralAmount > 0) {
            ReferralIncome[referral] += referralAmount;
            IERC20Upgradeable(address(this)).safeTransfer(referral, referralAmount);
        }
    } 

    function _processRewardProcessFee(uint256 rewardAmount) private returns(uint256 processFee) {
        if (rewardProcessFee > 0 && rewardProcessFeeRecipient != address(0)) {
            processFee = rewardAmount * rewardProcessFee / 10000;
            if (processFee > 0) { 
                totalProcessFees += processFee;
                IERC20Upgradeable(address(this)).safeTransfer(rewardProcessFeeRecipient, processFee);
            }
        }        
    }
    
    /***** MODIFIERS & EVENTS *****/

    modifier onlyApproved() {
        require(proxyToApproved[_msgSender()] == true || _msgSender() == owner(), "onlyProxy");
        _;
    }       

    event OpenTrading(address indexed user);
    event WithdrawAVAX(address indexed sender, uint256 indexed balance);
    event UpdateUniswapV2Router(address indexed newAddress, address indexed oldAddress);
    event SetAutomatedMarketMakerPair(address indexed pair, bool indexed value);
    event LiquidityWalletUpdated(address indexed newLiquidityWallet, address indexed oldLiquidityWallet);
    event SwapAndLiquify(uint256 tokensSwapped, uint256 ethReceived, uint256 tokensIntoLiqudity);
    event CreateNodeWithTokens(address indexed user, string indexed name);
    event CashoutReward(address indexed user, uint256 indexed rewardAmount);
    event CashoutAll(address indexed user, uint256 indexed amount);
    event Compound(address indexed user, uint256 indexed amount);
    event RenameNode(address indexed user, string indexed oldName, string indexed newName);
    event ManualSwapAndLiquify(address indexed user, uint256 indexed contractTokenBalance);
    event AddRewardsToPool(address indexed user, uint256 indexed amount);
    event RemoveFromRewardsPool(address indexed user, uint256 indexed amount);
    event SetNodeCreateProcessFeeRecipient(address indexed user, address indexed value);
    event SetRewardProcessFeeRecipient(address indexed user, address indexed value);
    event SetRouter(address indexed router, bool indexed value);
    event TransferNode(address indexed user, address indexed to, string indexed nodeName);


    /// Lossless Compliance

    event ConfirmBlacklisted(address blacklisted);

    function lssTransfer(address recipient, uint256 amount) internal {
        if (isLosslessOn) {
            lossless.beforeTransfer(_msgSender(), recipient, amount);
        }
    }

    function lssTransferFrom(address sender, address recipient, uint256 amount) internal {
        if (isLosslessOn) {
            lossless.beforeTransferFrom(_msgSender(), sender, recipient, amount);
        }
    }

    modifier lssBurn(address account, uint256 amount) {
        if (isLosslessOn) {
            lossless.beforeBurn(account, amount);
        } 
        _;
    }

    modifier lssMint(address account, uint256 amount) {
        if (isLosslessOn) {
            lossless.beforeMint(account, amount);
        } 
        _;
    }

    modifier onlyRecoveryAdmin() {
        require(_msgSender() == recoveryAdmin, "LERC20: Must be recovery admin");
        _;
    }


    /**
     * @notice  Function to set the lossless controller
     *
     * @param   _controller Lossless controller address
     */
    function setLosslessController(address _controller) public onlyOwner {
        require(_controller != address(0), 
        "LERC20: Controller cannot be zero address.");
        require(_controller != address(lossless), 
        "LERC20: Cannot set same address.");

        lossless = ILssController(_controller);
    }

    /**
     * @notice  Function to set the lossless admin that interacts with controller
     *
     * @param   newAdmin address of the new admin
     */
    function setLosslessAdmin(address newAdmin) external onlyOwner {
        require(newAdmin != admin, "LERC20: Cannot set same address");
        admin = newAdmin;
    }

    /**
     * @notice  Function to propose a new recovery admin
     *
     * @param   candidate new admin proposed address
     * @param   keyHash Key to accept
     */
    function transferRecoveryAdminOwnership(address candidate, bytes32 keyHash) external onlyOwner {
        recoveryAdminCandidate = candidate;
        recoveryAdminKeyHash = keyHash;
    }


    /**
     * @notice  Function to accept the admin proposal
     * @param   key Key to accept
     */
    function acceptRecoveryAdminOwnership(bytes memory key) external {
        require(_msgSender() == recoveryAdminCandidate, "LERC20: Must be canditate");
        require(keccak256(key) == recoveryAdminKeyHash, "LERC20: Invalid key");
        recoveryAdmin = recoveryAdminCandidate;
        recoveryAdminCandidate = address(0);
    }


    /**
     * @notice  Function to retrieve the funds of a blacklisted address.
     *
     * @param   from Array of addresses corresponding to a report and a second report
     */
    function transferOutBlacklistedFunds(address[] calldata from) external {
        require(_msgSender() == address(lossless), "LERC20: Only lossless contract");

        uint256 fromLength = from.length;
        uint256 totalAmount = 0;
        
        for(uint256 i = 0; i < fromLength;i++) {
            address fromAddress = from[i];
            uint256 fromBalance = balanceOf(fromAddress);
            _transfer(fromAddress, address(lossless), fromBalance);
        }
    }

    /**
     * @notice  Function to propose turning off everything related to lossless
    */
    function proposeLosslessTurnOff() external onlyRecoveryAdmin {
        require(losslessTurnOffTimestamp == 0, "LERC20: TurnOff already proposed");
        require(isLosslessOn, "LERC20: Lossless already off");
        losslessTurnOffTimestamp = block.timestamp + timelockPeriod;
    }

    /**
     * @notice  Function to execute lossless turn off after a period of time
    */
    function executeLosslessTurnOff() external onlyRecoveryAdmin {
        require(losslessTurnOffTimestamp != 0, "LERC20: TurnOff not proposed");
        require(losslessTurnOffTimestamp <= block.timestamp, "LERC20: Time lock in progress");
        isLosslessOn = false;
        losslessTurnOffTimestamp = 0;
    }

    /**
     * @notice  Function to turn on everything related to lossless
    */
    function executeLosslessTurnOn() external onlyRecoveryAdmin {
        require(!isLosslessOn, "LERC20: Lossless already on");
        losslessTurnOffTimestamp = 0;
        isLosslessOn = true;
    }
}

interface ILssController {
    function beforeTransfer(address _msgSender, address _recipient, uint256 _amount) external;
    function beforeTransferFrom(address _msgSender, address _sender, address _recipient, uint256 _amount) external;
    function beforeMint(address _to, uint256 _amount) external;
    function beforeBurn(address _account, uint256 _amount) external;
}