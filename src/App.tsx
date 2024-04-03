import React, { useEffect, useRef, useState } from 'react'

class CanvasScalableGrid {
    ctx: CanvasRenderingContext2D
    zoomLevel: number = 1
    zoomLevelBounds: [min: number, max: number] = [0.1, 10]
    offset: { x: number; y: number } = { x: 0, y: 0 }
    drawGrid = true
    abortController = new AbortController()
    hoverCell: { x: number; y: number } | null = null // raw cell coordinates
    cellsData: [x: number, y: number, color: string][] = []
    gridSize = 1000

    constructor(public canvas: HTMLCanvasElement, public cellSize: number) {
        this.canvas = canvas
        this.ctx = canvas.getContext('2d')!
    }

    drawCell(x: number, y: number, color: string) {
        this.ctx.save()
        this.ctx.fillStyle = color
        const size = this.cellSize * this.zoomLevel
        this.ctx.fillRect(x * this.cellSize * this.zoomLevel + this.offset.x, y * this.cellSize * this.zoomLevel + this.offset.y, size, size)
        this.ctx.restore()
    }

    setZoomLevel(zoomLevel: number) {
        this.zoomLevel = zoomLevel
        this.zoomLevel = Math.min(Math.max(this.zoomLevel, this.zoomLevelBounds[0]), this.zoomLevelBounds[1])
    }

    drawHoverCell() {
        if (!this.hoverCell) return
        const cellSizeScaled = this.cellSize * this.zoomLevel
        const x = Math.floor((this.hoverCell!.x - this.offset.x) / cellSizeScaled)
        const y = Math.floor((this.hoverCell!.y - this.offset.y) / cellSizeScaled)
        console.log('blue', x, y)
        this.drawCell(x, y, 'blue')
    }

    drawCanvas() {
        this.zoomLevel = Math.min(Math.max(this.zoomLevel, this.zoomLevelBounds[0]), this.zoomLevelBounds[1])

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
        // this.canvas.width = gridSize * cellSize
        // this.canvas.height = gridSize * cellSize
        const cellSizeScaled = this.cellSize * this.zoomLevel
        const drawGrid = () => {
            this.ctx.strokeStyle = 'black'
            this.ctx.lineWidth = 0.5
            // horizontal lines
            const { gridSize } = this
            for (let i = 0; i < gridSize; i++) {
                this.ctx.beginPath()
                const xStart = this.offset.x
                const yStart = i * cellSizeScaled + this.offset.y
                this.ctx.moveTo(xStart, yStart)
                this.ctx.lineTo(gridSize * cellSizeScaled + xStart, yStart)
                this.ctx.stroke()
            }
            // vertical lines
            for (let i = 0; i < gridSize; i++) {
                this.ctx.beginPath()
                const xStart = i * cellSizeScaled + this.offset.x
                const yStart = this.offset.y
                this.ctx.moveTo(xStart, yStart)
                this.ctx.lineTo(xStart, gridSize * cellSizeScaled + yStart)
                this.ctx.stroke()
            }
        }
        if (this.drawGrid) {
            drawGrid()
        }

        // const cells = [[1, 1, 'red']] as [x: number, y: number, color: string][]
        const drawRectangles = () => {
            for (let w = 0; w < this.gridSize; w++) {
                // for (let h = 0; h < this.gridSize; h++) {
                //     const x = w
                //     const y = h
                //     this.drawCell(x, y, 'red')
                // }
            }
        }
        drawRectangles()

        // this.drawHoverCell()
    }
}

class PinchZoomHandler {
    abortController: AbortController | undefined

    updateZoom = (zoomLevel: number) => {}

    addEventListeners(elem: HTMLElement) {
        this.abortController = new AbortController()
        const signal = this.abortController.signal
        elem.addEventListener('pointerdown', this.handlePointerDown, { signal })
        elem.addEventListener('pointermove', this.handlePointerMove, { signal })
        elem.addEventListener('pointerup', this.handlePointerUp, { signal })
        elem.addEventListener('pointercancel', this.handlePointerUp, { signal })
        elem.addEventListener('lostpointercapture', this.handlePointerUp, { signal })
    }

    currentPointers: PointerEvent[] = []

    handlePointerDown = (e: PointerEvent) => {
        if (e.pointerType === 'touch') {
            e.preventDefault()
            ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
            this.currentPointers.push(e)
        }
    }

    handlePointerMove = (e: PointerEvent) => {
        // If two pointers are down, check for pinch gestures
        if (this.currentPointers.length === 2) {
            const [pointer1, pointer2] = this.currentPointers as [PointerEvent, PointerEvent]
            const curDiff = Math.hypot(pointer1.clientX - pointer2.clientX, pointer1.clientY - pointer2.clientY)
        }
    }

    handlePointerUp = (e: PointerEvent) => {
        this.currentPointers = this.currentPointers.filter(p => p.pointerId !== e.pointerId)
    }
}

export default () => {
    const canvasRef = useRef(null)
    const [canvasScalableGrid, setCanvasScalableGrid] = useState<CanvasScalableGrid>(null!)
    const [drawMode, setDrawMode] = useState(true)
    const currentMoving = useRef(false)
    const windowSize = 700

    useEffect(() => {
        const canvasScalableGrid = new CanvasScalableGrid(canvasRef.current! as HTMLCanvasElement, 10)
        setCanvasScalableGrid(canvasScalableGrid)
        canvasScalableGrid.canvas.width = windowSize * window.devicePixelRatio
        canvasScalableGrid.canvas.height = windowSize * window.devicePixelRatio
        canvasScalableGrid.drawCanvas()
        canvasScalableGrid.canvas.addEventListener(
            'wheel',
            e => {
                e.preventDefault()
                const oldZoomLevel = canvasScalableGrid.zoomLevel
                canvasScalableGrid.zoomLevel -= e.deltaY * 0.01 * (e.ctrlKey ? 2 : 1)
                // clamp zoom level
                canvasScalableGrid.setZoomLevel(canvasScalableGrid.zoomLevel)
                const reachedLimit =
                    canvasScalableGrid.zoomLevel === canvasScalableGrid.zoomLevelBounds[0] ||
                    canvasScalableGrid.zoomLevel === canvasScalableGrid.zoomLevelBounds[1]
                if (reachedLimit) return
                // stay centered
                const offsetX = (e.offsetX - canvasScalableGrid.offset.x) / oldZoomLevel
                const offsetY = (e.offsetY - canvasScalableGrid.offset.y) / oldZoomLevel
                canvasScalableGrid.offset.x = e.offsetX - offsetX * canvasScalableGrid.zoomLevel
                canvasScalableGrid.offset.y = e.offsetY - offsetY * canvasScalableGrid.zoomLevel
                canvasScalableGrid.drawCanvas()
            },
            {
                passive: false,
            },
        )
    }, [])

    useEffect(() => {
        if (!canvasScalableGrid) return
        canvasScalableGrid.drawGrid = drawMode
        canvasScalableGrid.drawCanvas()
    }, [drawMode])

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                touchAction: 'none',
                overflow: 'hidden',
            }}
        >
            <button onClick={() => setDrawMode(!drawMode)}>{!drawMode ? 'Draw mode' : 'Disable draw mode'}</button>
            <canvas
                onPointerDown={() => {
                    currentMoving.current = true
                }}
                onPointerUp={() => {
                    currentMoving.current = false
                }}
                onPointerMove={({ movementX, movementY, clientX, clientY }) => {
                    if (!currentMoving.current) return
                    canvasScalableGrid.offset.x += movementX
                    canvasScalableGrid.offset.y += movementY

                    const canvasEl = canvasScalableGrid.canvas
                    const rect = canvasEl.getBoundingClientRect()
                    const x = clientX - rect.left
                    const y = clientY - rect.top
                    canvasScalableGrid.hoverCell = drawMode ? { x, y } : null
                    console.log('canvasScalableGrid.hoverCell', canvasScalableGrid.hoverCell)
                    canvasScalableGrid.drawCanvas()
                }}
                ref={canvasRef}
                style={{
                    border: '1px solid black',
                    width: windowSize,
                    height: windowSize,
                }}
            />
        </div>
    )
}
