import './App.css'
import InteractableCanvas from './components/InteractableCanvas'
import { useEffect, useState } from 'react'

function App() {
    const [drawables, setDrawables] = useState([
        {
            draw: ctx => {
                ctx.beginPath()
                ctx.arc(200, 200, 50, 0, 2 * Math.PI)
                ctx.fill()
            }
        }
    ])

    console.log('drawables', drawables)

    useEffect(() => {
        setTimeout(() => {
            setDrawables(oldArray => {
                return [...oldArray, {
                    draw: ctx => {
                        ctx.beginPath()
                        ctx.arc(400, 400, 50, 0, 2 * Math.PI)
                        ctx.fill()
                    }
                }]
            })
            console.log('pushed drawable')
        }, 2000)
        setTimeout(() => {
            setDrawables(oldArray => {
                return [...oldArray, {
                    draw: ctx => {
                        ctx.beginPath()
                        ctx.arc(400, 400, 50, 0, 2 * Math.PI)
                        ctx.fill()
                    }
                }]
            })
            console.log('pushed drawable')
        }, 2500)
    }, [])

    const onContextMenu = e => {
        setDrawables(oldArray => {
            return [
                ...oldArray,
                {
                    draw: ctx => {
                        ctx.beginPath()
                        ctx.arc(e.pt.x, e.pt.y, 25, 0, 2 * Math.PI)
                        ctx.fill()
                    }
                }
            ]
        })
        console.log('add circle')
    }

    return (
        <div className="App">
            <InteractableCanvas
                style={{
                    width: 700,
                    height: 700,
                    border: '1px solid #000',
                    marginTop: 15
                }}
                gridOptions={{ draw: true }}
                drawables={drawables}
                onContextMenu={onContextMenu} />
        </div>
    )
}

export default App
