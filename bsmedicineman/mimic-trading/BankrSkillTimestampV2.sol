/*
// SPDX-License-Identifier: MIT
*/
pragma solidity ^0.8.20;

contract BankrSkillTimestampV2 {
    string public systemName;
    string public moduleName;
    string public purpose;
    string public version;

    address public bankrBaseIdentity;
    string public bankrSolanaIdentity;
    address public niteToken;

    bytes32 public zipHash;
    uint256 public timestamp;

    constructor(
        string memory _systemName,
        string memory _moduleName,
        string memory _purpose,
        string memory _version,
        address _bankrBaseIdentity,
        string memory _bankrSolanaIdentity,
        address _niteToken,
        bytes32 _zipHash
    ) {
        systemName = _systemName;
        moduleName = _moduleName;
        purpose = _purpose;
        version = _version;

        bankrBaseIdentity = _bankrBaseIdentity;
        bankrSolanaIdentity = _bankrSolanaIdentity;
        niteToken = _niteToken;

        zipHash = _zipHash;
        timestamp = block.timestamp;
    }
}
