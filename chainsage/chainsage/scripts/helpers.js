#!/usr/bin/env node

/**
 * ChainSage Analytics Helper
 * Utility functions for blockchain analytics and intelligence
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

class ChainSageHelper {
    constructor(configPath = null) {
        this.configPath = configPath || path.join(process.env.HOME, '.chainsage', 'config.json');
        this.config = this.loadConfig();
    }

    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const configData = fs.readFileSync(this.configPath, 'utf8');
                return JSON.parse(configData);
            }
        } catch (error) {
            console.warn('Warning: Could not load config file, using defaults');
        }
        
        return {
            api_keys: { alchemy: '', moralis: '' },
            default_chain: 'ethereum',
            cache_duration: 300,
            log_level: 'info'
        };
    }

    // Make HTTP request to blockchain APIs
    async makeRequest(url, headers = {}) {
        return new Promise((resolve, reject) => {
            const request = https.get(url, { headers }, (response) => {
                let data = '';
                
                response.on('data', (chunk) => {
                    data += chunk;
                });
                
                response.on('end', () => {
                    try {
                        const jsonData = JSON.parse(data);
                        resolve(jsonData);
                    } catch (error) {
                        reject(new Error(`Invalid JSON response: ${error.message}`));
                    }
                });
            });
            
            request.on('error', (error) => {
                reject(error);
            });
            
            request.setTimeout(10000, () => {
                request.destroy();
                reject(new Error('Request timeout'));
            });
        });
    }

    // Get correct API base URL for different chains
    getApiBaseUrl(chain) {
        const chainMap = {
            'ethereum': 'api.etherscan.io',
            'base': 'api.basescan.org',
            'polygon': 'api.polygonscan.com',
            'arbitrum': 'api.arbiscan.io',
            'solana': 'api.solscan.io' // Note: Solana uses different API format
        };
        return chainMap[chain] || 'api.etherscan.io';
    }

    // Get Solana-specific balance (different API format)
    async getSolanaBalance(address) {
        const apiKey = this.config.api_keys.explorer || process.env.EXPLORER_API_KEY;
        const url = `https://api.solscan.io/account?address=${address}${apiKey ? `&apiKey=${apiKey}` : ''}`;
        // Solana API response format is different
        try {
            const response = await this.makeRequest(url);
            const lamports = response.data?.lamports;
            if (typeof lamports !== 'number' || lamports < 0) {
                throw new Error('Invalid Solana balance response');
            }
            return {
                address,
                balance: lamports.toString(),
                balance_sol: (lamports / 1e9).toFixed(6),
                chain: 'solana'
            };
        } catch (error) {
            throw new Error(`Failed to get Solana balance: ${error.message}`);
        }
    }

    // Get wallet balance from blockchain explorer
    async getWalletBalance(address, chain = 'ethereum') {
        if (chain === 'solana') {
            return await this.getSolanaBalance(address);
        }
        
        const apiKey = this.config.api_keys.explorer || process.env.EXPLORER_API_KEY || process.env.ETHERSCAN_API_KEY || this.config.api_keys.alchemy;
        const baseUrl = this.getApiBaseUrl(chain);
        const url = `https://${baseUrl}/api?module=account&action=balance&address=${address}&tag=latest&apikey=${apiKey}`;
        
        try {
            const response = await this.makeRequest(url);
            if (response.status === '1') {
                return {
                    address,
                    balance: response.result,
                    balance_ether: (parseInt(response.result) / 1e18).toFixed(6),
                    chain
                };
            } else {
                throw new Error(`API Error: ${response.message}`);
            }
        } catch (error) {
            throw new Error(`Failed to get wallet balance: ${error.message}`);
        }
    }

    // Get transaction history with proper pagination
    async getTransactionHistory(address, chain = 'ethereum', limit = 10) {
        const apiKey = this.config.api_keys.explorer || process.env.EXPLORER_API_KEY || this.config.api_keys.alchemy || process.env.ETHERSCAN_API_KEY;
        const baseUrl = this.getApiBaseUrl(chain);
        const url = `https://${baseUrl}/api?module=account&action=txlist&address=${address}&sort=desc&page=1&offset=0&limit=${limit}&apikey=${apiKey}`;
        
        try {
            const response = await this.makeRequest(url);
            if (response.status === '1') {
                return {
                    address,
                    transactions: response.result || [],
                    count: (response.result || []).length,
                    chain
                };
            } else if (response.status === '0' && response.message === 'No transactions found') {
                // Valid response with no transactions
                return {
                    address,
                    transactions: [],
                    count: 0,
                    chain
                };
            } else {
                throw new Error(`API Error: ${response.message}`);
            }
        } catch (error) {
            throw new Error(`Failed to get transaction history: ${error.message}`);
        }
    }

    // Analyze wallet patterns
    analyzeWalletPatterns(transactions) {
        if (!transactions || transactions.length === 0) {
            return { patterns: [], risk_score: 'low', activity_level: 'inactive' };
        }

        const patterns = [];
        let gasSpent = 0n;
        let uniqueContracts = new Set();
        let defiInteractions = 0;

        transactions.forEach(tx => {
            gasSpent += BigInt(tx.gasUsed || '0') * BigInt(tx.gasPrice || '0');
            
            if (tx.to) {
                uniqueContracts.add(tx.to);
            }

            // Simple pattern detection (can be enhanced)
            if (tx.to && (tx.to.includes('0x') && tx.to.length === 42)) {
                // This is a simplified check - in reality, you'd use contract ABIs
                if (tx.input && tx.input.length > 10) {
                    defiInteractions++;
                }
            }
        });

        if (defiInteractions > transactions.length * 0.5) {
            patterns.push('defi_trader');
        }

        if (gasSpent > BigInt('1000000000000000')) { // > 0.001 ETH
            patterns.push('high_gas_spender');
        }

        const activityLevel = transactions.length > 100 ? 'high' : 
                             transactions.length > 10 ? 'medium' : 'low';

        const riskScore = patterns.includes('high_gas_spender') ? 'medium' : 'low';

        return {
            patterns,
            risk_score: riskScore,
            activity_level: activityLevel,
            total_gas_spent: gasSpent.toString(),
            unique_contracts: uniqueContracts.size
        };
    }

    // Format currency
    formatCurrency(amount, currency = 'ETH') {
        let formattedAmount;
        if (currency === 'SOL') {
            formattedAmount = (parseInt(amount) / 1e9).toFixed(6);
        } else {
            formattedAmount = (parseInt(amount) / 1e18).toFixed(6);
        }
        return `${formattedAmount} ${currency}`;
    }

    // Save analysis results
    saveAnalysis(address, analysis, filename = null) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const defaultFilename = `analysis_${address}_${timestamp}.json`;
        const finalFilename = filename || defaultFilename;
        
        const outputPath = path.join(process.env.HOME, '.chainsage', 'analyses');
        
        if (!fs.existsSync(outputPath)) {
            fs.mkdirSync(outputPath, { recursive: true });
        }
        
        const filePath = path.join(outputPath, finalFilename);
        fs.writeFileSync(filePath, JSON.stringify(analysis, null, 2));
        
        return filePath;
    }

    // CLI interface
    static async runCLI() {
        const args = process.argv.slice(2);
        
        if (args.length === 0) {
            console.log(`
ChainSage Analytics Helper

Usage:
  node helpers.js <command> [options]

Commands:
  balance <address> [chain]     Get wallet balance
  history <address> [chain]     Get transaction history
  analyze <address> [chain]     Full wallet analysis
  config                        Show current configuration

Examples:
  node helpers.js balance 0x742d35Cc6634C0532925a3b8D4C9db96C4b4Db45
  node helpers.js analyze 0x742d35Cc6634C0532925a3b8D4C9db96C4b4Db45 base
            `);
            return;
        }

        const helper = new ChainSageHelper();
        const command = args[0];
        const address = args[1];
        const chain = args[2] || helper.config.default_chain;

        try {
            switch (command) {
                case 'balance':
                    if (!address) throw new Error('Address required');
                    const balance = await helper.getWalletBalance(address, chain);
                    const currency = chain === 'solana' ? 'SOL' : 'ETH';
                    console.log(`Balance: ${helper.formatCurrency(balance.balance, currency)} on ${chain}`);
                    break;

                case 'history':
                    if (!address) throw new Error('Address required');
                    const history = await helper.getTransactionHistory(address, chain);
                    console.log(`Found ${history.count} transactions for ${address} on ${chain}`);
                    break;

                case 'analyze':
                    if (!address) throw new Error('Address required');
                    const txHistory = await helper.getTransactionHistory(address, chain, 50);
                    const patterns = helper.analyzeWalletPatterns(txHistory.transactions);
                    const analysis = {
                        address,
                        chain,
                        timestamp: new Date().toISOString(),
                        ...patterns
                    };
                    console.log('Wallet Analysis:');
                    console.log(JSON.stringify(analysis, null, 2));
                    
                    const savedPath = helper.saveAnalysis(address, analysis);
                    console.log(`\nAnalysis saved to: ${savedPath}`);
                    break;

                case 'config':
                    console.log('Current Configuration:');
                    console.log(JSON.stringify(helper.config, null, 2));
                    break;

                default:
                    throw new Error(`Unknown command: ${command}`);
            }
        } catch (error) {
            console.error(`Error: ${error.message}`);
            process.exit(1);
        }
    }
}

// Run CLI if this file is executed directly
if (require.main === module) {
    ChainSageHelper.runCLI();
}

module.exports = ChainSageHelper;
