"""
Mode Enforcer
Enforces permission levels based on current mode.
Modes: lurk (read-only) < engage (bumps + approved writes) < active (replies + approved threads) < yolo (full autonomous)
"""
from dataclasses import dataclass
from enum import Enum, auto
from typing import Set


class Action(Enum):
    """Actions that can be performed on 4claw."""
    # Read actions
    READ_BOARDS = auto()
    READ_THREADS = auto()
    READ_THREAD = auto()
    SEARCH = auto()
    
    # Write actions (low impact)
    BUMP = auto()
    
    # Write actions (high impact)
    REPLY = auto()
    CREATE_THREAD = auto()
    
    # Account actions
    CLAIM = auto()


@dataclass
class PermissionResult:
    """Result of a permission check."""
    allowed: bool
    requires_approval: bool = False
    reason: str = ""


# Actions that are always read-only
READ_ACTIONS: Set[Action] = {
    Action.READ_BOARDS,
    Action.READ_THREADS,
    Action.READ_THREAD,
    Action.SEARCH,
}

# Actions that require minimal engagement
LOW_IMPACT_WRITES: Set[Action] = {
    Action.BUMP,
}

# Actions that ALWAYS require human approval regardless of mode
ALWAYS_REQUIRE_APPROVAL: Set[Action] = {
    Action.CREATE_THREAD,
}


class ModeEnforcer:
    """Enforces permission levels based on current mode."""
    
    def __init__(self, mode: str = "lurk"):
        """
        Initialize enforcer with a mode.
        
        Args:
            mode: Permission mode (lurk|engage|active)
        """
        if mode not in ("lurk", "engage", "active", "yolo"):
            raise ValueError(f"Invalid mode: {mode}. Must be lurk|engage|active|yolo")
        self.mode = mode
    
    def check(self, action: Action) -> PermissionResult:
        """
        Check if an action is allowed in the current mode.
        
        Args:
            action: The action to check
            
        Returns:
            PermissionResult with allowed, requires_approval, reason
        """
        # Read actions always allowed
        if action in READ_ACTIONS:
            return PermissionResult(
                allowed=True,
                requires_approval=False,
                reason="Read actions are always allowed"
            )
        
        # Claim always allowed (account setup)
        if action == Action.CLAIM:
            return PermissionResult(
                allowed=True,
                requires_approval=False,
                reason="Account claim is always allowed"
            )
        
        # Lurk mode: block all writes
        if self.mode == "lurk":
            return PermissionResult(
                allowed=False,
                requires_approval=False,
                reason=f"Mode 'lurk' does not allow {action.name}"
            )
        
        # Engage mode
        if self.mode == "engage":
            # Bumps allowed without approval
            if action in LOW_IMPACT_WRITES:
                return PermissionResult(
                    allowed=True,
                    requires_approval=False,
                    reason="Low-impact actions allowed in engage mode"
                )
            
            # Replies and threads require approval
            if action in (Action.REPLY, Action.CREATE_THREAD):
                return PermissionResult(
                    allowed=True,
                    requires_approval=True,
                    reason=f"{action.name} requires human approval in engage mode"
                )
            
            return PermissionResult(
                allowed=True,
                requires_approval=True,
                reason=f"{action.name} requires human approval"
            )
        
        # Active mode
        if self.mode == "active":
            # Bumps allowed
            if action in LOW_IMPACT_WRITES:
                return PermissionResult(
                    allowed=True,
                    requires_approval=False,
                    reason="Low-impact actions allowed in active mode"
                )
            
            # Replies allowed without approval
            if action == Action.REPLY:
                return PermissionResult(
                    allowed=True,
                    requires_approval=False,
                    reason="Replies allowed in active mode"
                )
            
            # Threads ALWAYS require approval
            if action == Action.CREATE_THREAD:
                return PermissionResult(
                    allowed=True,
                    requires_approval=True,
                    reason="Creating threads always requires human approval"
                )
            
            return PermissionResult(
                allowed=True,
                requires_approval=False,
                reason="Action allowed in active mode"
            )
        
        # Yolo mode - full autonomous
        if self.mode == "yolo":
            # Everything allowed without approval
            return PermissionResult(
                allowed=True,
                requires_approval=False,
                reason="Yolo mode - full autonomous"
            )
        
        # Fallback: deny
        return PermissionResult(
            allowed=False,
            requires_approval=False,
            reason="Unknown action or mode"
        )
    
    def can_do(self, action: Action, has_approval: bool = False) -> bool:
        """
        Quick check if action can be performed.
        
        Args:
            action: The action to check
            has_approval: Whether human approval has been given
            
        Returns:
            True if action can be performed
        """
        result = self.check(action)
        if not result.allowed:
            return False
        if result.requires_approval and not has_approval:
            return False
        return True
