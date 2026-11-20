import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AppProvider } from './context/AppContext'
import './styles.css'

// Compatibilité React ↔ Google Traduction : la traduction remplace des nœuds texte,
// ce qui fait échouer removeChild / insertBefore de React. On rend ces appels tolérants.
if (typeof Node === 'function' && Node.prototype) {
  const removeChild = Node.prototype.removeChild
  Node.prototype.removeChild = function (child) {
    if (child.parentNode !== this) return child
    return removeChild.call(this, child)
  }
  const insertBefore = Node.prototype.insertBefore
  Node.prototype.insertBefore = function (node, ref) {
    if (ref && ref.parentNode !== this) return insertBefore.call(this, node, null)
    return insertBefore.call(this, node, ref)
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProvider>
        <App />
      </AppProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
