// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title TrustEscrow
 * @notice Simple escrow for agent-to-agent payments on Base
 * @dev Supports ETH and ERC-20, no reputation integration
 */
contract TrustEscrow is ReentrancyGuard {
    
    using SafeERC20 for IERC20;
    
    enum EscrowStatus {
        Active,
        Completed,
        Disputed,
        Cancelled
    }
    
    struct Escrow {
        address payer;
        address payee;
        uint256 amount;
        address token;          // address(0) for ETH
        EscrowStatus status;
        uint256 createdAt;
        uint256 deadline;
        string serviceDescription;
        bool payeeDelivered;
    }
    
    mapping(uint256 => Escrow) public escrows;
    uint256 public escrowCounter;
    
    // Platform fee (basis points, 50 = 0.5%)
    uint256 public platformFeeBps = 50;
    address public platformFeeRecipient;
    address public arbitrator;
    uint256 public accumulatedFees;
    
    event EscrowCreated(uint256 indexed id, address indexed payer, address indexed payee, uint256 amount);
    event ServiceDelivered(uint256 indexed id);
    event EscrowCompleted(uint256 indexed id);
    event EscrowDisputed(uint256 indexed id, address disputer);
    event EscrowCancelled(uint256 indexed id);
    event DisputeResolved(uint256 indexed id, address indexed resolver, bool refunded);
    event ArbitratorChanged(address indexed oldArbitrator, address indexed newArbitrator);
    
    constructor(address _feeRecipient, address _arbitrator) {
        platformFeeRecipient = _feeRecipient;
        arbitrator = _arbitrator;
    }
    
    /**
     * @notice Create escrow with ETH
     */
    function createEscrow(
        address payee,
        uint256 deadline,
        string memory serviceDescription
    ) external payable nonReentrant returns (uint256) {
        require(msg.value > 0, "Amount must be > 0");
        require(payee != address(0) && payee != msg.sender, "Invalid payee");
        require(deadline > block.timestamp, "Deadline must be in future");
        
        uint256 id = escrowCounter++;
        
        escrows[id] = Escrow({
            payer: msg.sender,
            payee: payee,
            amount: msg.value,
            token: address(0),
            status: EscrowStatus.Active,
            createdAt: block.timestamp,
            deadline: deadline,
            serviceDescription: serviceDescription,
            payeeDelivered: false
        });
        
        emit EscrowCreated(id, msg.sender, payee, msg.value);
        return id;
    }
    
    /**
     * @notice Create escrow with ERC-20
     * @dev Supports fee-on-transfer tokens by checking actual received amount
     */
    function createEscrowToken(
        address payee,
        uint256 amount,
        address token,
        uint256 deadline,
        string memory serviceDescription
    ) external nonReentrant returns (uint256) {
        require(amount > 0, "Amount must be > 0");
        require(payee != address(0) && payee != msg.sender, "Invalid payee");
        require(token != address(0), "Invalid token");
        require(deadline > block.timestamp, "Deadline must be in future");
        
        // Check balance before and after to support fee-on-transfer tokens
        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        
        uint256 balanceAfter = IERC20(token).balanceOf(address(this));
        uint256 actualAmount = balanceAfter - balanceBefore;
        require(actualAmount > 0, "No tokens received");
        
        uint256 id = escrowCounter++;
        
        escrows[id] = Escrow({
            payer: msg.sender,
            payee: payee,
            amount: actualAmount,  // Store actual received amount
            token: token,
            status: EscrowStatus.Active,
            createdAt: block.timestamp,
            deadline: deadline,
            serviceDescription: serviceDescription,
            payeeDelivered: false
        });
        
        emit EscrowCreated(id, msg.sender, payee, actualAmount);
        return id;
    }
    
    /**
     * @notice Mark service as delivered (payee only)
     */
    function deliverService(uint256 escrowId) external {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.status == EscrowStatus.Active, "Escrow not active");
        require(msg.sender == escrow.payee, "Only payee can deliver");
        require(!escrow.payeeDelivered, "Already marked delivered");
        
        escrow.payeeDelivered = true;
        emit ServiceDelivered(escrowId);
    }
    
    /**
     * @notice Complete escrow and release payment (payer only)
     */
    function completeEscrow(uint256 escrowId) external nonReentrant {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.status == EscrowStatus.Active, "Escrow not active");
        require(msg.sender == escrow.payer, "Only payer can complete");
        require(escrow.payeeDelivered, "Service not delivered yet");
        
        escrow.status = EscrowStatus.Completed;
        _releasePayment(escrow);
        
        emit EscrowCompleted(escrowId);
    }
    
    /**
     * @notice Cancel escrow and refund (payer only, before delivery)
     */
    function cancelEscrow(uint256 escrowId) external nonReentrant {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.status == EscrowStatus.Active, "Escrow not active");
        require(msg.sender == escrow.payer, "Only payer can cancel");
        require(!escrow.payeeDelivered, "Cannot cancel after delivery");
        
        escrow.status = EscrowStatus.Cancelled;
        
        if (escrow.token == address(0)) {
            (bool success, ) = escrow.payer.call{value: escrow.amount}("");
            require(success, "Refund failed");
        } else {
            IERC20(escrow.token).safeTransfer(escrow.payer, escrow.amount);
        }
        
        emit EscrowCancelled(escrowId);
    }
    
    /**
     * @notice Auto-release after deadline (if service delivered)
     */
    function releaseAfterDeadline(uint256 escrowId) external nonReentrant {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.status == EscrowStatus.Active, "Escrow not active");
        require(escrow.payeeDelivered, "Service not delivered");
        require(block.timestamp > escrow.deadline, "Deadline not reached");
        
        escrow.status = EscrowStatus.Completed;
        _releasePayment(escrow);
        
        emit EscrowCompleted(escrowId);
    }
    
    /**
     * @notice Raise a dispute
     */
    function dispute(uint256 escrowId) external {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.status == EscrowStatus.Active, "Escrow not active");
        require(
            msg.sender == escrow.payer || msg.sender == escrow.payee,
            "Not authorized"
        );
        
        escrow.status = EscrowStatus.Disputed;
        emit EscrowDisputed(escrowId, msg.sender);
    }
    
    /**
     * @notice Resolve dispute (arbitrator only)
     * @param escrowId ID of the escrow
     * @param refund True = refund payer, False = pay payee
     */
    function resolveDispute(uint256 escrowId, bool refund) external nonReentrant {
        require(msg.sender == arbitrator, "Only arbitrator can resolve");
        Escrow storage escrow = escrows[escrowId];
        require(escrow.status == EscrowStatus.Disputed, "Escrow not disputed");
        
        address recipient = refund ? escrow.payer : escrow.payee;
        escrow.status = refund ? EscrowStatus.Cancelled : EscrowStatus.Completed;
        
        // No fee taken on dispute resolution - full amount goes to decided party
        if (escrow.token == address(0)) {
            (bool success, ) = recipient.call{value: escrow.amount}("");
            require(success, "Transfer failed");
        } else {
            IERC20(escrow.token).safeTransfer(recipient, escrow.amount);
        }
        
        emit DisputeResolved(escrowId, msg.sender, refund);
    }
    
    /**
     * @notice Change arbitrator (current arbitrator only)
     * @param newArbitrator Address of new arbitrator
     */
    function setArbitrator(address newArbitrator) external {
        require(msg.sender == arbitrator, "Only arbitrator can change");
        require(newArbitrator != address(0), "Invalid arbitrator");
        
        address oldArbitrator = arbitrator;
        arbitrator = newArbitrator;
        
        emit ArbitratorChanged(oldArbitrator, newArbitrator);
    }
    
    /**
     * @notice Withdraw accumulated platform fees
     */
    function withdrawFees() external nonReentrant {
        require(msg.sender == platformFeeRecipient, "Not authorized");
        
        uint256 amount = accumulatedFees;
        accumulatedFees = 0;
        
        (bool success, ) = platformFeeRecipient.call{value: amount}("");
        require(success, "Withdrawal failed");
    }
    
    /**
     * @notice Get escrow details
     */
    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
        return escrows[escrowId];
    }
    
    /**
     * @notice Internal helper to release payment with fee calculation
     * @dev Extracted to avoid code duplication between completeEscrow and releaseAfterDeadline
     */
    function _releasePayment(Escrow storage escrow) internal {
        uint256 fee = (escrow.amount * platformFeeBps) / 10000;
        uint256 payeeAmount = escrow.amount - fee;
        
        if (escrow.token == address(0)) {
            accumulatedFees += fee;
            (bool success, ) = escrow.payee.call{value: payeeAmount}("");
            require(success, "Payment failed");
        } else {
            IERC20(escrow.token).safeTransfer(platformFeeRecipient, fee);
            IERC20(escrow.token).safeTransfer(escrow.payee, payeeAmount);
        }
    }
}
