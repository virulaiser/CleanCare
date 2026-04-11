import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Usuarios from './pages/Usuarios';
import Registro from './pages/Registro';
import MiCuenta from './pages/MiCuenta';
import Dashboard from './pages/Dashboard';
import Maquinas from './pages/Maquinas';
import Creditos from './pages/Creditos';
import Tips from './pages/Tips';
import AdminUsuarios from './pages/AdminUsuarios';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/usuarios" element={<Usuarios />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/mi-cuenta" element={<MiCuenta />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/maquinas" element={<Maquinas />} />
        <Route path="/creditos" element={<Creditos />} />
        <Route path="/tips" element={<Tips />} />
        <Route path="/admin-usuarios" element={<AdminUsuarios />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
