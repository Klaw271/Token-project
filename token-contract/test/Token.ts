import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

describe("Token", async function () {
    const { viem } = await network.connect();
    
    it("При создании выдаёт монеты", async function () {
        // Развернуть токен
        const totalBalance = 10000n * 10n ** 18n;
        const token = await viem.deployContract("Token", [
            "HelloToken", 
            "HELLO", 
            totalBalance
        ]);
        
        // Получить адрес создателя
        const [creator] = await viem.getWalletClients();
        const creatorAddress = creator.account.address;
        
        // Проверить баланс создателя
        const creatorBalance = await token.read.balanceOf([creatorAddress]);
        assert.equal(creatorBalance, totalBalance);
        
        // Получить события перевода
        const publicClient = await viem.getPublicClient();
        const deploymentBlock = await publicClient.getBlockNumber();
        const events = await publicClient.getContractEvents({
            address: token.address,
            abi: token.abi,
            eventName: "Transfer",
            fromBlock: deploymentBlock,
            strict: true,
        });
        
        // Ожидаем только один перевод
        assert.equal(events.length, 1);
    });

    it("Владелец может чеканить монеты. Не владелец не может", async () => {
        const publicClient = await viem.getPublicClient();
        const [owner, nonOwner] = await viem.getWalletClients();
        const ownerAddress = owner.account.address;
        const nonOwnerAddress = nonOwner.account.address;
        
        const totalBalance = 10000n * 10n ** 18n;
        const token = await viem.deployContract("Token", [
            "HelloToken",
            "HELLO",
            totalBalance,
        ]);
        
        const mintAmount = 10n * 10n ** 18n;
        
        // Mint by owner - specify owner wallet in `account` param
        const mintTxHash = await token.write.mint([nonOwnerAddress, mintAmount], {
            account: owner.account,
        });
        
        await publicClient.waitForTransactionReceipt({ hash: mintTxHash });
        
        const deploymentBlock = await publicClient.getBlockNumber();
        const events = await publicClient.getContractEvents({
            address: token.address,
            abi: token.abi,
            eventName: "Transfer",
            fromBlock: deploymentBlock,
            strict: true,
        });
        
        assert(events.length > 0, "No Transfer events emitted");
        const transferEvent = events[0];
        
        assert.equal(
            transferEvent.args.from,
            "0x0000000000000000000000000000000000000000",
        );
        
        assert.equal(
            transferEvent.args.to.toLowerCase(),
            nonOwnerAddress.toLowerCase(),
        );
        
        assert.equal(BigInt(transferEvent.args.value), mintAmount);
        
        // Mint by non-owner must fail - specify nonOwner account here
        try {
            await token.write.mint([nonOwnerAddress, mintAmount], {
                account: nonOwner.account,
            });
            assert.fail("Expected mint call by non-owner to throw");
        } catch (e: any) {
            assert.match(e.message, /Ownable: caller is not the owner/);
        }
    });
});
