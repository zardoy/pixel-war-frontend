import { useEffect, useRef, useState } from 'react'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { gql } from 'graphql-request'
import { Button } from '@nextui-org/react'
import { plainFetch, useFetch } from './fetcher'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useAccount } from 'wagmi'
import { useAwaitedClickAction } from '@zardoy/react-util'

class BasicCellsGrid {
    // without zoom / offset
    ctx: CanvasRenderingContext2D
    cellsData: [x: number, y: number, color: string | [number, number, number]][] = []
    newCellsData: [x: number, y: number, color: string][] = []
    gridSize = 500
    displayGrid = true
    scale = [] as number[]
    currentCursor: { x: number; y: number } | null = null
    previousCursor: { x: number; y: number } | null = null

    constructor(public canvas: HTMLCanvasElement, public cellSize: number) {
        this.canvas = canvas
        this.ctx = canvas.getContext('2d')!
        this.ctx.imageSmoothingEnabled = false
    }

    getScale() {
        return this.scale.reduce((acc, val) => acc * val, 1)
    }

    drawCell(x: number, y: number, color: string | [number, number, number] | number) {
        this.ctx.save()
        this.ctx.fillStyle = typeof color === 'string' ? color : Array.isArray(color) ? `rgb(${color.join(',')})` : `rgb(${color},${color},${color})`
        this.ctx.fillRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize)
        this.ctx.restore()
    }

    getXyFromAbslute(x: number, y: number) {
        return [Math.floor((x * this.getScale()) / this.cellSize), Math.floor((y * this.getScale()) / this.cellSize)] as [number, number]
    }

    changeCursor() {
        if (this.currentCursor === this.previousCursor) return
        if (this.previousCursor) {
            const [x, y] = this.getXyFromAbslute(this.previousCursor.x, this.previousCursor.y)
            this.restoreCell(x, y)
        }

        this.previousCursor = this.currentCursor

        if (this.currentCursor) {
            const [x, y] = this.getXyFromAbslute(this.currentCursor.x, this.currentCursor.y)
            this.drawCell(x, y, 'rgba(0, 0, 0, 0.5)')
        }

        this.drawGrid()
    }

    restoreCell(x: number, y: number) {
        const allCells = [...this.newCellsData, ...this.cellsData]
        const cell = allCells.find(([cellX, cellY]) => cellX === x && cellY === y)
        if (cell) {
            this.drawCell(x, y, cell[2])
        } else {
            this.ctx.clearRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize)
        }
        this.drawGrid()
    }

    drawCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
        for (const [x, y, color] of [...this.cellsData, ...this.newCellsData]) {
            this.drawCell(x, y, color)
        }

        this.drawGrid()
    }

    drawGrid() {
        if (!this.displayGrid) return
        const { gridSize } = this
        this.ctx.save()
        this.ctx.strokeStyle = 'black'
        this.ctx.lineWidth = 0.5
        // horizontal lines
        for (let i = 0; i < gridSize; i++) {
            this.ctx.beginPath()
            this.ctx.moveTo(0, i * this.cellSize)
            this.ctx.lineTo(gridSize * this.cellSize, i * this.cellSize)
            this.ctx.stroke()
        }
        // vertical lines
        for (let i = 0; i < gridSize; i++) {
            this.ctx.beginPath()
            this.ctx.moveTo(i * this.cellSize, 0)
            this.ctx.lineTo(i * this.cellSize, gridSize * this.cellSize)
            this.ctx.stroke()
        }
        this.ctx.restore()
    }

    placeNewCell(x: number, y: number, color: string) {
        this.newCellsData.push([x, y, color])
        this.drawCell(x, y, color)
        this.drawGrid()
    }
}

const NEW_PIXELS_LIMIT = 10

export default () => {
    const { open } = useWeb3Modal()
    const { address } = useAccount()

    const canvasRef = useRef<HTMLCanvasElement>(null!)
    const [grid, setGrid] = useState<BasicCellsGrid | null>(null)
    const [editingMode, setEditingMode] = useState(false)
    const [newPixels, setNewPixels] = useState(0)

    const document = gql`
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
        document,
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
    })

    useEffect(() => {
        if (!data) return
        const basicCellsGrid = new BasicCellsGrid(canvasRef.current, 10)
        basicCellsGrid.cellsData = (JSON.parse(data.getPixels.pixels) as (string | [number, number, number])[][]).flatMap((column, x) => {
            return column.map((color, y) => [x, y, color] as [number, number, string | [number, number, number]])
        })
        console.time('render')
        basicCellsGrid.drawCanvas()
        console.timeEnd('render')
        setGrid(basicCellsGrid)
        const updateSize = () => {
            const mult = window.devicePixelRatio
            basicCellsGrid.scale = [mult]
            basicCellsGrid.canvas.width = basicCellsGrid.canvas.clientWidth * mult
            basicCellsGrid.canvas.height = basicCellsGrid.canvas.clientHeight * mult
            basicCellsGrid.drawCanvas()
        }
        updateSize()
        const resizeObserver = new ResizeObserver(updateSize)
        // window.requestAnimationFrame(() => {
        resizeObserver.observe(basicCellsGrid.canvas)
        // })

        return () => {
            resizeObserver.disconnect()
        }
    }, [data])

    const hasEdits = newPixels > 0

    const getCursorPos = (e: MouseEvent) => {
        const rect = canvasRef.current.getBoundingClientRect()
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
                // centerOnInit
                onInit={ref => {
                    ref.zoomToElement(canvasRef.current)
                }}
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
                    <canvas
                        ref={canvasRef}
                        onMouseDown={e => {
                            if (!editingMode || e.buttons !== 1) return
                            e.preventDefault()
                            e.stopPropagation()
                        }}
                        onPointerMove={e => {
                            if (!editingMode) return
                            grid!.currentCursor = getCursorPos(e as any)
                            grid!.changeCursor()
                        }}
                        onTouchMove={e => {
                            if (!editingMode) return
                            e.preventDefault()
                            e.stopPropagation()
                        }}
                        onPointerOut={() => {
                            grid!.currentCursor = null
                            grid!.changeCursor()
                        }}
                        onClick={e => {
                            if (!editingMode) return

                            const { x, y } = getCursorPos(e as unknown as MouseEvent)
                            const xyRel = grid!.getXyFromAbslute(x, y)
                            grid!.placeNewCell(...xyRel, 'black')
                            setNewPixels(grid!.newCellsData.length)
                        }}
                        onTouchStart={e => {
                            e.preventDefault()
                        }}
                        style={{
                            width: '100%',
                            // height: ,
                            aspectRatio: '1',
                            border: '1px solid red',
                            imageRendering: 'pixelated',
                            zIndex: -1,
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
                <div className="top-0 left-0 right-0 flex justify-between">
                    <div className="flex flex-col gap-2 pointer-events-auto">
                        <Button
                            onClick={() => {
                                setEditingMode(!editingMode)
                                if (!hasEdits && editingMode) {
                                    grid!.displayGrid = false
                                    grid!.drawCanvas()
                                }
                            }}
                        >
                            {editingMode ? (hasEdits ? 'Pause Editing' : 'Stop Editing') : 'Start Editing'}
                        </Button>
                        {hasEdits && (
                            <Button color="success" onClick={placePixels.onClick} isLoading={placePixels.disabled}>
                                Save Changes ({newPixels}/10)
                            </Button>
                        )}
                        {hasEdits && (
                            <Button
                                color="danger"
                                onClick={() => {
                                    grid!.newCellsData = []
                                    setNewPixels(0)
                                    grid!.drawCanvas()
                                    setEditingMode(false)
                                }}
                            >
                                Discard Changes
                            </Button>
                        )}
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold max-sm:hidden">Pixel War</h2>
                    </div>
                    <div className="pointer-events-auto">
                        <span>Balance: ? PXL/? ETH</span>
                        <Button
                            onClick={() => {
                                open()
                            }}
                        >
                            {address ? 'Connect Wallet' : 'Disconnect'}
                        </Button>
                    </div>
                </div>
                {/* <div className="right-0 bottom-0">
                    {editingMode && <Button>Save Changes</Button>}
                </div> */}
            </div>
        </div>
    )
}
