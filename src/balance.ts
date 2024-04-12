import { getContract, getPublicClient } from '@wagmi/core'
import { GraphQLClient, gql } from 'graphql-request'
import { useEffect, useState } from 'react'
import { proxy, ref, useSnapshot } from 'valtio'
import { formatEther } from 'viem'
import { useWalletClient } from 'wagmi'
import { DEFAULT_BASE_URL } from './fetcher'

export const balanceUpdate = proxy({
    update: 0,
})

export const contractState = proxy({
    contract: null,
    address: '',
    abi: [],
})

export const loadContract = async client => {
    const document = gql`
        query Contract {
            contract {
                address
                abi
            }
        }
    `
    type Type = {
        contract: {
            address: string
            abi: string
        }
    }
    const data = await new GraphQLClient(import.meta.env.VITE_GRAPHQL_ENDPOINT || DEFAULT_BASE_URL).request<Type>(document, {})
    const address = data.contract.address
    contractState.address = address
    const abi = JSON.parse(data.contract.abi)
    contractState.abi = abi

    // const client = (await getWalletClient())!
    const contract = getContract({
        abi,
        address: address as any,
        walletClient: client,
        // publicClient: client,
    })
    //@ts-ignore
    contract.on = (eventName, fn) => {
        ;(contract as any).watchEvent[eventName](
            {},
            {
                onLogs: logs => {
                    fn(logs)
                },
            },
        )
    }
    contractState.contract = ref(contract) as any
}

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
