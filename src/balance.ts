import { getContract, getPublicClient } from '@wagmi/core'
import { useEffect, useState } from 'react'
import { proxy, useSnapshot } from 'valtio'
import { formatEther } from 'viem'
import { useWalletClient } from 'wagmi'

export const balanceUpdate = proxy({
    update: 0,
})

export const getTokenContract = async client => {
    const erc20Contract = getContract({
        abi: [
            {
                inputs: [
                    { internalType: 'address', name: 'owner', type: 'address' },
                    { internalType: 'address', name: 'spender', type: 'address' },
                ],
                name: 'allowance',
                outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
                type: 'function',
                stateMutability: 'view',
            },
            {
                inputs: [
                    { internalType: 'address', name: 'spender', type: 'address' },
                    { internalType: 'uint256', name: 'amount', type: 'uint256' },
                ],
                name: 'approve',
                outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
                type: 'function',
                stateMutability: 'nonpayable',
            },
            {
                inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
                name: 'balanceOf',
                outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
                type: 'function',
                stateMutability: 'view',
            },
        ],
        address: '0x30a7F3F76E922D0a9A60Ab459d4e59C73a8B020b',
        walletClient: client,
        // publicClient: client,
    })
    return erc20Contract
}

export const useBalance = () => {
    const [tokenBalance, setTokenBalance] = useState('-')
    const { update } = useSnapshot(balanceUpdate)
    const { data: client } = useWalletClient()

    useEffect(() => {
        if (!client) return
        console.log('client', client)
        getTokenContract(client).then(async contract => {
            const balance = await contract.read.balanceOf!([client.account.address])
            setTokenBalance(parseFloat(formatEther(balance as unknown as bigint)).toFixed(3))
        })
    }, [client, update])

    return tokenBalance
}
