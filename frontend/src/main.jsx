import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { BrowserRouter } from 'react-router-dom'
import AppContextProvider from './context/AppContext.jsx'
import SocketContextProvider from './context/SocketContext.jsx'
import DriverContextProvider from './context/DriverContext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AppContextProvider>
      <DriverContextProvider>
        <SocketContextProvider>
          <App />
        </SocketContextProvider>
      </DriverContextProvider>
    </AppContextProvider>
  </BrowserRouter>,
)
