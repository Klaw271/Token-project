import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("KWMcoin", (m) => {
    const token = m.contract("Token", [
        "KWMcoin",
        "KWM", 
        10000n * BigInt(1e18)
    ]);
    
    return { token };
});
