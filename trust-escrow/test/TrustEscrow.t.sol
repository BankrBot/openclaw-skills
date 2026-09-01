// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/TrustEscrow.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor() ERC20("Mock Token", "MOCK") {
        _mint(msg.sender, 1000000 * 10**18);
    }
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockFeeOnTransferToken is ERC20 {
    uint256 public feePercentage = 10; // 10% fee on transfer
    
    constructor() ERC20("Fee Token", "FEE") {
        _mint(msg.sender, 1000000 * 10**18);
    }
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
    
    function transfer(address to, uint256 amount) public override returns (bool) {
        uint256 fee = (amount * feePercentage) / 100;
        uint256 amountAfterFee = amount - fee;
        
        _transfer(_msgSender(), to, amountAfterFee);
        if (fee > 0) {
            _transfer(_msgSender(), address(0xdead), fee); // Burn fee
        }
        
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        address spender = _msgSender();
        _spendAllowance(from, spender, amount);
        
        uint256 fee = (amount * feePercentage) / 100;
        uint256 amountAfterFee = amount - fee;
        
        _transfer(from, to, amountAfterFee);
        if (fee > 0) {
            _transfer(from, address(0xdead), fee); // Burn fee
        }
        
        return true;
    }
}

contract TrustEscrowTest is Test {
    TrustEscrow public escrow;
    MockERC20 public token;
    
    address public feeRecipient = address(0x1);
    address public arbitrator = address(0x2);
    address public payer = address(0x3);
    address public payee = address(0x4);
    
    uint256 public constant AMOUNT = 1 ether;
    uint256 public constant DEADLINE = 7 days;
    string public constant SERVICE_DESC = "Test service";
    
    event EscrowCreated(uint256 indexed id, address indexed payer, address indexed payee, uint256 amount);
    event ServiceDelivered(uint256 indexed id);
    event EscrowCompleted(uint256 indexed id);
    event EscrowDisputed(uint256 indexed id, address disputer);
    event EscrowCancelled(uint256 indexed id);
    event DisputeResolved(uint256 indexed id, address indexed resolver, bool refunded);
    event ArbitratorChanged(address indexed oldArbitrator, address indexed newArbitrator);
    
    function setUp() public {
        escrow = new TrustEscrow(feeRecipient, arbitrator);
        token = new MockERC20();
        
        // Fund test accounts
        vm.deal(payer, 100 ether);
        vm.deal(payee, 1 ether);
        token.mint(payer, 100 * 10**18);
    }
    
    // ============ CREATE ESCROW (ETH) TESTS ============
    
    function testCreateEscrow() public {
        vm.startPrank(payer);
        
        vm.expectEmit(true, true, true, true);
        emit EscrowCreated(0, payer, payee, AMOUNT);
        
        uint256 id = escrow.createEscrow{value: AMOUNT}(
            payee,
            block.timestamp + DEADLINE,
            SERVICE_DESC
        );
        
        assertEq(id, 0);
        
        TrustEscrow.Escrow memory e = escrow.getEscrow(id);
        assertEq(e.payer, payer);
        assertEq(e.payee, payee);
        assertEq(e.amount, AMOUNT);
        assertEq(e.token, address(0));
        assertEq(uint256(e.status), uint256(TrustEscrow.EscrowStatus.Active));
        assertEq(e.serviceDescription, SERVICE_DESC);
        assertFalse(e.payeeDelivered);
        
        vm.stopPrank();
    }
    
    function testCreateEscrowRevertsIfZeroAmount() public {
        vm.startPrank(payer);
        vm.expectRevert("Amount must be > 0");
        escrow.createEscrow{value: 0}(payee, block.timestamp + DEADLINE, SERVICE_DESC);
        vm.stopPrank();
    }
    
    function testCreateEscrowRevertsIfInvalidPayee() public {
        vm.startPrank(payer);
        
        vm.expectRevert("Invalid payee");
        escrow.createEscrow{value: AMOUNT}(address(0), block.timestamp + DEADLINE, SERVICE_DESC);
        
        vm.expectRevert("Invalid payee");
        escrow.createEscrow{value: AMOUNT}(payer, block.timestamp + DEADLINE, SERVICE_DESC);
        
        vm.stopPrank();
    }
    
    function testCreateEscrowRevertsIfDeadlineInPast() public {
        vm.startPrank(payer);
        vm.expectRevert("Deadline must be in future");
        escrow.createEscrow{value: AMOUNT}(payee, block.timestamp - 1, SERVICE_DESC);
        vm.stopPrank();
    }
    
    // ============ CREATE ESCROW (ERC-20) TESTS ============
    
    function testCreateEscrowToken() public {
        vm.startPrank(payer);
        token.approve(address(escrow), AMOUNT);
        
        vm.expectEmit(true, true, true, true);
        emit EscrowCreated(0, payer, payee, AMOUNT);
        
        uint256 id = escrow.createEscrowToken(
            payee,
            AMOUNT,
            address(token),
            block.timestamp + DEADLINE,
            SERVICE_DESC
        );
        
        assertEq(id, 0);
        
        TrustEscrow.Escrow memory e = escrow.getEscrow(id);
        assertEq(e.token, address(token));
        assertEq(e.amount, AMOUNT);
        
        vm.stopPrank();
    }
    
    function testCreateEscrowTokenRevertsIfZeroAmount() public {
        vm.startPrank(payer);
        token.approve(address(escrow), AMOUNT);
        vm.expectRevert("Amount must be > 0");
        escrow.createEscrowToken(payee, 0, address(token), block.timestamp + DEADLINE, SERVICE_DESC);
        vm.stopPrank();
    }
    
    function testCreateEscrowTokenRevertsIfInvalidToken() public {
        vm.startPrank(payer);
        vm.expectRevert("Invalid token");
        escrow.createEscrowToken(payee, AMOUNT, address(0), block.timestamp + DEADLINE, SERVICE_DESC);
        vm.stopPrank();
    }
    
    function testCreateEscrowTokenRevertsIfInvalidPayee() public {
        vm.startPrank(payer);
        token.approve(address(escrow), AMOUNT);
        
        vm.expectRevert("Invalid payee");
        escrow.createEscrowToken(address(0), AMOUNT, address(token), block.timestamp + DEADLINE, SERVICE_DESC);
        
        vm.expectRevert("Invalid payee");
        escrow.createEscrowToken(payer, AMOUNT, address(token), block.timestamp + DEADLINE, SERVICE_DESC);
        
        vm.stopPrank();
    }
    
    function testCreateEscrowTokenRevertsIfDeadlineInPast() public {
        vm.startPrank(payer);
        token.approve(address(escrow), AMOUNT);
        vm.expectRevert("Deadline must be in future");
        escrow.createEscrowToken(payee, AMOUNT, address(token), block.timestamp - 1, SERVICE_DESC);
        vm.stopPrank();
    }
    
    // ============ DELIVER SERVICE TESTS ============
    
    function testDeliverService() public {
        uint256 id = _createEscrow();
        
        vm.startPrank(payee);
        vm.expectEmit(true, false, false, false);
        emit ServiceDelivered(id);
        escrow.deliverService(id);
        vm.stopPrank();
        
        TrustEscrow.Escrow memory e = escrow.getEscrow(id);
        assertTrue(e.payeeDelivered);
    }
    
    function testDeliverServiceRevertsIfNotPayee() public {
        uint256 id = _createEscrow();
        
        vm.startPrank(payer);
        vm.expectRevert("Only payee can deliver");
        escrow.deliverService(id);
        vm.stopPrank();
    }
    
    function testDeliverServiceRevertsIfNotActive() public {
        uint256 id = _createEscrow();
        
        vm.prank(payee);
        escrow.deliverService(id);
        
        vm.prank(payer);
        escrow.completeEscrow(id);
        
        vm.prank(payee);
        vm.expectRevert("Escrow not active");
        escrow.deliverService(id);
    }
    
    function testDeliverServiceRevertsIfAlreadyDelivered() public {
        uint256 id = _createEscrow();
        
        vm.startPrank(payee);
        escrow.deliverService(id);
        
        vm.expectRevert("Already marked delivered");
        escrow.deliverService(id);
        vm.stopPrank();
    }
    
    // ============ COMPLETE ESCROW TESTS ============
    
    function testCompleteEscrow() public {
        uint256 id = _createEscrow();
        
        vm.prank(payee);
        escrow.deliverService(id);
        
        uint256 payeeBefore = payee.balance;
        uint256 fee = (AMOUNT * escrow.platformFeeBps()) / 10000;
        uint256 expectedPayment = AMOUNT - fee;
        
        vm.prank(payer);
        vm.expectEmit(true, false, false, false);
        emit EscrowCompleted(id);
        escrow.completeEscrow(id);
        
        assertEq(payee.balance, payeeBefore + expectedPayment);
        assertEq(escrow.accumulatedFees(), fee);
        
        TrustEscrow.Escrow memory e = escrow.getEscrow(id);
        assertEq(uint256(e.status), uint256(TrustEscrow.EscrowStatus.Completed));
    }
    
    function testCompleteEscrowWithToken() public {
        vm.startPrank(payer);
        token.approve(address(escrow), AMOUNT);
        uint256 id = escrow.createEscrowToken(payee, AMOUNT, address(token), block.timestamp + DEADLINE, SERVICE_DESC);
        vm.stopPrank();
        
        vm.prank(payee);
        escrow.deliverService(id);
        
        uint256 payeeBefore = token.balanceOf(payee);
        uint256 feeRecipientBefore = token.balanceOf(feeRecipient);
        uint256 fee = (AMOUNT * escrow.platformFeeBps()) / 10000;
        uint256 expectedPayment = AMOUNT - fee;
        
        vm.prank(payer);
        escrow.completeEscrow(id);
        
        assertEq(token.balanceOf(payee), payeeBefore + expectedPayment);
        assertEq(token.balanceOf(feeRecipient), feeRecipientBefore + fee);
    }
    
    function testCompleteEscrowRevertsIfNotPayer() public {
        uint256 id = _createEscrow();
        
        vm.prank(payee);
        escrow.deliverService(id);
        
        vm.prank(payee);
        vm.expectRevert("Only payer can complete");
        escrow.completeEscrow(id);
    }
    
    function testCompleteEscrowRevertsIfNotActive() public {
        uint256 id = _createEscrow();
        
        vm.prank(payer);
        escrow.cancelEscrow(id);
        
        vm.prank(payer);
        vm.expectRevert("Escrow not active");
        escrow.completeEscrow(id);
    }
    
    function testCompleteEscrowRevertsIfNotDelivered() public {
        uint256 id = _createEscrow();
        
        vm.prank(payer);
        vm.expectRevert("Service not delivered yet");
        escrow.completeEscrow(id);
    }
    
    // ============ CANCEL ESCROW TESTS ============
    
    function testCancelEscrow() public {
        uint256 id = _createEscrow();
        
        uint256 payerBefore = payer.balance;
        
        vm.prank(payer);
        vm.expectEmit(true, false, false, false);
        emit EscrowCancelled(id);
        escrow.cancelEscrow(id);
        
        assertEq(payer.balance, payerBefore + AMOUNT);
        
        TrustEscrow.Escrow memory e = escrow.getEscrow(id);
        assertEq(uint256(e.status), uint256(TrustEscrow.EscrowStatus.Cancelled));
    }
    
    function testCancelEscrowWithToken() public {
        vm.startPrank(payer);
        token.approve(address(escrow), AMOUNT);
        uint256 id = escrow.createEscrowToken(payee, AMOUNT, address(token), block.timestamp + DEADLINE, SERVICE_DESC);
        
        uint256 payerBefore = token.balanceOf(payer);
        escrow.cancelEscrow(id);
        
        assertEq(token.balanceOf(payer), payerBefore + AMOUNT);
        vm.stopPrank();
    }
    
    function testCancelEscrowRevertsIfNotPayer() public {
        uint256 id = _createEscrow();
        
        vm.prank(payee);
        vm.expectRevert("Only payer can cancel");
        escrow.cancelEscrow(id);
    }
    
    function testCancelEscrowRevertsIfNotActive() public {
        uint256 id = _createEscrow();
        
        vm.prank(payer);
        escrow.cancelEscrow(id);
        
        vm.prank(payer);
        vm.expectRevert("Escrow not active");
        escrow.cancelEscrow(id);
    }
    
    function testCancelEscrowRevertsIfAlreadyDelivered() public {
        uint256 id = _createEscrow();
        
        vm.prank(payee);
        escrow.deliverService(id);
        
        vm.prank(payer);
        vm.expectRevert("Cannot cancel after delivery");
        escrow.cancelEscrow(id);
    }
    
    // ============ RELEASE AFTER DEADLINE TESTS ============
    
    function testReleaseAfterDeadline() public {
        uint256 id = _createEscrow();
        
        vm.prank(payee);
        escrow.deliverService(id);
        
        vm.warp(block.timestamp + DEADLINE + 1);
        
        uint256 payeeBefore = payee.balance;
        uint256 fee = (AMOUNT * escrow.platformFeeBps()) / 10000;
        uint256 expectedPayment = AMOUNT - fee;
        
        escrow.releaseAfterDeadline(id);
        
        assertEq(payee.balance, payeeBefore + expectedPayment);
        assertEq(escrow.accumulatedFees(), fee);
    }
    
    function testReleaseAfterDeadlineRevertsIfNotActive() public {
        uint256 id = _createEscrow();
        
        vm.prank(payer);
        escrow.cancelEscrow(id);
        
        vm.warp(block.timestamp + DEADLINE + 1);
        vm.expectRevert("Escrow not active");
        escrow.releaseAfterDeadline(id);
    }
    
    function testReleaseAfterDeadlineRevertsIfNotDelivered() public {
        uint256 id = _createEscrow();
        
        vm.warp(block.timestamp + DEADLINE + 1);
        vm.expectRevert("Service not delivered");
        escrow.releaseAfterDeadline(id);
    }
    
    function testReleaseAfterDeadlineRevertsIfDeadlineNotReached() public {
        uint256 id = _createEscrow();
        
        vm.prank(payee);
        escrow.deliverService(id);
        
        vm.expectRevert("Deadline not reached");
        escrow.releaseAfterDeadline(id);
    }
    
    // ============ DISPUTE TESTS ============
    
    function testDisputeByPayer() public {
        uint256 id = _createEscrow();
        
        vm.prank(payer);
        vm.expectEmit(true, false, false, true);
        emit EscrowDisputed(id, payer);
        escrow.dispute(id);
        
        TrustEscrow.Escrow memory e = escrow.getEscrow(id);
        assertEq(uint256(e.status), uint256(TrustEscrow.EscrowStatus.Disputed));
    }
    
    function testDisputeByPayee() public {
        uint256 id = _createEscrow();
        
        vm.prank(payee);
        vm.expectEmit(true, false, false, true);
        emit EscrowDisputed(id, payee);
        escrow.dispute(id);
        
        TrustEscrow.Escrow memory e = escrow.getEscrow(id);
        assertEq(uint256(e.status), uint256(TrustEscrow.EscrowStatus.Disputed));
    }
    
    function testDisputeRevertsIfNotActive() public {
        uint256 id = _createEscrow();
        
        vm.prank(payer);
        escrow.cancelEscrow(id);
        
        vm.prank(payer);
        vm.expectRevert("Escrow not active");
        escrow.dispute(id);
    }
    
    function testDisputeRevertsIfUnauthorized() public {
        uint256 id = _createEscrow();
        
        vm.prank(address(0x999));
        vm.expectRevert("Not authorized");
        escrow.dispute(id);
    }
    
    // ============ RESOLVE DISPUTE TESTS ============
    
    function testResolveDisputeRefund() public {
        uint256 id = _createEscrow();
        
        vm.prank(payer);
        escrow.dispute(id);
        
        uint256 payerBefore = payer.balance;
        
        vm.prank(arbitrator);
        vm.expectEmit(true, true, false, true);
        emit DisputeResolved(id, arbitrator, true);
        escrow.resolveDispute(id, true);
        
        assertEq(payer.balance, payerBefore + AMOUNT);
        
        TrustEscrow.Escrow memory e = escrow.getEscrow(id);
        assertEq(uint256(e.status), uint256(TrustEscrow.EscrowStatus.Cancelled));
    }
    
    function testResolveDisputePayPayee() public {
        uint256 id = _createEscrow();
        
        vm.prank(payer);
        escrow.dispute(id);
        
        uint256 payeeBefore = payee.balance;
        
        vm.prank(arbitrator);
        vm.expectEmit(true, true, false, true);
        emit DisputeResolved(id, arbitrator, false);
        escrow.resolveDispute(id, false);
        
        assertEq(payee.balance, payeeBefore + AMOUNT); // Full amount, no fee on dispute
        
        TrustEscrow.Escrow memory e = escrow.getEscrow(id);
        assertEq(uint256(e.status), uint256(TrustEscrow.EscrowStatus.Completed));
    }
    
    function testResolveDisputeRevertsIfNotArbitrator() public {
        uint256 id = _createEscrow();
        
        vm.prank(payer);
        escrow.dispute(id);
        
        vm.prank(payer);
        vm.expectRevert("Only arbitrator can resolve");
        escrow.resolveDispute(id, true);
    }
    
    function testResolveDisputeRevertsIfNotDisputed() public {
        uint256 id = _createEscrow();
        
        vm.prank(arbitrator);
        vm.expectRevert("Escrow not disputed");
        escrow.resolveDispute(id, true);
    }
    
    // ============ ARBITRATOR TESTS ============
    
    function testSetArbitrator() public {
        address newArbitrator = address(0x5);
        
        vm.prank(arbitrator);
        vm.expectEmit(true, true, false, false);
        emit ArbitratorChanged(arbitrator, newArbitrator);
        escrow.setArbitrator(newArbitrator);
        
        assertEq(escrow.arbitrator(), newArbitrator);
    }
    
    function testSetArbitratorRevertsIfNotCurrentArbitrator() public {
        vm.prank(payer);
        vm.expectRevert("Only arbitrator can change");
        escrow.setArbitrator(address(0x5));
    }
    
    function testSetArbitratorRevertsIfZeroAddress() public {
        vm.prank(arbitrator);
        vm.expectRevert("Invalid arbitrator");
        escrow.setArbitrator(address(0));
    }
    
    // ============ FEE WITHDRAWAL TESTS ============
    
    function testWithdrawFees() public {
        uint256 id = _createEscrow();
        
        vm.prank(payee);
        escrow.deliverService(id);
        
        vm.prank(payer);
        escrow.completeEscrow(id);
        
        uint256 fee = escrow.accumulatedFees();
        uint256 recipientBefore = feeRecipient.balance;
        
        vm.prank(feeRecipient);
        escrow.withdrawFees();
        
        assertEq(feeRecipient.balance, recipientBefore + fee);
        assertEq(escrow.accumulatedFees(), 0);
    }
    
    function testWithdrawFeesRevertsIfNotRecipient() public {
        vm.prank(payer);
        vm.expectRevert("Not authorized");
        escrow.withdrawFees();
    }
    
    // ============ FEE-ON-TRANSFER TOKEN TESTS ============
    
    function testFeeOnTransferTokenSupport() public {
        MockFeeOnTransferToken feeToken = new MockFeeOnTransferToken();
        feeToken.mint(payer, 100 * 10**18);
        
        uint256 requestedAmount = 10 * 10**18;
        uint256 expectedReceived = (requestedAmount * 90) / 100; // 10% fee
        
        vm.startPrank(payer);
        feeToken.approve(address(escrow), requestedAmount);
        
        uint256 id = escrow.createEscrowToken(
            payee,
            requestedAmount,
            address(feeToken),
            block.timestamp + DEADLINE,
            SERVICE_DESC
        );
        vm.stopPrank();
        
        // Verify escrow stored actual received amount, not requested amount
        TrustEscrow.Escrow memory e = escrow.getEscrow(id);
        assertEq(e.amount, expectedReceived);
        assertEq(e.token, address(feeToken));
        
        // Verify full flow works with fee-on-transfer token
        vm.prank(payee);
        escrow.deliverService(id);
        
        uint256 payeeBefore = feeToken.balanceOf(payee);
        uint256 feeRecipientBefore = feeToken.balanceOf(feeRecipient);
        
        vm.prank(payer);
        escrow.completeEscrow(id);
        
        uint256 platformFee = (expectedReceived * escrow.platformFeeBps()) / 10000;
        uint256 payeeExpected = expectedReceived - platformFee;
        
        // Note: fee-on-transfer happens on these transfers too
        uint256 payeeActualFee = (payeeExpected * 10) / 100;
        uint256 platformActualFee = (platformFee * 10) / 100;
        
        assertEq(feeToken.balanceOf(payee), payeeBefore + payeeExpected - payeeActualFee);
        assertEq(feeToken.balanceOf(feeRecipient), feeRecipientBefore + platformFee - platformActualFee);
    }
    
    // ============ HELPER FUNCTIONS ============
    
    function _createEscrow() internal returns (uint256) {
        vm.prank(payer);
        return escrow.createEscrow{value: AMOUNT}(
            payee,
            block.timestamp + DEADLINE,
            SERVICE_DESC
        );
    }
}
