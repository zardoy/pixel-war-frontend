import { useEffect, useRef, useState } from 'react'
import { TransformWrapper, TransformComponent, ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { gql } from 'graphql-request'
import { Button } from '@nextui-org/react'
import { plainFetch, useFetch } from './fetcher'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useAccount, useWalletClient } from 'wagmi'
import { useAwaitedClickAction } from '@zardoy/react-util'
import { clampAddress } from './utils'
import { EditableCanvasGrid } from './EditableCanvasGrid'
import { contractState, loadContract, useBalance } from './balance'
import { useSnapshot } from 'valtio'

const NEW_PIXELS_LIMIT = 10

export default () => {
    const zoomRef = useRef<ReactZoomPanPinchContentRef>(null!)
    const { open } = useWeb3Modal()
    const { address } = useAccount()
    const balance = useBalance()
    const limit = Math.min(NEW_PIXELS_LIMIT, typeof balance === 'number' ? balance : NEW_PIXELS_LIMIT)
    const { contract } = useSnapshot(contractState)

    const containerRef = useRef<HTMLElement>(null!)
    const [grid, setGrid] = useState<EditableCanvasGrid | null>(null)
    const [editingMode, setEditingMode] = useState(false)
    const [newPixels, setNewPixels] = useState(0)
    const [color, setColor] = useState('#000')

    const { data: client } = useWalletClient()

    useEffect(() => {
        if (!client) return
        loadContract(client)
    }, [])

    const requestPixels = gql`
        query {
            getPixels {
                pixels
            }
        }
    `
    const { data, loading } = useFetch<{
        getPixels: {
            pixels: string
        }
    }>({
        document: requestPixels,
    })

    const placePixels = useAwaitedClickAction(async () => {
        await plainFetch({
            variables: {
                x: grid!.newCellsData.map(([x]) => x),
                y: grid!.newCellsData.map(([, y]) => y),
                color: grid!.newCellsData.map(([, , color]) => color),
            },
            document: gql`
                mutation ($x: [Int!]!, $y: [Int!]!, $color: [String!]!) {
                    setPixel(x: $x, y: $y, color: $color) {
                        void
                    }
                }
            `,
        })
        setEditingMode(false)
        setNewPixels(0)
        grid!.cellsData.push(...grid!.newCellsData)
        grid!.newCellsData = []
        grid!.drawCanvas(true)
    })

    useEffect(() => {
        if (!data) return
        const basicCellsGrid = new EditableCanvasGrid(containerRef.current, 10)
        basicCellsGrid.cellsData = (JSON.parse(data.getPixels.pixels) as (string | [number, number, number])[][]).flatMap((column, x) => {
            return column.map((color, y) => [x, y, color] as [number, number, string | [number, number, number]])
        })
        setGrid(basicCellsGrid)
        const updateSize = () => {
            console.time('render')
            basicCellsGrid.updateSize(window.devicePixelRatio)
            console.timeEnd('render')
            zoomRef.current.zoomToElement(containerRef.current, 0.1, 0.5)
        }
        updateSize()
        const windowResizeObserver = new ResizeObserver(() => {
            // updateSize()
        })
        windowResizeObserver.observe(document.documentElement)

        return () => {
            windowResizeObserver.disconnect()
        }
    }, [data])

    const hasEdits = newPixels > 0

    const getCursorPos = (e: MouseEvent) => {
        const rect = containerRef.current.getBoundingClientRect()
        return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    return (
        <div
            style={{ display: 'flex', height: '100%' }}
            onContextMenu={e => {
                e.preventDefault()
            }}
        >
            <TransformWrapper
                limitToBounds={false}
                onZoom={ref => {
                    grid!.scale[1] = 1 / ref.state.scale
                }}
                onPanning={ref => {
                    grid!.scale[1] = 1 / ref.state.scale
                }}
                ref={zoomRef}
                minScale={0.1}
                // wheel={{
                //     step: 100,
                // }}
            >
                <TransformComponent
                    wrapperStyle={{
                        border: '1px solid black',
                        willChange: 'transform',
                        height: '100dvh',
                    }}
                >
                    <div
                        ref={containerRef as any}
                        onMouseDown={e => {
                            if (!editingMode || e.buttons !== 1) return
                            e.preventDefault()
                            e.stopPropagation()
                        }}
                        onPointerMove={e => {
                            if (!editingMode || !grid) return
                            grid.currentCursor = getCursorPos(e as any)
                            grid.changeCursor()
                        }}
                        onTouchMove={e => {
                            if (!editingMode) return
                            e.preventDefault()
                            e.stopPropagation()
                        }}
                        onPointerOut={() => {
                            if (!grid) return
                            grid.currentCursor = null
                            grid.changeCursor()
                        }}
                        onClick={e => {
                            if (!editingMode || !grid || newPixels >= limit) return

                            const { x, y } = getCursorPos(e as unknown as MouseEvent)
                            const xyRel = grid.getXyFromAbslute(x, y)
                            grid.placeNewEditCell(...xyRel, color)
                            setNewPixels(grid.newCellsData.length)
                        }}
                        onTouchStart={e => {
                            e.preventDefault()
                        }}
                        style={{
                            aspectRatio: '1',
                            border: '1px solid red',
                            imageRendering: 'pixelated',
                            zIndex: -1,
                            width: '100%',
                            height: '100%',
                            position: 'relative',
                            // background: 'linear-gradient(45deg, #f3ec78, #af4261)',
                        }}
                        // todo
                        onDoubleClick={e => {
                            e.preventDefault()
                            e.stopPropagation()
                        }}
                    />
                </TransformComponent>
            </TransformWrapper>
            <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
                <div className="top-0 left-0 right-0 flex bg-white bg-opacity-50 backdrop-blur-[2px] p-4 m-[1px] flex-col gap-1">
                    <h1 className="text-2xl font-extrabold italic sm:hidden text-center">Pixel War</h1>
                    <div className="max-sm:hidden" />
                    <div className="flex justify-between">
                        <div className="relative w-[130px]">
                            <div className="flex flex-col gap-2 pointer-events-auto absolute top-0">
                                <Button
                                    disabled={!grid}
                                    // disabled={!grid || !contract}
                                    onClick={() => {
                                        setEditingMode(!editingMode)
                                        if (!hasEdits && editingMode) {
                                            grid!.displayGrid = false
                                            grid!.drawCanvas(true)
                                        }
                                        if (!editingMode) {
                                            grid!.displayGrid = true
                                            grid!.drawCanvas(true)
                                        }
                                    }}
                                >
                                    {editingMode ? (hasEdits ? 'Pause Editing' : 'Stop Editing') : 'Start Editing'}
                                </Button>
                                {editingMode && (
                                    <Button
                                        onClick={e => {
                                            ;((e.target as HTMLButtonElement).children[0] as HTMLElement).click()
                                        }}
                                    >
                                        Color{' '}
                                        <input
                                            type="color"
                                            style={{ border: 'none' }}
                                            value={color}
                                            onChange={e => setColor(e.target.value)}
                                            onClick={e => {
                                                e.stopPropagation()
                                            }}
                                        />
                                    </Button>
                                )}
                                {hasEdits && (
                                    <Button color="success" onClick={placePixels.onClick} isLoading={placePixels.disabled}>
                                        Save Changes ({newPixels}/{limit})
                                    </Button>
                                )}
                                {hasEdits && (
                                    <Button
                                        color="danger"
                                        onClick={() => {
                                            grid!.newCellsData = []
                                            setNewPixels(0)
                                            setEditingMode(false)
                                            grid!.drawCanvas(true)
                                        }}
                                    >
                                        Discard Changes
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div>
                            <h2 className="text-2xl font-extrabold italic max-sm:hidden">Pixel War</h2>
                        </div>
                        <div className="pointer-events-auto flex flex-wrap justify-end items-center gap-1">
                            <b>Balance: {balance} PXL</b>
                            <Button
                                onClick={() => {
                                    open()
                                }}
                            >
                                {address ? clampAddress(address) : 'Connect Wallet'}
                            </Button>
                        </div>
                    </div>
                </div>
                {/* <div className="right-0 bottom-0">
                    {editingMode && <Button>Save Changes</Button>}
                </div> */}
            </div>
        </div>
    )
}
