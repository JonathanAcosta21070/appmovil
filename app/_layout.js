// app/_layout.js - VERSIÓN CORREGIDA
import { Stack, useRouter } from 'expo-router';
import { SyncProvider, useSync } from '../contexts/SyncContext';
import { BleProvider } from '../contexts/BleContext';
import { useEffect, useState } from 'react';

function NavigationHandler() {
  const { user, loadUser } = useSync();
  const router = useRouter();
  const [isRouterReady, setIsRouterReady] = useState(false);

  useEffect(() => {
    // Esperar a que el router esté listo
    const timer = setTimeout(() => {
      setIsRouterReady(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('🚀 Inicializando aplicación...');
        await loadUser();
        console.log('✅ App inicializada, usuario:', user ? 'logueado' : 'no logueado');
      } catch (error) {
        console.log('❌ Error inicializando app:', error);
      }
    };

    if (isRouterReady) {
      initializeApp();
    }
  }, [isRouterReady]);

  useEffect(() => {
    if (!isRouterReady || !user) return;

    console.log('🧭 Navegando según estado de autenticación...');
    
    // Usar setTimeout para asegurar que la navegación ocurra después del montaje
    const timer = setTimeout(() => {
      if (user) {
        const route = user.role === 'scientist' 
          ? '/scientist/home-scientist' 
          : '/farmer/home-farmer';
        console.log(`📍 Navegando a: ${route}`);
        router.replace(route);
      } else {
        console.log('📍 Navegando a login');
        router.replace('/');
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [user, isRouterReady]);

  return null;
}

export default function RootLayout() {
  return (
    <SyncProvider>
      <BleProvider>
        <NavigationHandler />
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="registro" options={{ title: 'Registro' }} />
          
          {/* farmer */}
          <Stack.Screen name="farmer/home-farmer" options={{ title: 'Panel Agricultor', headerBackVisible: false }} />
          <Stack.Screen name="farmer/action-register" options={{ title: 'Registrar Acción' }} />
          <Stack.Screen name="farmer/history" options={{ title: 'Historial' }} />
          <Stack.Screen name="farmer/crops-list" options={{ title: 'Lista de cultivos' }} />
          <Stack.Screen name="farmer/crop-details/[id]" options={{ title: 'Detalles de cultivo' }} />
          <Stack.Screen name="farmer/sensor-connection" options={{ title: 'Conexión a sensor' }} />
          <Stack.Screen name="farmer/alerts" options={{ title: 'Recomendaciones recibidas' }} />

          {/* scientist */}
          <Stack.Screen name="scientist/home-scientist" options={{ title: 'Panel Técnico', headerBackVisible: false }} />
          <Stack.Screen name="scientist/farmer-details/[farmerId]" options={{ title: 'Detalles de agricultor' }} />
          <Stack.Screen name="scientist/crop-details/[id]" options={{ title: 'Detalles de cultivo' }} />
          <Stack.Screen name="scientist/recommendations" options={{ title: 'Recomendaciones' }} />
          <Stack.Screen name="scientist/reports" options={{ title: 'Reportes' }} />
        </Stack>
      </BleProvider>
    </SyncProvider>
  );
}