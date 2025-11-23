import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("KWNcoin", (m) => {
    const token = m.contract("Token", [
        "KWNcoin", 
        "KWN", 
        100000n * BigInt(1e18)
    ]);
    
    const newOwner = '';
    m.call(token, 'transferOwnership', [newOwner]);
    
    return { token };
});
