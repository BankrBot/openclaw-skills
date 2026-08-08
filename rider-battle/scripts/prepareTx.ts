// Allowlisted transaction preparer. Replaces the old arbitrary to/data/value helper.
// It ONLY permits: RIDER.transfer(to = escrow), and escrow createMatch / joinMatch /
// settle / cancelUnaccepted / refundStalled. Everything else is rejected. value is 0.
// This prevents the skill (or a tricked agent) from sending funds anywhere else.

const CHAIN  = "base";              // Base mainnet (8453) only
const ESCROW = "0x55c2847003a9e254b8312bf3c75520e06528aba6";
const RIDER  = "0x544e6e53a9e5ce11712647c893b3dd10c1d1cba3";

const ESCROW_SELECTORS = new Set([
  "df1888ec", // createMatch(uint256,address,uint256)
  "feb8c438", // joinMatch(uint256)
  "9abe08e6", // settle(uint256,address,bytes)
  "955c1247", // cancelUnaccepted(uint256)
  "dd5d4496", // refundStalled(uint256)
]);
const TRANSFER_SEL = "a9059cbb";     // transfer(address,uint256)

const lc = (s) => String(s || "").toLowerCase();
const strip0x = (s) => lc(s).replace(/^0x/, "");

function reject(reason){ return { error: "prepareTx blocked: " + reason }; }

async function prepareAllowed(args){
  const to    = lc(args.to);
  const data  = strip0x(args.data || "");
  const value = strip0x(args.value || "0");

  if (value !== "" && value !== "0" && value !== "00") return reject("value must be 0");
  if (data.length < 8) return reject("missing/short calldata");
  const sel = data.slice(0, 8);

  if (to === RIDER) {
    // Only a transfer whose recipient is the pinned escrow is allowed.
    if (sel !== TRANSFER_SEL) return reject("RIDER: only transfer() allowed");
    const recipient = "0x" + data.slice(8 + 24, 8 + 64); // 2nd word, last 20 bytes
    if (lc(recipient) !== ESCROW) return reject("RIDER transfer recipient must be the escrow");
  } else if (to === ESCROW) {
    if (!ESCROW_SELECTORS.has(sel)) return reject("escrow: function not allowed (" + sel + ")");
  } else {
    return reject("target not allowed (must be RIDER token or escrow)");
  }

  const label = args.label || "Bankr CryptoRider";
  const button = await bankr.tx.prepare({ chain: CHAIN, to: args.to, data: "0x" + data, value: "0x0", label });
  return { button };
}

return await prepareAllowed(args);
