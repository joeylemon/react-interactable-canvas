import React, { useRef, useEffect } from 'react'

/**
 * Scale the canvas to match the device's pixel ratio (for retina displays)
 * @param {HTMLCanvasElement} canvas
 */
function scaleCanvas(canvas) {
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()

    // Set display size (css pixels).
    canvas.style.width = rect.width + 'px'
    canvas.style.height = rect.height + 'px'

    // Set actual size in memory (scaled to account for extra pixel density).
    const scale = window.devicePixelRatio
    canvas.width = Math.floor(rect.width * scale)
    canvas.height = Math.floor(rect.height * scale)

    // Normalize coordinate system to use css pixels.
    ctx.scale(scale, scale)
}

/**
 * Get a canvas coordinate pair taking into account the current transformations
 * @param {CanvasRenderingContext2D} ctx
 * @param {Number} x The x coordinate of the original position
 * @param {Number} y The y coordinate of the original position
 * @returns {Object} The new coordinates after applying the current transformations
 */
function getTransformedPoint(ctx, x, y) {
    const transform = ctx.getTransform()
    const inverseZoom = 1 / transform.a

    const transformedX = inverseZoom * x - inverseZoom * transform.e
    const transformedY = inverseZoom * y - inverseZoom * transform.f
    return { x: transformedX * window.devicePixelRatio, y: transformedY * window.devicePixelRatio }
}

/**
 * Update the canvas transformation matrix to keep all values within bounds
 * @param {HTMLCanvasElement} canvas
 * @param {CanvasRenderingContext2D} ctx
 */
function enforceBounds(canvas, ctx) {
    const rect = canvas.getBoundingClientRect()

    // transform.a: Horizontal scaling. A value of 1 results in no scaling.
    // transform.b: Vertical skewing.
    // transform.c: Horizontal skewing.
    // transform.d: Vertical scaling. A value of 1 results in no scaling.
    // transform.e: Horizontal translation (moving).
    // transform.f: Vertical translation (moving).
    const transform = ctx.getTransform()

    // Enforce scaling bounds (can't zoom out further than default)
    if (transform.a < 1) transform.a = 1
    if (transform.d < 1) transform.d = 1

    const scaledWidth = rect.width * transform.a
    const scaledHeight = rect.height * transform.d

    // Enforce translation bounds (can't pan left or right past the canvas width)
    if (transform.e > 0) transform.e = 0
    if (transform.e < -(scaledWidth - rect.width)) transform.e = -(scaledWidth - rect.width)
    if (transform.f > 0) transform.f = 0
    if (transform.f < -(scaledHeight - rect.height)) transform.f = -(scaledHeight - rect.height)

    ctx.setTransform(transform.a, transform.b, transform.c, transform.d, transform.e, transform.f)
}

/**
 * 
 * @param {CanvasRenderingContext2D} ctx 
 * @param {Object} from The originating point of the line
 * @param {Object} to The ending point of the line
 * @param {Object} options The options with which to draw the line (color, width)
 */
function drawLine(ctx, from, to, options) {
    ctx.fillStyle = options.color
    ctx.strokeStyle = options.color
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.lineWidth = options.width
    ctx.stroke()
}

const InteractableCanvas = ({ drawables, gridOptions, style, onContextMenu }) => {
    const canvasRef = useRef(null)

    /**
     * Find an object that touches the given point
     * @param {Object} pt
     * @returns 
     */
    const getObjectAt = pt => {
        if (!Array.isArray(drawables)) { return }
        return drawables.find(d => typeof d.touches === 'function' && d.touches(pt.x, pt.y))
    }

    /**
     * Draw the grid lines in the background of the canvas
     * @param {CanvasRenderingContext2D} ctx 
     */
    const drawGrid = ctx => {
        const canvas = canvasRef.current
        const gridSize = canvas.width * 3

        // Set default grid options, then insert provided options
        const drawOptions = {
            lineWidth: 1,
            lineColor: '#e6e6e6',
            cellSize: 40,
            ...gridOptions
        }

        // Draw vertical lines
        for (let x = -gridSize; x < canvas.width + gridSize; x += drawOptions.cellSize) {
            drawLine(ctx, { x: x, y: -gridSize }, { x: x, y: canvas.height + gridSize }, {
                width: drawOptions.lineWidth,
                color: drawOptions.lineColor
            })
        }

        // Draw horizontal lines
        for (let y = -gridSize; y < canvas.height + gridSize; y += drawOptions.cellSize) {
            drawLine(ctx, { x: -gridSize, y: y }, { x: canvas.width + gridSize, y: y }, {
                width: drawOptions.lineWidth,
                color: drawOptions.lineColor
            })
        }
    }

    /**
     * Call the draw function on all drawable objects
     * @param {CanvasRenderingContext2D} ctx 
     */
    const draw = ctx => {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)

        if (gridOptions && gridOptions.draw) { drawGrid(ctx) }

        if (!Array.isArray(drawables)) { return }
        for (const obj of drawables) {
            if (typeof obj.draw === 'function') {
                obj.draw(ctx)
            } else {
                throw new Error('object passed into InteractableCanvas has no draw function')
            }
        }
    }

    // Initialize the canvas with scaling and event listeners
    useEffect(() => {
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        scaleCanvas(canvas)

        canvas.addEventListener('click', e => {
            const pt = getTransformedPoint(ctx, e.offsetX, e.offsetY)
            draw(ctx)
        })

        canvas.addEventListener('mousewheel', e => {
            const zoom = e.deltaY < 0 ? 1.02 : 0.98
            const pt = getTransformedPoint(ctx, e.offsetX, e.offsetY)

            // Translate towards the point, then scale the canvas
            // This ensures we zoom in towards the point and not the top-left of the canvas
            ctx.translate(pt.x, pt.y)
            ctx.scale(zoom, zoom)
            ctx.translate(-pt.x, -pt.y)

            enforceBounds(canvas, ctx)
            draw(ctx)
        })

        canvas.addEventListener('mousedown', e => {
            // Only listen for left mouse down
            if (e.button !== 0) return

            const pt = getTransformedPoint(ctx, e.offsetX, e.offsetY)
            console.log({
                offsetX: e.offsetX,
                offsetY: e.offsetX,
                x: pt.x,
                y: pt.y,
                transform: ctx.getTransform()
            })

            const obj = getObjectAt(pt)
            if (obj && typeof obj.move === 'function') {
                // If we found an object on the mousedown location, start dragging it
                canvas.draggingObject = obj
                document.body.style.cursor = 'grabbing'
            } else {
                // Otherwise, we want to pan the canvas
                canvas.dragStart = pt
                document.body.style.cursor = 'grabbing'
            }
        })

        canvas.addEventListener('mousemove', e => {
            const pt = getTransformedPoint(ctx, e.offsetX, e.offsetY)
            if (canvas.draggingObject) {
                // Call the move function on the object
                canvas.draggingObject.move(pt)
                draw(ctx)
            } else if (canvas.dragStart) {
                // Pan the canvas by the movement delta of the mouse
                console.log('dx', pt.x - canvas.dragStart.x, 'dy', pt.y - canvas.dragStart.y)
                ctx.translate(pt.x - canvas.dragStart.x, pt.y - canvas.dragStart.y)
                enforceBounds(canvas, ctx)
                draw(ctx)
            }
        })

        window.addEventListener('mouseup', e => {
            // Stop any dragging when the user releases their mouse
            if (canvas.draggingObject) {
                canvas.draggingObject = null
                document.body.style.cursor = 'auto'
            } else if (canvas.dragStart) {
                canvas.dragStart = null
                document.body.style.cursor = 'auto'
            }
        })

        canvas.addEventListener('contextmenu', e => {
            const pt = getTransformedPoint(ctx, e.offsetX, e.offsetY)
            e.preventDefault()
            onContextMenu({ pt: pt, obj: getObjectAt(pt), clientX: e.clientX, clientY: e.clientY })
        })

        enforceBounds(canvas, ctx)
        draw(ctx)
    }, [])

    return (
        <canvas ref={canvasRef} style={style}></canvas>
    )
}

export default InteractableCanvas