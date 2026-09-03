// Confirmation-gated deposit flow. The escrow is transfer-based, so funding is
// transfer -> (CONFIRMED) -> createMatch/joinMatch. This file SPLITS the flow so
// the create/join tx literally cannot be prepared until the transfer hash is
// confirmed on-chain, and it re-verifies on-chain state immediately before funding.
// All targets/selectors go through the allowlisted prepareTx.

const CHAIN  = "base";
const ESCROW = "0x55c2847003a9e254b8312bf3c75520e06528aba6";
const RIDER  = "0x544e6e53a9e5ce11712647c893b3dd10c1d1cba3";
const SEL = { TRANSFER:"a9059cbb", CREATE:"df1888ec", JOIN:"feb8c438" };
const MIN_WAGER = 1n, MAX_WAGER = 100000000n; // whole RIDER

const lc = (s)=>String(s||"").toLowerCase();
const pad = (h)=>lc(h).replace(/^0x/,"").padStart(64,"0");
const addr = (a)=>pad(a);
const uint = (n)=>pad(BigInt(n).toString(16));

// strict integer whole-token -> wei
function toWei(W){
  const s = String(W).trim();
  if(!/^\d+$/.test(s)) throw new Error("wager must be a whole integer of RIDER");
  const w = BigInt(s);
  if(w < MIN_WAGER || w > MAX_WAGER) throw new Error("wager out of allowed range");
  return (w * (10n ** 18n)).toString();
}

const MATCHES_ABI = [{ type:"function", name:"matches", stateMutability:"view",
  inputs:[{name:"",type:"uint256"}],
  outputs:[{name:"creator",type:"address"},{name:"opponent",type:"address"},{name:"token",type:"address"},
           {name:"wager",type:"uint256"},{name:"createdAt",type:"uint64"},{name:"fundedAt",type:"uint64"},
           {name:"status",type:"uint8"}] }];

async function readMatch(id){
  const r = await bankr.chain.readContract({ chain:CHAIN, address:ESCROW, abi:MATCHES_ABI, functionName:"matches", args:[String(id)] });
  return { creator:lc(r.creator??r[0]), opponent:lc(r.opponent??r[1]), token:lc(r.token??r[2]),
           wager:String(r.wager??r[3]), status:Number(r.status??r[6]) };
}

// Blocks until the tx receipt is mined & successful. Throws if it can't confirm —
// so the caller can NOT proceed to step 2 on an unconfirmed transfer.
async function requireConfirmed(hash){
  if(!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error("no valid transfer hash to confirm");
  for(let i=0;i<40;i++){
    let rcpt=null;
    try{ rcpt = await bankr.chain.getTransactionReceipt({ chain:CHAIN, hash }); }catch(e){ rcpt=null; }
    if(rcpt && (rcpt.status===1 || rcpt.status==="0x1" || rcpt.status===true)) return true;
    if(rcpt && (rcpt.status===0 || rcpt.status==="0x0" || rcpt.status===false)) throw new Error("transfer reverted");
    await new Promise(r=>setTimeout(r,3000));
  }
  throw new Error("transfer not confirmed in time — do NOT create/join; funds (if sent) are recoverable via refund");
}

// ---- STEP A: verify on-chain preconditions, then prepare the transfer ----
// For CREATE: match id must be free (status 0). For JOIN: match must be Open, token=RIDER,
// terms match the on-chain match, and creator != me.
async function step1_transfer(kind, matchId, wagerWholeTokens, me){
  const wei = toWei(wagerWholeTokens);
  const m = await readMatch(matchId);
  if(kind==="create"){
    if(m.status !== 0) throw new Error("matchId already used on-chain (status "+m.status+")");
  } else {
    if(m.status !== 1) throw new Error("match is not Open on-chain");
    if(m.token !== RIDER) throw new Error("match token is not RIDER");
    if(m.wager !== wei) throw new Error("on-chain wager does not match requested amount");
    if(m.creator === lc(me)) throw new Error("cannot accept your own match");
  }
  const data = "0x"+SEL.TRANSFER+addr(ESCROW)+uint(wei);
  const button = await bankr.tx.prepare({ chain:CHAIN, to:RIDER, data, value:"0x0", label:"Rider deposit" });
  return { button, wei, note:"After this transfer CONFIRMS, call step2 with its tx hash." };
}

// ---- STEP B: only runs after the transfer hash is confirmed ----
async function step2_after_confirm(kind, matchId, wagerWholeTokens, transferHash, me){
  const wei = toWei(wagerWholeTokens);
  await requireConfirmed(transferHash);          // gate: cannot proceed unless mined+success
  const m = await readMatch(matchId);            // re-verify immediately before create/join
  if(kind==="create"){
    if(m.status !== 0) throw new Error("state changed; do not create — reclaim via refund");
    const data = "0x"+SEL.CREATE+uint(matchId)+addr(RIDER)+uint(wei);
    const button = await bankr.tx.prepare({ chain:CHAIN, to:ESCROW, data, value:"0x0", label:"Create Rider battle" });
    return { button, expect:"status becomes Open(1)" };
  } else {
    if(m.status !== 1 || m.token !== RIDER || m.wager !== wei) throw new Error("terms changed; do not join — reclaim via refund");
    const data = "0x"+SEL.JOIN+uint(matchId);
    const button = await bankr.tx.prepare({ chain:CHAIN, to:ESCROW, data, value:"0x0", label:"Accept Rider battle" });
    return { button, expect:"status becomes Funded(2)" };
  }
}
