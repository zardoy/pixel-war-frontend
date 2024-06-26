import { GraphQLClient, gql } from 'graphql-request'
import { useEffect, useState } from 'react'

export const DEFAULT_BASE_URL = 'https://api.dcr.bet/pixels'

export const useFetch = <T>({ enabled = true, variables = {}, document, stateCounter = 0 }) => {
    const [data, setData] = useState<T | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!enabled) return
        ;(async () => {
            setLoading(true)
            const data = await new GraphQLClient(import.meta.env.VITE_GRAPHQL_ENDPOINT || DEFAULT_BASE_URL).request(document, variables)
            setData(data as T)
            setLoading(false)
        })()
    }, [enabled, stateCounter])

    return { data, loading }
}

export const plainFetch = ({ document, variables }) => {
    return new GraphQLClient(import.meta.env.VITE_GRAPHQL_ENDPOINT || DEFAULT_BASE_URL).request(document, variables)
}
