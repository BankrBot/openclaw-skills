const ESCROW = "0x55c2847003A9e254b8312bf3C75520e06528aBa6";
const matchId = String(args.matchId || "");
if (!matchId) { return { error: "no matchId" }; }
const abi = [{ type:"function", name:"matches", stateMutability:"view", inputs:[{name:"",type:"uint256"}], outputs:[{name:"creator",type:"address"},{name:"opponent",type:"address"},{name:"token",type:"address"},{name:"wager",type:"uint256"},{name:"createdAt",type:"uint64"},{name:"fundedAt",type:"uint64"},{name:"status",type:"uint8"}] }];
const res = await bankr.chain.readContract({ chain:"base", address:ESCROW, abi:abi, functionName:"matches", args:[matchId] });
const wager = String((res && (res.wager || res[3])) || "0");
const status = Number((res && (res.status || res[6])) || 0);
return { wager: wager, status: status };
