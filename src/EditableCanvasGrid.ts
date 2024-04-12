export class EditableCanvasGrid {
    // without zoom / offset
    cellsData: [x: number, y: number, color: string | [number, number, number]][] = []
    newCellsData: [x: number, y: number, color: string][] = []
    gridPixelsSize = 500
    displayGrid = false
    scale = [] as number[]
    currentCursor: { x: number; y: number } | null = null

    dataCanvas: HTMLCanvasElement
    editCanvas: HTMLCanvasElement
    dataCtx: CanvasRenderingContext2D
    editCtx: CanvasRenderingContext2D
    previousCursor: { x: number; y: number } | null = null

    constructor(public container: HTMLElement, public cellSize: number) {
        this.container = container
        this.dataCanvas = document.createElement('canvas')
        this.dataCtx = this.dataCanvas.getContext('2d')!
        this.dataCtx.imageSmoothingEnabled = false

        this.editCanvas = document.createElement('canvas')
        this.editCtx = this.editCanvas.getContext('2d')!
        this.editCtx.imageSmoothingEnabled = false

        this.editCanvas.style.position = 'absolute'
        this.editCanvas.style.top = '0'

        container.appendChild(this.dataCanvas)
        container.appendChild(this.editCanvas)
    }

    getScale() {
        return this.scale.reduce((acc, val) => acc * val, 1)
    }

    _drawCell(ctx: CanvasRenderingContext2D, x: number, y: number, color: string | [number, number, number] | number) {
        const pixelSize = this._getRenderPixelSize()
        ctx.save()
        ctx.fillStyle = typeof color === 'string' ? color : Array.isArray(color) ? `rgb(${color.join(',')})` : `rgb(${color},${color},${color})`
        ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize)
        ctx.restore()
    }

    getXyFromAbslute(x: number, y: number) {
        return [Math.floor((x * this.getScale()) / this.cellSize), Math.floor((y * this.getScale()) / this.cellSize)] as [number, number]
    }

    changeCursor() {
        if (this.currentCursor === this.previousCursor) return
        if (this.previousCursor) {
            const [x, y] = this.getXyFromAbslute(this.previousCursor.x, this.previousCursor.y)
            this._restoreCell(this.editCtx, x, y)
        }

        this.previousCursor = this.currentCursor

        if (this.currentCursor) {
            const [x, y] = this.getXyFromAbslute(this.currentCursor.x, this.currentCursor.y)
            this._drawCell(this.editCtx, x, y, 'rgba(0, 0, 0, 0.5)')
            globalThis.debugCurrentCursor = [x, y]
        }

        this.drawEditGrid()
    }

    _restoreCell(ctx: CanvasRenderingContext2D, x: number, y: number) {
        const allCells = [...this.newCellsData, ...this.cellsData]
        const cell = allCells.find(([cellX, cellY]) => cellX === x && cellY === y)
        if (cell) {
            this._drawCell(ctx, x, y, cell[2])
        } else {
            ctx.clearRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize)
        }
        this.drawEditGrid()
    }

    updateSize(renderingScale = 1) {
        renderingScale = 1
        const basicSize = this.gridPixelsSize * this.cellSize
        this.scale[0] = renderingScale
        for (const ctx of [this.dataCtx, this.editCtx]) {
            const { canvas } = ctx
            canvas.width = basicSize * renderingScale
            canvas.height = basicSize * renderingScale
            canvas.style.width = `${basicSize}px`
            canvas.style.height = `${basicSize}px`
            this.drawCanvas(ctx === this.editCtx)
        }
    }

    drawCanvas(isEdit: boolean) {
        const ctx = isEdit ? this.editCtx : this.dataCtx
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
        const cellsData = isEdit ? this.newCellsData : this.cellsData
        for (const [x, y, color] of cellsData) {
            this._drawCell(ctx, x, y, color)
        }

        if (isEdit) {
            this.drawEditGrid()
        }
    }

    _getRenderScale() {
        return this.scale[0] ?? 1
    }

    _getRenderPixelSize() {
        const renderScale = this._getRenderScale()
        return this.cellSize * renderScale
    }

    drawEditGrid() {
        if (!this.displayGrid) return
        const { gridPixelsSize } = this
        const pixelSize = this._getRenderPixelSize()

        const gridSize = gridPixelsSize * pixelSize
        const ctx = this.editCtx
        ctx.save()
        ctx.strokeStyle = 'black'
        ctx.lineWidth = 0.1 * this._getRenderScale()
        // horizontal lines
        for (let i = 0; i < gridPixelsSize; i++) {
            ctx.beginPath()
            ctx.moveTo(0, i * pixelSize)
            ctx.lineTo(gridSize * pixelSize, i * pixelSize)
            ctx.stroke()
        }
        // vertical lines
        for (let i = 0; i < gridPixelsSize; i++) {
            ctx.beginPath()
            ctx.moveTo(i * pixelSize, 0)
            ctx.lineTo(i * pixelSize, gridSize * pixelSize)
            ctx.stroke()
        }
        ctx.restore()
    }

    placeNewEditCell(x: number, y: number, color: string) {
        this.newCellsData.push([x, y, color])
        this._drawCell(this.editCtx, x, y, color)
        this.drawEditGrid()
    }
}
