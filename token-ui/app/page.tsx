'use client';

import {useState, useEffect} from "react";
import Web3 from "web3";
import { TokenABI as TOKEN_ABI } from '../utils/tokenABI';

// ЗАМЕНИТЕ на адрес вашего контракта после деплоя
const CONTRACT_ADDRESS = "0x96C12162c7DC9FBec711112513E1817cbdF80980";

const SEPOLIA_CHAIN_ID = '0xaa36a7'; // 11155111 в hex
const SEPOLIA_RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";

export default function Home() {
  const [web3, setWeb3] = useState(undefined);
  const [userAddress, setUserAddress] = useState(undefined);
  const [contract, setContract] = useState(undefined);
  const [tokenInfo, setTokenInfo] = useState({ name: '', symbol: '', decimals: 18 });
  const [userBalance, setUserBalance] = useState('0');
  const [isOwner, setIsOwner] = useState(false);
  
  // Формы
  const [transferData, setTransferData] = useState({ to: '', amount: '' });
  const [mintData, setMintData] = useState({ to: '', amount: '' });
  
  const [loading, setLoading] = useState(false);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);

  // Проверка сети
  const checkNetwork = async () => {
    if (typeof window.ethereum === 'undefined') return false;
    
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    const correct = chainId === SEPOLIA_CHAIN_ID;
    setIsCorrectNetwork(correct);
    return correct;
  };

  // Переключение на Sepolia
  const switchToSepolia = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SEPOLIA_CHAIN_ID }],
      });
    } catch (error) {
      if (error.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: SEPOLIA_CHAIN_ID,
            chainName: 'Sepolia Test Network',
            rpcUrls: [SEPOLIA_RPC_URL],
            nativeCurrency: {
              name: 'Sepolia ETH',
              symbol: 'ETH',
              decimals: 18
            },
            blockExplorerUrls: ['https://sepolia.etherscan.io']
          }]
        });
      }
    }
  };

  // Загрузка данных токена и баланса
  const loadTokenData = async (contractInstance, address) => {
    try {
      const [name, symbol, decimals, balance, owner] = await Promise.all([
        contractInstance.methods.name().call(),
        contractInstance.methods.symbol().call(),
        contractInstance.methods.decimals().call(),
        contractInstance.methods.balanceOf(address).call(),
        contractInstance.methods.owner().call()
      ]);

      setTokenInfo({ name, symbol, decimals: parseInt(decimals) });
      setUserBalance(balance);
      setIsOwner(owner.toLowerCase() === address.toLowerCase());
    } catch (error) {
      console.error('Error loading token data:', error);
    }
  };

  // Форматирование баланса с учетом decimals
  const formatBalance = (balance, decimals) => {
    const divisor = BigInt(10) ** BigInt(decimals);
    const whole = balance / divisor;
    const fractional = balance % divisor;
    
    if (fractional === 0n) {
      return whole.toString();
    }
    
    const fractionalStr = fractional.toString().padStart(decimals, '0');
    return `${whole}.${fractionalStr}`;
  };

  // Добавление токена в кошелек
  const addTokenToWallet = async () => {
    if (typeof window.ethereum === 'undefined') return;
    
    try {
      await window.ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: CONTRACT_ADDRESS,
            symbol: tokenInfo.symbol,
            decimals: tokenInfo.decimals,
            image: '' // опционально: URL иконки токена
          },
        },
      });
    } catch (error) {
      console.error('Error adding token to wallet:', error);
    }
  };

  // Перевод токенов
  const handleTransfer = async (e) => {
    e.preventDefault();
    if (!contract || !userAddress) return;

    setLoading(true);
    try {
      const amount = BigInt(transferData.amount) * (10n ** BigInt(tokenInfo.decimals));
      
      await contract.methods.transfer(transferData.to, amount.toString())
        .send({ from: userAddress });
      
      alert('Transfer successful!');
      setTransferData({ to: '', amount: '' });
      await loadTokenData(contract, userAddress);
    } catch (error) {
      console.error('Transfer error:', error);
      alert('Transfer failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Минтинг токенов (только для владельца)
  const handleMint = async (e) => {
    e.preventDefault();
    if (!contract || !userAddress || !isOwner) return;

    setLoading(true);
    try {
      const amount = BigInt(mintData.amount) * (10n ** BigInt(tokenInfo.decimals));
      
      await contract.methods.mint(mintData.to, amount.toString())
        .send({ from: userAddress });
      
      alert('Mint successful!');
      setMintData({ to: '', amount: '' });
      await loadTokenData(contract, userAddress);
    } catch (error) {
      console.error('Mint error:', error);
      alert('Mint failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (typeof window.ethereum === 'undefined') {
      alert('Please install MetaMask!');
      return;
    }

    try {
      // Проверяем и переключаем сеть если нужно
      const isCorrect = await checkNetwork();
      if (!isCorrect) {
        await switchToSepolia();
        // После переключения даем время на изменение сети
        setTimeout(async () => {
          await checkNetwork();
        }, 1000);
        return;
      }

      const web3Instance = new Web3(window.ethereum);
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      const contractInstance = new web3Instance.eth.Contract(TOKEN_ABI, CONTRACT_ADDRESS);
      
      setWeb3(web3Instance);
      setUserAddress(accounts[0]);
      setContract(contractInstance);
      
      await loadTokenData(contractInstance, accounts[0]);
    } catch (error) {
      console.error('Connection error:', error);
      alert('Error connecting to wallet: ' + error.message);
    }
  };

  // Слушатель изменения аккаунта
  useEffect(() => {
    if (typeof window.ethereum !== 'undefined') {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          setUserAddress(accounts[0]);
          if (contract) {
            loadTokenData(contract, accounts[0]);
          }
        } else {
          setUserAddress(undefined);
          setUserBalance('0');
          setIsOwner(false);
        }
      });

      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }

    return () => {
      if (typeof window.ethereum !== 'undefined') {
        window.ethereum.removeAllListeners('accountsChanged');
        window.ethereum.removeAllListeners('chainChanged');
      }
    };
  }, [contract]);

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
    <h1 style={{ textAlign: 'center', color: '#333' }}>Token Management dApp</h1>
    
    {!userAddress ? (
      <div style={{ textAlign: 'center', marginTop: '50px' }}>
        <button 
          onClick={handleConnect} 
          style={{ 
            padding: '15px 30px', 
            fontSize: '18px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
            transition: 'all 0.3s ease'
          }}
          onMouseOver={(e) => {
            e.target.style.backgroundColor = '#45a049';
            e.target.style.transform = 'translateY(-2px)';
          }}
          onMouseOut={(e) => {
            e.target.style.backgroundColor = '#4CAF50';
            e.target.style.transform = 'translateY(0)';
          }}
        >
          🔗 Connect MetaMask Wallet
        </button>
        <p style={{ marginTop: '20px', color: '#666' }}>
          Connect your wallet to manage your tokens
        </p>
      </div>
    ) : (
      <div>
        <div style={{ marginBottom: '20px', padding: '20px', border: '2px solid #e0e0e0', borderRadius: '10px', backgroundColor: '#f9f9f9' }}>
          <p><strong>Connected:</strong> {userAddress}</p>
          <p><strong>Token:</strong> {tokenInfo.name} ({tokenInfo.symbol})</p>
          <p><strong>Your Balance:</strong> {formatBalance(BigInt(userBalance), tokenInfo.decimals)} {tokenInfo.symbol}</p>
          {isOwner && <p style={{ color: 'green', fontWeight: 'bold' }}><strong>🎯 You are the owner</strong></p>}
          
          <button 
            onClick={addTokenToWallet} 
            style={{ 
              marginTop: '15px', 
              padding: '10px 20px',
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              transition: 'all 0.3s ease'
            }}
            onMouseOver={(e) => {
              e.target.style.backgroundColor = '#1976D2';
              e.target.style.transform = 'translateY(-1px)';
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = '#2196F3';
              e.target.style.transform = 'translateY(0)';
            }}
          >
            ➕ Add Token to Wallet
          </button>
        </div>

          {/* Форма перевода */}
          <div style={{ marginBottom: '30px', padding: '15px', border: '1px solid #ccc' }}>
            <h3>Transfer Tokens</h3>
            <form onSubmit={handleTransfer}>
              <div style={{ marginBottom: '10px' }}>
                <input
                  type="text"
                  placeholder="Recipient Address"
                  value={transferData.to}
                  onChange={(e) => setTransferData({...transferData, to: e.target.value})}
                  style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
                  required
                />
                <input
                  type="number"
                  placeholder="Amount"
                  value={transferData.amount}
                  onChange={(e) => setTransferData({...transferData, amount: e.target.value})}
                  style={{ width: '100%', padding: '8px' }}
                  step="0.000000000000000001"
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                style={{ padding: '10px 20px' }}
              >
                {loading ? 'Processing...' : 'Transfer'}
              </button>
            </form>
          </div>

          {/* Форма минта (только для владельца) */}
          {isOwner && (
            <div style={{ padding: '15px', border: '1px solid #ccc' }}>
              <h3>Mint Tokens (Owner Only)</h3>
              <form onSubmit={handleMint}>
                <div style={{ marginBottom: '10px' }}>
                  <input
                    type="text"
                    placeholder="Recipient Address"
                    value={mintData.to}
                    onChange={(e) => setMintData({...mintData, to: e.target.value})}
                    style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
                    required
                  />
                  <input
                    type="number"
                    placeholder="Amount to Mint"
                    value={mintData.amount}
                    onChange={(e) => setMintData({...mintData, amount: e.target.value})}
                    style={{ width: '100%', padding: '8px' }}
                    step="0.000000000000000001"
                    required
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={loading}
                  style={{ padding: '10px 20px', backgroundColor: '#4CAF50', color: 'white' }}
                >
                  {loading ? 'Processing...' : 'Mint Tokens'}
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {!isCorrectNetwork && userAddress && (
        <div style={{ color: 'red', marginTop: '20px' }}>
          Please switch to Sepolia network
        </div>
      )}
    </div>
  );
}
