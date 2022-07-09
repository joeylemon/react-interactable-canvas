import React, { useRef, useEffect } from 'react'

const DEFAULT_SCALING = Math.max(2, window.devicePixelRatio)

/**
 * Scale the canvas to match the device's pixel ratio (for retina displays)
 * @param {HTMLCanvasElement} canvas
 */
function scaleCanvas(canvas, ctx) {
    const rect = canvas.getBoundingClientRect()

    // Set display size (css pixels).
    canvas.style.width = rect.width + 'px'
    canvas.style.height = rect.height + 'px'

    // Set actual size in memory (scaled to account for extra pixel density).
    canvas.width = Math.floor(rect.width * DEFAULT_SCALING)
    canvas.height = Math.floor(rect.height * DEFAULT_SCALING)

    // Normalize coordinate system to use css pixels.
    ctx.scale(DEFAULT_SCALING, DEFAULT_SCALING)
    // ctx.setTransform(1, 0, 0, 1, 0, 0)
}

/**
 * Get a canvas coordinate pair taking into account the current transformations.
 * This will return the same coordinate pair regardless of how zoomed/panned the canvas is.
 * For example, if the user clicked on a spot when not zoomed in at all:
 *     getTransformedPoint(ctx, 32, 32)   => { x: 32, y: 32 }
 * Then, they clicked on the same spot when zoomed in:
 *     getTransformedPoint(ctx, 702, 702) => { x: 32, y: 32 }
 * 
 * @param {CanvasRenderingContext2D} ctx
 * @param {Number} x The x coordinate of the original position (e.g. e.offsetX)
 * @param {Number} y The y coordinate of the original position (e.g. e.offsetY)
 * @returns {Object} The new coordinates after applying the current transformations
 */
function getTransformedPoint(ctx, x, y) {
    const transform = ctx.getTransform()

    // transform.a represents the horizontal scaling of the canvas
    // Get the inverse so we can undo any scaling
    // transform.d represents vertical scaling, but we always scale horizontal/vertical
    // with the same values, so transform.a will always === transform.d
    const inverseZoom = 1 / transform.a

    // Return the point to normal scaling
    let transformedX = inverseZoom * x

    // Multiply by existing scaling to account for our extra pixel density as a result of scaleCanvas()
    transformedX *= DEFAULT_SCALING

    // Subtract the horizontal translation to account for panning of the canvas
    transformedX -= inverseZoom * transform.e

    let transformedY = inverseZoom * y
    transformedY *= DEFAULT_SCALING
    transformedY -= inverseZoom * transform.f

    return { x: transformedX, y: transformedY }
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

    // Enforce min scaling bounds (can't zoom out further than default)
    // We can't handle max scaling here because ctx.translate gets called 
    // on mousewheel event and we'd need a way to undo it
    if (transform.a < 1) transform.a = 1
    if (transform.d < 1) transform.d = 1

    const scaledWidth = rect.width * transform.a
    const scaledHeight = rect.height * transform.d

    const maxHorizontalTranslation = -(scaledWidth - rect.width) * DEFAULT_SCALING
    const maxVerticalTranslation = -(scaledHeight - rect.height) * DEFAULT_SCALING

    // Enforce horizontal translation bounds (can't pan left or right past the canvas width)
    if (transform.e > 0) transform.e = 0
    if (transform.e < maxHorizontalTranslation) transform.e = maxHorizontalTranslation
    
    // Enforce horizontal vertical bounds (can't pan up or down past the canvas height)
    if (transform.f > 0) transform.f = 0
    if (transform.f < maxVerticalTranslation) transform.f = maxVerticalTranslation

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

const InteractableCanvas = ({ drawables, maxZoom, gridOptions, style, onContextMenu }) => {
    const canvasRef = useRef(null)
    const maxScaleValue = maxZoom ? maxZoom : 5

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
        const rect = canvasRef.current.getBoundingClientRect()
        const scaledWidth = rect.width * DEFAULT_SCALING
        const scaledHeight = rect.height * DEFAULT_SCALING

        // Set default grid options, then insert provided options
        const drawOptions = {
            lineWidth: 1,
            lineColor: '#e6e6e6',
            cellSize: 40,
            ...gridOptions
        }

        // Draw vertical lines
        for (let x = 0; x < scaledWidth; x += drawOptions.cellSize) {
            drawLine(ctx, { x: x, y: 0 }, { x: x, y: scaledHeight }, {
                width: drawOptions.lineWidth,
                color: drawOptions.lineColor
            })
        }

        // Draw horizontal lines
        for (let y = 0; y < scaledHeight; y += drawOptions.cellSize) {
            drawLine(ctx, { x: 0, y: y }, { x: scaledWidth, y: y }, {
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
        ctx = canvasRef.current.getContext('2d')
        ctx.clearRect(0, 0, ctx.canvas.width + 50, ctx.canvas.height + 50)

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
        scaleCanvas(canvas, ctx)

        canvas.addEventListener('click', e => {
            const pt = getTransformedPoint(ctx, e.offsetX, e.offsetY)
            draw(ctx)
        })

        canvas.addEventListener('mousewheel', e => {
            // If zooming in and the canvas is already past max scale, do nothing
            // We don't have to worry about minScale because enforceBounds() handles it
            if (e.deltaY < 0 && ctx.getTransform().a > maxScaleValue) return

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

    // Redraw the canvas when the drawables array is changed
    useEffect(() => {
        draw(canvasRef.current.getContext('2d'))
    }, [drawables])

    return (
        <canvas ref={canvasRef} style={style}></canvas>
    )
}

export default InteractableCanvas