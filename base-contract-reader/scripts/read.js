#!/usr/bin/env node

const { ethers } = require('ethers');
const axios = require('axios');
const { ERC20_ABI, ERC721_ABI, OWNABLE_ABI } = require('./abis.js');

// Configuration
const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://base.llamarpc.com';
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY || '';

// Initialize provider with retry config
const provider = new ethers.JsonRpcProvider(BASE_RPC_URL, undefined, {
  staticNetwork: true
});

/**
 * Check if contract exists at address
 */
async function contractExists(address) {
  try {
    const code = await provider.getCode(address);
    return code !== '0x';
  } catch (error) {
    throw new Error(`Failed to check contract existence: ${error.message}`);
  }
}

/**
 * Fetch contract ABI from Basescan with fallback to standard ABIs
 */
async function fetchABI(contractAddress) {
  // Try Basescan first if API key is provided
  if (BASESCAN_API_KEY) {
    const url = `https://api.basescan.org/v2/api?chainid=8453&module=contract&action=getabi&address=${contractAddress}&apikey=${BASESCAN_API_KEY}`;
    
    try {
      const response = await axios.get(url, { timeout: 10000 });
      if (response.data.status === '1') {
        // Safely parse JSON
        try {
          const abi = JSON.parse(response.data.result);
          if (!Array.isArray(abi) || abi.length === 0) {
            throw new Error('Invalid ABI format from Basescan');
          }
          return abi;
        } catch (parseError) {
          console.error(`Failed to parse Basescan ABI: ${parseError.message}`);
        }
      }
    } catch (error) {
      console.error(`Basescan API failed, using fallback ABIs: ${error.message}`);
    }
  }
  
  // Fallback: Try to detect contract type using bytecode patterns
  console.error('Using standard ERC20/ERC721 ABI as fallback...');
  
  // First check if contract even exists
  const exists = await contractExists(contractAddress);
  if (!exists) {
    throw new Error('No contract found at this address');
  }
  
  // Try ERC20 first (most common) - just return the ABI, don't test call
  // We'll let the actual query fail gracefully if it's not the right type
  return ERC20_ABI;
}

/**
 * Sanitize and convert argument based on type
 */
function sanitizeArg(arg, type) {
  if (!type) return arg;
  
  const lowerType = type.toLowerCase();
  
  // Handle uint/int types - convert to BigInt
  if (lowerType.startsWith('uint') || lowerType.startsWith('int')) {
    try {
      return BigInt(arg);
    } catch (error) {
      throw new Error(`Invalid number format for ${type}: ${arg}`);
    }
  }
  
  // Handle address type - validate and checksum
  if (lowerType === 'address') {
    if (!ethers.isAddress(arg)) {
      throw new Error(`Invalid address: ${arg}`);
    }
    return ethers.getAddress(arg); // Returns checksummed address
  }
  
  // Handle bool type
  if (lowerType === 'bool') {
    if (typeof arg === 'boolean') return arg;
    const lower = String(arg).toLowerCase();
    if (lower === 'true' || lower === '1') return true;
    if (lower === 'false' || lower === '0') return false;
    throw new Error(`Invalid boolean value: ${arg}`);
  }
  
  // String and bytes types - return as-is
  return arg;
}

/**
 * Match natural language query to contract function
 */
function matchFunction(abi, query) {
  // Validate ABI
  if (!Array.isArray(abi) || abi.length === 0) {
    throw new Error('Invalid or empty ABI');
  }
  
  const lowerQuery = query.toLowerCase().trim();
  
  // Extract potential function name and arguments
  let functionName = null;
  let args = [];
  
  // Common patterns
  const patterns = [
    // "balance of 0x..."
    { regex: /balance\s+of\s+(0x[a-fA-F0-9]{40})/i, func: 'balanceOf', extractArgs: (m) => [m[1]] },
    
    // "total supply"
    { regex: /total\s*supply/i, func: 'totalSupply', extractArgs: () => [] },
    
    // "name"
    { regex: /^name$/i, func: 'name', extractArgs: () => [] },
    
    // "symbol"
    { regex: /^symbol$/i, func: 'symbol', extractArgs: () => [] },
    
    // "decimals"
    { regex: /^decimals$/i, func: 'decimals', extractArgs: () => [] },
    
    // "owner"
    { regex: /^owner$/i, func: 'owner', extractArgs: () => [] },
    
    // "owner of token 5" or "owner of 5"
    { regex: /owner\s+of\s+(?:token\s+)?(\d+)/i, func: 'ownerOf', extractArgs: (m) => [m[1]] },
    
    // "token URI 5" or "tokenURI 5"
    { regex: /token\s*uri\s+(\d+)/i, func: 'tokenURI', extractArgs: (m) => [m[1]] },
    
    // "is paused" → isPaused()
    { regex: /^is\s+(\w+)/i, func: null, extractArgs: (m) => { functionName = `is${capitalize(m[1])}`; return []; } },
    
    // "get X" → getX()
    { regex: /^get\s+(\w+)/i, func: null, extractArgs: (m) => { functionName = `get${capitalize(m[1])}`; return []; } },
  ];
  
  // Try pattern matching
  for (const pattern of patterns) {
    const match = lowerQuery.match(pattern.regex);
    if (match) {
      functionName = pattern.func || functionName;
      args = pattern.extractArgs(match);
      break;
    }
  }
  
  // If no pattern matched, try direct function name
  if (!functionName) {
    functionName = lowerQuery.replace(/\s+/g, '');
  }
  
  // Handle both JSON ABI and human-readable ABI formats
  let matchingFunction;
  
  if (typeof abi[0] === 'string') {
    // Human-readable ABI (array of strings)
    const functionSignature = abi.find(sig => {
      const match = sig.match(/function\s+(\w+)/);
      return match && match[1].toLowerCase() === functionName.toLowerCase();
    });
    
    if (!functionSignature) {
      throw new Error(`Function "${functionName}" not found in contract ABI`);
    }
    
    // Parse the signature more carefully
    const match = functionSignature.match(/function\s+(\w+)\((.*?)\)/);
    if (!match) {
      throw new Error(`Invalid function signature: ${functionSignature}`);
    }
    
    const paramString = match[2].trim();
    const inputs = paramString ? paramString.split(',').map((param, i) => {
      const trimmed = param.trim();
      // Handle both "uint256" and "uint256 name" formats
      const parts = trimmed.split(/\s+/);
      return {
        type: parts[0],
        name: parts[1] || `arg${i}`
      };
    }) : [];
    
    matchingFunction = {
      name: match[1],
      inputs: inputs,
      outputs: [{ type: 'auto' }] // Will be inferred from result
    };
  } else {
    // JSON ABI format
    matchingFunction = abi.find(item => 
      item.type === 'function' && 
      (item.stateMutability === 'view' || item.stateMutability === 'pure') &&
      item.name.toLowerCase() === functionName.toLowerCase()
    );
    
    if (!matchingFunction) {
      throw new Error(`Function "${functionName}" not found in contract ABI`);
    }
  }
  
  // Validate argument count
  if (matchingFunction.inputs && args.length !== matchingFunction.inputs.length) {
    throw new Error(`Function "${matchingFunction.name}" expects ${matchingFunction.inputs.length} arguments, got ${args.length}`);
  }
  
  // Sanitize arguments based on their types
  const sanitizedArgs = args.map((arg, i) => {
    const inputType = matchingFunction.inputs[i]?.type;
    return sanitizeArg(arg, inputType);
  });
  
  return { function: matchingFunction, args: sanitizedArgs };
}

/**
 * Format contract result for human readability
 */
function formatResult(functionABI, result, contractAddress) {
  // Handle case where function has no outputs
  if (!functionABI.outputs || functionABI.outputs.length === 0) {
    return String(result);
  }
  
  const outputType = functionABI.outputs[0].type;
  
  // Handle different output types
  if (outputType === 'uint256' || outputType === 'uint' || outputType === 'uint8') {
    // Check if this is a token amount (try to get decimals)
    if (functionABI.name === 'totalSupply' || functionABI.name === 'balanceOf') {
      // Format as token amount (will need decimals, default to 18)
      const decimals = 18; // TODO: fetch decimals from contract if available
      const formatted = ethers.formatUnits(result, decimals);
      return `${parseFloat(formatted).toLocaleString()} tokens`;
    }
    return result.toString();
  }
  
  if (outputType === 'address') {
    return result;
  }
  
  if (outputType === 'string') {
    return result;
  }
  
  if (outputType === 'bool') {
    return result ? 'true' : 'false';
  }
  
  // Default: return as-is
  return result.toString();
}

/**
 * Capitalize first letter
 */
function capitalize(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Call contract function with retry logic
 */
async function callContract(contract, functionName, args, maxRetries = 2) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await contract[functionName](...args);
      return result;
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        console.error(`Retry ${i + 1}/${maxRetries - 1} after error...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  throw lastError;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: read.js <contract_address> "<query>"');
    console.error('Example: read.js 0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb "total supply"');
    process.exit(1);
  }
  
  const contractAddress = args[0];
  const query = args[1];
  
  // Validate address
  if (!ethers.isAddress(contractAddress)) {
    console.error(`Invalid contract address: ${contractAddress}`);
    process.exit(1);
  }
  
  try {
    // Step 1: Fetch ABI
    console.error(`Fetching ABI for ${contractAddress}...`);
    const abi = await fetchABI(contractAddress);
    
    // Step 2: Match query to function
    console.error(`Matching query: "${query}"`);
    const { function: matchedFunction, args: functionArgs } = matchFunction(abi, query);
    console.error(`Found function: ${matchedFunction.name}(${matchedFunction.inputs?.map(i => i.type).join(', ') || ''})`);
    
    // Step 3: Create contract instance
    const contract = new ethers.Contract(contractAddress, abi, provider);
    
    // Step 4: Call function with retry
    console.error(`Calling ${matchedFunction.name}...`);
    const result = await callContract(contract, matchedFunction.name, functionArgs);
    
    // Step 5: Format and output result
    const formatted = formatResult(matchedFunction, result, contractAddress);
    console.log(formatted);
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
    if (error.code) {
      console.error(`Error code: ${error.code}`);
    }
    if (error.data) {
      console.error(`Error data: ${error.data}`);
    }
    process.exit(1);
  }
}

main();
