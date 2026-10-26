import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabase';
import HomeTecnico from './pages/HomeTecnico';
import AdminDashboard from './pages/Admin/AdminDashboard';
import Login from './pages/Login';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null); // 'ADMIN' | 'TECNICO' | null
  const [carregando, setCarregando] = useState(true);

  // Passo 1: Busca a role do usuário na tabela 'usuarios'
  const buscarRoleUsuario = async (userSession) => {
    if (!userSession?.user?.email) {
      setUserRole(null);
      return;
    }

    try {
      // 1. Tenta consultar pela coluna email
      const { data, error } = await supabase
        .from('usuarios')
        .select('role')
        .eq('email', userSession.user.email)
        .single();

      if (!error && data?.role) {
        setUserRole(data.role.toUpperCase());
        return;
      }

      // 2. Fallback caso a coluna seja 'login'
      const { data: dataLogin, error: errorLogin } = await supabase
        .from('usuarios')
        .select('role')
        .eq('login', userSession.user.email)
        .single();

      if (!errorLogin && dataLogin?.role) {
        setUserRole(dataLogin.role.toUpperCase());
        return;
      }
    } catch (err) {
      console.warn('Aviso ao consultar perfil de usuário no Supabase:', err);
    }

    // Role padrão para operação de campo caso não encontre
    setUserRole('TECNICO');
  };

  useEffect(() => {
    let montado = true;

    async function inicializar() {
      try {
        const { data: { session: sessaoAtual } } = await supabase.auth.getSession();
        if (montado) {
          setSession(sessaoAtual);
          if (sessaoAtual) {
            await buscarRoleUsuario(sessaoAtual);
          }
        }
      } catch (err) {
        console.error('Erro ao inicializar sessão:', err);
      } finally {
        if (montado) {
          setCarregando(false);
        }
      }
    }

    inicializar();

    // Ouve alterações no estado de autenticação (login, logout, refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, novaSessao) => {
      setSession(novaSessao);
      if (novaSessao) {
        setCarregando(true);
        await buscarRoleUsuario(novaSessao);
        setCarregando(false);
      } else {
        setUserRole(null);
        setCarregando(false);
      }
    });

    return () => {
      montado = false;
      subscription?.unsubscribe();
    };
  }, []);

  // Ecrã de carregamento enquanto valida sessão e perfil
  if (carregando) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-brand animate-spin" />
        <span className="text-sm font-semibold text-slate-600 tracking-wide">
          A carregar sistema...
        </span>
      </div>
    );
  }

  // Passo 2: Desvio de rotas baseado no perfil (Role-Based Routing)
  return (
    <BrowserRouter>
      <Routes>
        {session ? (
          <>
            <Route
              path="/"
              element={
                userRole === 'ADMIN' ? (
                  <AdminDashboard session={session} />
                ) : (
                  <HomeTecnico session={session} />
                )
              }
            />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        ) : (
          <>
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  );
}
