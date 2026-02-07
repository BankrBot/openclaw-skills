// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TrustEscrowV2
 * @dev Enhanced escrow for agent-to-agent commerce with USDC
 * @notice V2 improvements: proper dispute resolution, cancellation, batch ops, gas optimization
 */
contract TrustEscrowV2 is ReentrancyGuard {
    IERC20 public immutable usdc;
    address public arbitrator;
    uint256 public constant INSPECTION_PERIOD = 1 hours;
    uint256 public constant CANCELLATION_WINDOW = 30 minutes;
    
    enum EscrowState { Active, Released, Disputed, Refunded, Cancelled }
    
    struct Escrow {
        address sender;
        address receiver;
        uint96 amount; // Pack tightly with state
        uint40 createdAt;
        uint40 deadline;
        EscrowState state;
    }
    
    mapping(uint256 => Escrow) public escrows;
    uint256 public nextEscrowId;
    
    // Note: amount not indexed due to 3-param limit (escrowId/sender/receiver prioritized for filtering)
    // To filter by amount, use off-chain indexing or The Graph
    event EscrowCreated(uint256 indexed escrowId, address indexed sender, address indexed receiver, uint256 amount, uint256 deadline);
    event EscrowReleased(uint256 indexed escrowId, address indexed releaser, uint256 amount);
    event EscrowDisputed(uint256 indexed escrowId, address indexed disputer);
    event DisputeResolved(uint256 indexed escrowId, address indexed resolver, bool refunded);
    event EscrowCancelled(uint256 indexed escrowId, address indexed canceller);
    event ArbitratorChanged(address indexed oldArbitrator, address indexed newArbitrator);
    
    error InvalidReceiver();
    error InvalidAmount();
    error InvalidDeadline();
    error TransferFailed();
    error Unauthorized();
    error InvalidState();
    error DeadlineNotReached();
    error CancellationWindowExpired();
    
    constructor(address _usdc, address _arbitrator) {
        usdc = IERC20(_usdc);
        arbitrator = _arbitrator;
    }
    
    /**
     * @dev Create escrow - optimized for agent speed
     * @param receiver Agent receiving payment after delivery
     * @param amount USDC amount (6 decimals) - max 79B USDC (uint96)
     * @param deadline Unix timestamp for auto-release
     * @return escrowId Unique identifier for this escrow
     */
    function createEscrow(
        address receiver,
        uint96 amount,
        uint40 deadline
    ) external nonReentrant returns (uint256 escrowId) {
        if (receiver == address(0)) revert InvalidReceiver();
        if (amount == 0) revert InvalidAmount();
        if (deadline <= block.timestamp) revert InvalidDeadline();
        
        if (!usdc.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        
        escrowId = nextEscrowId++;
        escrows[escrowId] = Escrow({
            sender: msg.sender,
            receiver: receiver,
            amount: amount,
            createdAt: uint40(block.timestamp),
            deadline: deadline,
            state: EscrowState.Active
        });
        
        emit EscrowCreated(escrowId, msg.sender, receiver, amount, deadline);
    }
    
    /**
     * @dev Batch create multiple escrows (gas efficient for agents)
     * @param receivers Array of receiver addresses
     * @param amounts Array of USDC amounts
     * @param deadlines Array of deadlines
     * @return escrowIds Array of created escrow IDs (0 = failed)
     * @return success Array of success flags for each escrow
     * @notice Continues on individual failures, returns success status per escrow
     */
    function createEscrowBatch(
        address[] calldata receivers,
        uint96[] calldata amounts,
        uint40[] calldata deadlines
    ) external nonReentrant returns (uint256[] memory escrowIds, bool[] memory success) {
        uint256 length = receivers.length;
        if (length != amounts.length || length != deadlines.length) revert InvalidAmount();
        
        escrowIds = new uint256[](length);
        success = new bool[](length);
        uint256 totalAmount;
        
        for (uint256 i = 0; i < length; i++) {
            // Validate before processing
            if (receivers[i] == address(0) || amounts[i] == 0 || deadlines[i] <= block.timestamp) {
                success[i] = false;
                continue;
            }
            
            totalAmount += amounts[i];
            uint256 escrowId = nextEscrowId++;
            escrowIds[i] = escrowId;
            success[i] = true;
            
            escrows[escrowId] = Escrow({
                sender: msg.sender,
                receiver: receivers[i],
                amount: amounts[i],
                createdAt: uint40(block.timestamp),
                deadline: deadlines[i],
                state: EscrowState.Active
            });
            
            emit EscrowCreated(escrowId, msg.sender, receivers[i], amounts[i], deadlines[i]);
        }
        
        if (totalAmount > 0) {
            if (!usdc.transferFrom(msg.sender, address(this), totalAmount)) revert TransferFailed();
        }
    }
    
    /**
     * @dev Cancel escrow within cancellation window (sender only)
     * @param escrowId ID of the escrow
     */
    function cancel(uint256 escrowId) external nonReentrant {
        Escrow storage escrow = escrows[escrowId];
        if (escrow.sender != msg.sender) revert Unauthorized();
        if (escrow.state != EscrowState.Active) revert InvalidState();
        if (block.timestamp > escrow.createdAt + CANCELLATION_WINDOW) revert CancellationWindowExpired();
        
        escrow.state = EscrowState.Cancelled;
        if (!usdc.transfer(escrow.sender, escrow.amount)) revert TransferFailed();
        
        emit EscrowCancelled(escrowId, msg.sender);
    }
    
    /**
     * @dev Sender releases payment (work verified)
     * @param escrowId ID of the escrow
     */
    function release(uint256 escrowId) external nonReentrant {
        Escrow storage escrow = escrows[escrowId];
        if (escrow.sender != msg.sender) revert Unauthorized();
        if (escrow.state != EscrowState.Active) revert InvalidState();
        
        escrow.state = EscrowState.Released;
        if (!usdc.transfer(escrow.receiver, escrow.amount)) revert TransferFailed();
        
        emit EscrowReleased(escrowId, msg.sender, escrow.amount);
    }
    
    /**
     * @dev Batch release multiple escrows (gas efficient)
     * @param escrowIds Array of escrow IDs to release
     * @return success Array of success flags for each release
     * @notice Continues on individual failures, returns success status per escrow
     */
    function releaseBatch(uint256[] calldata escrowIds) external nonReentrant returns (bool[] memory success) {
        success = new bool[](escrowIds.length);
        
        for (uint256 i = 0; i < escrowIds.length; i++) {
            Escrow storage escrow = escrows[escrowIds[i]];
            
            // Skip if unauthorized or invalid state
            if (escrow.sender != msg.sender || escrow.state != EscrowState.Active) {
                success[i] = false;
                continue;
            }
            
            escrow.state = EscrowState.Released;
            if (!usdc.transfer(escrow.receiver, escrow.amount)) {
                // Revert state if transfer fails
                escrow.state = EscrowState.Active;
                success[i] = false;
                continue;
            }
            
            success[i] = true;
            emit EscrowReleased(escrowIds[i], msg.sender, escrow.amount);
        }
    }
    
    /**
     * @dev Auto-release after deadline + inspection period (trustless)
     * @param escrowId ID of the escrow
     * @notice Anyone can call - enables passive income for trigger bots
     */
    function autoRelease(uint256 escrowId) external nonReentrant {
        Escrow storage escrow = escrows[escrowId];
        if (escrow.state != EscrowState.Active) revert InvalidState();
        if (block.timestamp < escrow.deadline + INSPECTION_PERIOD) revert DeadlineNotReached();
        
        escrow.state = EscrowState.Released;
        if (!usdc.transfer(escrow.receiver, escrow.amount)) revert TransferFailed();
        
        emit EscrowReleased(escrowId, msg.sender, escrow.amount);
    }
    
    /**
     * @dev Batch auto-release (gas efficient for keeper bots)
     * @param escrowIds Array of escrow IDs to auto-release
     * @return success Array of success flags for each auto-release
     * @notice Continues on individual failures, returns success status per escrow
     */
    function autoReleaseBatch(uint256[] calldata escrowIds) external nonReentrant returns (bool[] memory success) {
        success = new bool[](escrowIds.length);
        
        for (uint256 i = 0; i < escrowIds.length; i++) {
            Escrow storage escrow = escrows[escrowIds[i]];
            
            // Skip if invalid state or deadline not reached
            if (escrow.state != EscrowState.Active || block.timestamp < escrow.deadline + INSPECTION_PERIOD) {
                success[i] = false;
                continue;
            }
            
            escrow.state = EscrowState.Released;
            if (!usdc.transfer(escrow.receiver, escrow.amount)) {
                // Revert state if transfer fails
                escrow.state = EscrowState.Active;
                success[i] = false;
                continue;
            }
            
            success[i] = true;
            emit EscrowReleased(escrowIds[i], msg.sender, escrow.amount);
        }
    }
    
    /**
     * @dev Flag dispute (either party)
     * @param escrowId ID of the escrow
     */
    function dispute(uint256 escrowId) external {
        Escrow storage escrow = escrows[escrowId];
        if (msg.sender != escrow.sender && msg.sender != escrow.receiver) revert Unauthorized();
        if (escrow.state != EscrowState.Active) revert InvalidState();
        
        escrow.state = EscrowState.Disputed;
        emit EscrowDisputed(escrowId, msg.sender);
    }
    
    /**
     * @dev Resolve dispute (arbitrator only)
     * @param escrowId ID of the escrow
     * @param refund True = refund sender, False = pay receiver
     */
    function resolveDispute(uint256 escrowId, bool refund) external nonReentrant {
        if (msg.sender != arbitrator) revert Unauthorized();
        Escrow storage escrow = escrows[escrowId];
        if (escrow.state != EscrowState.Disputed) revert InvalidState();
        
        address recipient = refund ? escrow.sender : escrow.receiver;
        escrow.state = refund ? EscrowState.Refunded : EscrowState.Released;
        
        if (!usdc.transfer(recipient, escrow.amount)) revert TransferFailed();
        
        emit DisputeResolved(escrowId, msg.sender, refund);
    }
    
    /**
     * @dev Change arbitrator (current arbitrator only)
     * @param newArbitrator Address of new arbitrator
     */
    function setArbitrator(address newArbitrator) external {
        if (msg.sender != arbitrator) revert Unauthorized();
        if (newArbitrator == address(0)) revert InvalidReceiver();
        
        address oldArbitrator = arbitrator;
        arbitrator = newArbitrator;
        
        emit ArbitratorChanged(oldArbitrator, newArbitrator);
    }
    
    /**
     * @dev Get escrow details (gas optimized view)
     */
    function getEscrow(uint256 escrowId) external view returns (
        address sender,
        address receiver,
        uint256 amount,
        uint256 createdAt,
        uint256 deadline,
        EscrowState state
    ) {
        Escrow memory escrow = escrows[escrowId];
        return (
            escrow.sender,
            escrow.receiver,
            escrow.amount,
            escrow.createdAt,
            escrow.deadline,
            escrow.state
        );
    }
    
    /**
     * @dev Check if escrow is ready for auto-release
     * @param escrowId ID of the escrow
     * @return ready True if auto-release can be called
     */
    function canAutoRelease(uint256 escrowId) external view returns (bool ready) {
        Escrow memory escrow = escrows[escrowId];
        return escrow.state == EscrowState.Active && 
               block.timestamp >= escrow.deadline + INSPECTION_PERIOD;
    }
    
    /**
     * @dev Get multiple escrows (batch view for agents)
     * @param escrowIds Array of escrow IDs
     * @return states Array of escrow states
     * @return amounts Array of escrow amounts
     */
    function getEscrowBatch(uint256[] calldata escrowIds) 
        external 
        view 
        returns (
            EscrowState[] memory states,
            uint256[] memory amounts
        ) 
    {
        uint256 length = escrowIds.length;
        states = new EscrowState[](length);
        amounts = new uint256[](length);
        
        for (uint256 i = 0; i < length; i++) {
            Escrow memory escrow = escrows[escrowIds[i]];
            states[i] = escrow.state;
            amounts[i] = escrow.amount;
        }
    }
}
