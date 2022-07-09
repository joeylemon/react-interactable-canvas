import logo from './logo.svg'
import './App.css'
import InteractableCanvas from './components/InteractableCanvas'

const drawables = [
    {
        draw: ctx => {
            ctx.beginPath()
            ctx.arc(200, 200, 50, 0, 2 * Math.PI)
            ctx.fill()
        }
    }
]

function App() {
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
                drawables={drawables} />
        </div>
    )
}

export default App
